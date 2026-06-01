import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoriesService, Story, CreateStoryPayload, UpdateStoryPayload } from '../../services/stories.service';
import { OrganizationService, Organization } from '../../services/organization.service';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

type StatusFilter = '' | 'draft' | 'review' | 'published' | 'archived' | 'rejected';
type WorkflowAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'unarchive';

const WORKFLOW_TRANSITIONS: Record<WorkflowAction, { status: string; label: string; class: string }> = {
  submit:    { status: 'review',    label: 'Submit for Review', class: 'primary-button' },
  approve:   { status: 'published', label: 'Approve & Publish', class: 'success-button' },
  reject:    { status: 'rejected',  label: 'Reject',            class: 'danger-button'  },
  publish:   { status: 'published', label: 'Publish',           class: 'success-button' },
  archive:   { status: 'archived',  label: 'Archive',           class: 'warning-button' },
  unarchive: { status: 'draft',     label: 'Unarchive',         class: 'ghost-button'   }
};

function availableActions(status: string): WorkflowAction[] {
  switch (status) {
    case 'draft':     return ['submit'];
    case 'review':    return ['approve', 'reject'];
    case 'published': return ['archive'];
    case 'rejected':  return ['submit'];
    case 'archived':  return ['unarchive'];
    default:          return [];
  }
}

const ROLES = ['student', 'alumnus', 'researcher', 'faculty', 'other'];
const TYPES = ['student_success', 'alumni_spotlight', 'researcher_profile', 'other'];

import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'replaceUnderscores',
  standalone: true
})
export class ReplaceUnderscoresPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    return value.replace(/_/g, ' ');
  }
}

@Component({
  selector: 'app-admin-stories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReplaceUnderscoresPipe],
  template: `
    <section class="page">
        <!-- ─── Page Header ──────────────────────────────────────────────────── -->
        <header class="page-header">
          <div>
            <p class="eyebrow">Content</p>
            <h1>University Stories</h1>
            <p>Highlight student success stories, alumni profiles, and research spotlights.</p>
          </div>
          <button type="button" class="primary-button" (click)="openCreateModal()">
            + New Story
          </button>
        </header>

        <!-- ─── Metrics ──────────────────────────────────────────────────────── -->
        <div class="metric-grid">
          <div class="metric-card">
            <span>Total Stories</span>
            <strong>{{ total() }}</strong>
          </div>
          <div class="metric-card">
            <span>Published</span>
            <strong class="published-count">{{ publishedCount() }}</strong>
          </div>
          <div class="metric-card">
            <span>Pending Review</span>
            <strong class="review-count">{{ reviewCount() }}</strong>
          </div>
        </div>

        <!-- ─── Filters ───────────────────────────────────────────────────────── -->
        <div class="data-card">
          <div class="card-toolbar">
            <div style="display:flex;gap:12px;align-items:center;flex:1;flex-wrap:wrap">
              <label class="search-field">
                <input
                  type="search"
                  placeholder="Search stories by title, slug or person name…"
                  [(ngModel)]="searchTerm"
                  (ngModelChange)="onSearch()"
                  id="stories-search"
                />
              </label>
              <label class="select-field">
                <select [(ngModel)]="statusFilter" (ngModelChange)="loadStories()" id="stories-status-filter">
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="review">In Review</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label class="select-field">
                <select [(ngModel)]="roleFilter" (ngModelChange)="loadStories()" id="stories-role-filter">
                  <option value="">All Roles</option>
                  @for (r of roles; track r) {
                    <option [value]="r">{{ r | titlecase }}</option>
                  }
                </select>
              </label>
              <label class="select-field">
                <select [(ngModel)]="typeFilter" (ngModelChange)="loadStories()" id="stories-type-filter">
                  <option value="">All Types</option>
                  @for (t of types; track t) {
                    <option [value]="t">{{ t | titlecase | replaceUnderscores }}</option>
                  }
                </select>
              </label>
            </div>
          </div>

          <!-- ─── Table ─────────────────────────────────────────────────────── -->
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Story Title</th>
                  <th>Person Name</th>
                  <th>Role</th>
                  <th>Affiliation / Year</th>
                  <th>LinkedIn</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="8" class="empty-cell">Loading stories…</td>
                  </tr>
                } @else if (stories().length === 0) {
                  <tr>
                    <td colspan="8" class="empty-cell">
                      No stories found.
                      <button type="button" class="ghost-button" style="margin-left:10px" (click)="openCreateModal()">Write first story</button>
                    </td>
                  </tr>
                } @else {
                  @for (st of stories(); track st.id) {
                    <tr>
                      <td>
                        <div class="page-cell">
                          <strong>{{ st.title }}</strong>
                          <span class="muted font-mono" style="font-size:0.76rem">{{ st.slug }}</span>
                        </div>
                      </td>
                      <td>{{ st.person_name }}</td>
                      <td>
                        <span class="pill pill-draft">{{ st.person_role | titlecase }}</span>
                      </td>
                      <td>
                        <div style="font-size:0.84rem">
                          <div>{{ st.company || '—' }}</div>
                          <div class="muted">Grad: {{ st.graduation_year || '—' }}</div>
                        </div>
                      </td>
                      <td>
                        @if (st.linkedin_url) {
                          <a [href]="st.linkedin_url" target="_blank" class="font-mono" style="font-size:0.82rem;color:var(--primary-red)">Profile ↗</a>
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td>
                        <span class="pill" [ngClass]="statusClass(st.status)">{{ st.status }}</span>
                      </td>
                      <td>
                        @if (st.is_featured) {
                          <span class="pill pill-active">Featured</span>
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td class="right">
                        <div class="dropdown">
                          <button type="button" class="ghost-button" (click)="toggleRowDropdown(st.id)">...</button>
                          @if (activeRowDropdown() === st.id) {
                            <div class="dropdown-menu">
                              <button type="button" (click)="openEditModal(st); toggleRowDropdown(st.id)" [id]="'edit-story-' + st.id">Edit</button>
                              @for (action of availableActions(st.status); track action) {
                                <button
                                  type="button"
                                  (click)="openStatusModal(st, action); toggleRowDropdown(st.id)"
                                  [id]="'action-' + action + '-' + st.id"
                                >{{ workflowLabel(action) }}</button>
                              }
                              @if (st.status !== 'archived') {
                                <button type="button" style="color:var(--color-danger)" (click)="confirmDelete(st); toggleRowDropdown(st.id)" [id]="'delete-story-' + st.id">Archive</button>
                              }
                            </div>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <!-- ─── Pagination ────────────────────────────────────────────────── -->
          @if (total() > pageSize) {
            <div class="table-footer">
              <span>Showing {{ stories().length }} of {{ total() }} stories</span>
              <div style="display:flex;gap:8px">
                <button type="button" class="ghost-button" [disabled]="currentOffset() === 0" (click)="prevPage()">← Prev</button>
                <button type="button" class="ghost-button" [disabled]="currentOffset() + pageSize >= total()" (click)="nextPage()">Next →</button>
              </div>
            </div>
          }
        </div>
    </section>

    <!-- ═══ Create / Edit Modal ═══════════════════════════════════════════════ -->
    @if (showFormModal()) {
      <div class="modal-backdrop" (click)="closeFormModal()">
        <form class="modal-card wide" (click)="$event.stopPropagation()" (ngSubmit)="submitForm()" style="display:flex;flex-direction:column">
          <header>
            <div>
              <p class="eyebrow">{{ isEditMode() ? 'Update Story' : 'New Story' }}</p>
              <h2>{{ isEditMode() ? form.title || 'Untitled' : 'Create Story' }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
          </header>

          <div class="two-column">
            <label class="form-field">
              <span>Story Headline <em class="required">*</em></span>
              <input
                id="st-title"
                type="text"
                [(ngModel)]="form.title"
                name="title"
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. Lands Google Offer with record package"
                required
              />
            </label>
            <label class="form-field">
              <span>Slug <em class="required">*</em></span>
              <input
                id="st-slug"
                type="text"
                [(ngModel)]="form.slug"
                name="slug"
                placeholder="e.g. lands-google-offer-with-record-package"
                required
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Story Type <em class="required">*</em></span>
              <select id="st-type" [(ngModel)]="form.story_type" name="story_type" required>
                @for (t of types; track t) {
                  <option [value]="t">{{ t | titlecase | replaceUnderscores }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Person Name <em class="required">*</em></span>
              <input
                id="st-name"
                type="text"
                [(ngModel)]="form.person_name"
                name="person_name"
                placeholder="e.g. Jane Doe"
                required
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Person Role <em class="required">*</em></span>
              <select id="st-role" [(ngModel)]="form.person_role" name="person_role" required>
                @for (r of roles; track r) {
                  <option [value]="r">{{ r | titlecase }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Company / Placement Affiliation</span>
              <input
                id="st-company"
                type="text"
                [(ngModel)]="form.company"
                name="company"
                placeholder="e.g. Google India"
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Graduation Year</span>
              <input
                id="st-grad-year"
                type="number"
                min="1900"
                max="2100"
                [(ngModel)]="form.graduation_year"
                name="graduation_year"
                placeholder="e.g. 2025"
              />
            </label>
            <label class="form-field">
              <span>LinkedIn URL</span>
              <input
                id="st-linkedin"
                type="url"
                [(ngModel)]="form.linkedin_url"
                name="linkedin_url"
                placeholder="https://linkedin.com/in/jane-doe"
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Primary Institution / Organization</span>
              <select id="st-org" [(ngModel)]="form.organization_id" name="organization_id" [disabled]="isEditMode()">
                <option [value]="null">Select Organization</option>
                @for (org of activeOrgs(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </label>
            <div style="display:flex;align-items:center;padding-top:20px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="st-featured" [(ngModel)]="form.is_featured" name="is_featured" style="width:auto;accent-color:var(--primary-red)" />
                <span style="font-size:0.86rem;font-weight:700;color:#334155">Mark as Featured Story</span>
              </label>
            </div>
          </div>

          <footer>
            <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (isEditMode() ? 'Save Changes' : 'Create Story') }}
            </button>
          </footer>
        </form>
      </div>
    }

    <!-- ═══ Workflow Status Modal ══════════════════════════════════════════════ -->
    @if (showStatusModal()) {
      <div class="modal-backdrop" (click)="closeStatusModal()">
        <div class="modal-card" (click)="$event.stopPropagation()" style="display:flex;flex-direction:column">
          <header>
            <div>
              <p class="eyebrow">Workflow</p>
              <h2>{{ statusModalTitle() }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeStatusModal()">×</button>
          </header>

          <p style="color:#475569;margin:0 0 16px">
            Story: <strong>{{ statusTarget()?.title }}</strong>
          </p>
          <p style="color:#475569;margin:0 0 16px">
            Transition: <span class="pill" [ngClass]="statusClass(statusTarget()?.status || '')">{{ statusTarget()?.status }}</span>
            &nbsp;→&nbsp;
            <span class="pill" [ngClass]="statusClass(pendingStatus())">{{ pendingStatus() }}</span>
          </p>

          <label class="form-field">
            <span>Remarks <span class="muted">(optional)</span></span>
            <textarea id="status-remarks" [(ngModel)]="statusRemarks" rows="3" placeholder="Add a reviewer note or reason…"></textarea>
          </label>

          <footer>
            <button type="button" class="ghost-button" (click)="closeStatusModal()">Cancel</button>
            <button
              type="button"
              [class]="workflowClass(pendingAction())"
              (click)="confirmStatus()"
              [disabled]="saving()"
            >{{ saving() ? 'Processing…' : workflowLabel(pendingAction()) }}</button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .published-count { color: #047857; }
    .review-count    { color: #b45309; }

    .success-button {
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 800;
      cursor: pointer;
      background: #dcfce7;
      color: #047857;
      transition: background 0.16s ease;
    }
    .success-button:hover { background: #bbf7d0; }

    .warning-button {
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 800;
      cursor: pointer;
      background: #fef3c7;
      color: #b45309;
      transition: background 0.16s ease;
    }

    em.required { color: #e11d48; font-style: normal; }
    .select-field select { min-width: 140px; }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminStories implements OnInit {
  private readonly storiesService = inject(StoriesService);
  private readonly orgService = inject(OrganizationService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly isEditor = computed(() => {
    const roles = this.auth.context()?.globalRoles?.map(r => r.name) || [];
    return !roles.includes('SUPER_ADMIN') && !roles.includes('UNIVERSITY_ADMIN');
  });

  // ─── State ────────────────────────────────────────────────────────────────
  stories       = signal<Story[]>([]);
  total         = signal(0);
  loading       = signal(false);
  saving        = signal(false);

  searchTerm    = '';
  statusFilter: StatusFilter = '';
  roleFilter    = '';
  typeFilter    = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  // ─── Metrics ─────────────────────────────────────────────────────────────
  publishedCount = signal(0);
  reviewCount    = signal(0);

  // ─── Metadata options ────────────────────────────────────────────────────
  activeOrgs = signal<Organization[]>([]);
  readonly roles = ROLES;
  readonly types = TYPES;

  // ─── Form modal state ───────────────────────────────────────────────────
  showFormModal = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);

  form: {
    title: string;
    slug: string;
    story_type: string;
    person_name: string;
    person_role: string;
    company: string;
    graduation_year: number | null;
    linkedin_url: string;
    is_featured: boolean;
    organization_id: string | null;
  } = this.emptyForm();

  // ─── Status modal state ─────────────────────────────────────────────────
  showStatusModal = signal(false);
  statusTarget    = signal<Story | null>(null);
  pendingAction   = signal<WorkflowAction>('submit');
  pendingStatus   = signal('');
  statusRemarks   = '';
  activeRowDropdown = signal<string | null>(null);

  toggleRowDropdown(id: string) {
    if (this.activeRowDropdown() === id) {
      this.activeRowDropdown.set(null);
    } else {
      this.activeRowDropdown.set(id);
    }
  }

  readonly statusModalTitle = computed(() => {
    const a = this.pendingAction();
    return WORKFLOW_TRANSITIONS[a]?.label ?? 'Confirm';
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadStories();
    this.loadMetadata();
    this.loadMetrics();

    this.route.queryParams.subscribe(params => {
      if (params['create']) {
        this.openCreateModal();
      } else if (params['edit']) {
        this.storiesService.getStory(params['edit']).subscribe({
          next: (st) => this.openEditModal(st),
          error: (err) => this.toast.error('Error', 'Failed to load story for editing')
        });
      }
    });
  }

  loadStories() {
    this.loading.set(true);
    this.storiesService.listStories({
      status:      this.statusFilter || undefined,
      story_type:  this.typeFilter || undefined,
      person_role: this.roleFilter || undefined,
      search:      this.searchTerm || undefined,
      limit:       this.pageSize,
      offset:      this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.stories.set(res.stories);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load stories');
        this.loading.set(false);
      }
    });
  }

  loadMetrics() {
    this.storiesService.listStories({ status: 'published', limit: 1 }).subscribe({
      next: (res) => this.publishedCount.set(res.total)
    });
    this.storiesService.listStories({ status: 'review', limit: 1 }).subscribe({
      next: (res) => this.reviewCount.set(res.total)
    });
  }

  loadMetadata() {
    this.orgService.listOrganizations(undefined, true).subscribe({
      next: (res) => this.activeOrgs.set(res)
    });
  }

  onSearch() {
    this.currentOffset.set(0);
    this.loadStories();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadStories();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadStories();
  }

  // ─── Form modal controls ───────────────────────────────────────────────
  openCreateModal() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.showFormModal.set(true);
  }

  openEditModal(st: Story) {
    this.isEditMode.set(true);
    this.editingId.set(st.id);

    this.form = {
      title:            st.title,
      slug:             st.slug,
      story_type:       st.story_type,
      person_name:      st.person_name,
      person_role:      st.person_role,
      company:          st.company ?? '',
      graduation_year:  st.graduation_year,
      linkedin_url:     st.linkedin_url ?? '',
      is_featured:      st.is_featured,
      organization_id:  null
    };
    this.showFormModal.set(true);
  }

  closeFormModal() { 
    this.showFormModal.set(false); 
    const params = this.route.snapshot.queryParams;
    if (params['create'] || params['edit']) {
      this.router.navigate(['/admin/content']);
    }
  }

  onTitleChange(title: string) {
    if (!this.isEditMode()) {
      this.form.slug = this.storiesService.slugify(title);
    }
  }

  submitForm() {
    if (!this.form.title.trim() || !this.form.slug.trim()) {
      this.toast.error('Validation Error', 'Headline and slug are required.');
      return;
    }
    if (!this.form.story_type || !this.form.person_name.trim() || !this.form.person_role) {
      this.toast.error('Validation Error', 'Type, person name, and role are required.');
      return;
    }

    this.saving.set(true);

    const payload = {
      title:            this.form.title.trim(),
      slug:             this.form.slug.trim(),
      story_type:       this.form.story_type,
      person_name:      this.form.person_name.trim(),
      person_role:      this.form.person_role,
      company:          this.form.company.trim() || null,
      graduation_year:  this.form.graduation_year,
      linkedin_url:     this.form.linkedin_url.trim() || null,
      is_featured:      this.form.is_featured
    };

    if (this.isEditMode()) {
      this.storiesService.updateStory(this.editingId()!, payload as UpdateStoryPayload).subscribe({
        next: () => {
          this.toast.success('Story updated');
          this.saving.set(false);
          this.closeFormModal();
          this.loadStories();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to update story');
          this.saving.set(false);
        }
      });
    } else {
      const createPayload: CreateStoryPayload = {
        ...payload,
        organization_ids: this.form.organization_id ? [this.form.organization_id] : []
      };

      this.storiesService.createStory(createPayload).subscribe({
        next: () => {
          this.toast.success('Story created');
          this.saving.set(false);
          this.closeFormModal();
          this.loadStories();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to create story');
          this.saving.set(false);
        }
      });
    }
  }

  // ─── Status Workflow controls ──────────────────────────────────────────
  openStatusModal(st: Story, action: WorkflowAction) {
    this.statusTarget.set(st);
    this.pendingAction.set(action);
    this.pendingStatus.set(WORKFLOW_TRANSITIONS[action].status);
    this.statusRemarks = '';
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); }

  confirmStatus() {
    const st = this.statusTarget();
    if (!st) return;

    this.saving.set(true);
    this.storiesService.transitionStatus(st.id, this.pendingStatus(), this.statusRemarks || undefined).subscribe({
      next: () => {
        this.toast.success(`Story ${this.pendingStatus()}`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadStories();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Status transition failed');
        this.saving.set(false);
      }
    });
  }

  // ─── Archive / Delete ───────────────────────────────────────────────────
  confirmDelete(st: Story) {
    if (!confirm(`Archive "${st.title}"? It will be hidden from all public lists.`)) return;

    this.storiesService.deleteStory(st.id).subscribe({
      next: () => {
        this.toast.success('Story archived');
        this.loadStories();
        this.loadMetrics();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to archive story')
    });
  }

  // ─── Helper utilities ──────────────────────────────────────────────────
  availableActions(status: string): WorkflowAction[] {
    const actions = availableActions(status);
    if (this.isEditor() && status === 'archived') {
      return actions.filter(a => a !== 'unarchive');
    }
    return actions;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'published': return 'pill pill-active';
      case 'draft':     return 'pill pill-draft';
      case 'review':    return 'pill pill-review';
      case 'rejected':  return 'pill pill-rejected';
      case 'archived':  return 'pill';
      default:          return 'pill';
    }
  }

  workflowLabel(action: WorkflowAction): string {
    return WORKFLOW_TRANSITIONS[action]?.label ?? action;
  }

  workflowClass(action: WorkflowAction): string {
    return WORKFLOW_TRANSITIONS[action]?.class ?? 'ghost-button';
  }

  private emptyForm() {
    return {
      title: '',
      slug: '',
      story_type: 'student_success',
      person_name: '',
      person_role: 'student',
      company: '',
      graduation_year: null,
      linkedin_url: '',
      is_featured: false,
      organization_id: null
    };
  }
}


