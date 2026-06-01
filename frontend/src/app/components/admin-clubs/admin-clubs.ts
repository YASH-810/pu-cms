import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClubsService, Club, CreateClubPayload, UpdateClubPayload } from '../../services/clubs.service';
import { OrganizationService, Organization } from '../../services/organization.service';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

type StatusFilter = '' | 'draft' | 'review' | 'published' | 'archived' | 'rejected';
type WorkflowAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'unarchive';

const WORKFLOW_TRANSITIONS: Record<WorkflowAction, { status: string; label: string; class: string }> = {
  submit: { status: 'review', label: 'Submit for Review', class: 'primary-button' },
  approve: { status: 'published', label: 'Approve & Publish', class: 'success-button' },
  reject: { status: 'rejected', label: 'Reject', class: 'danger-button' },
  publish: { status: 'published', label: 'Publish', class: 'success-button' },
  archive: { status: 'archived', label: 'Archive', class: 'warning-button' },
  unarchive: { status: 'draft', label: 'Unarchive', class: 'ghost-button' }
};

function availableActions(status: string): WorkflowAction[] {
  switch (status) {
    case 'draft': return ['submit'];
    case 'review': return ['approve', 'reject'];
    case 'published': return ['archive'];
    case 'rejected': return ['submit'];
    case 'archived': return ['unarchive'];
    default: return [];
  }
}

@Component({
  selector: 'app-admin-clubs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
        <!-- ─── Page Header ──────────────────────────────────────────────────── -->
        <header class="page-header">
          <div>
            <p class="eyebrow">Governance</p>
            <h1>Clubs &amp; Societies</h1>
            <p>Create and manage university student clubs, executive committees, and schedules.</p>
          </div>
          <button type="button" class="primary-button" (click)="openCreateModal()">
            + New Club
          </button>
        </header>

        <!-- ─── Metrics ──────────────────────────────────────────────────────── -->
        <div class="metric-grid">
          <div class="metric-card">
            <span>Total Clubs</span>
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
                  placeholder="Search clubs by name or organization…"
                  [(ngModel)]="searchTerm"
                  (ngModelChange)="onSearch()"
                  id="clubs-search"
                />
              </label>
              <label class="select-field">
                <select [(ngModel)]="statusFilter" (ngModelChange)="loadClubs()" id="clubs-status-filter">
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="review">In Review</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label class="select-field">
                <select [(ngModel)]="orgFilter" (ngModelChange)="loadClubs()" id="clubs-org-filter">
                  <option value="">All Organizations</option>
                  @for (org of activeOrgs(); track org.id) {
                    <option [value]="org.id">{{ org.name }}</option>
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
                  <th>Club Name</th>
                  <th>Linked Organization</th>
                  <th>President</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="7" class="empty-cell">Loading clubs…</td>
                  </tr>
                } @else if (clubs().length === 0) {
                  <tr>
                    <td colspan="7" class="empty-cell">
                      No clubs found.
                      <button type="button" class="ghost-button" style="margin-left:10px" (click)="openCreateModal()">Register first club</button>
                    </td>
                  </tr>
                } @else {
                  @for (cl of clubs(); track cl.id) {
                    <tr>
                      <td>
                        <div class="page-cell">
                          <strong>{{ cl.title }}</strong>
                          <span class="muted font-mono" style="font-size:0.76rem">{{ cl.slug }}</span>
                        </div>
                      </td>
                      <td>{{ cl.organization_name }}</td>
                      <td>
                        @if (cl.leadership && cl.leadership['president']) {
                          {{ cl.leadership['president'] }}
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td>
                        <span class="muted" style="font-size:0.84rem">{{ cl.meeting_schedule || '—' }}</span>
                      </td>
                      <td>
                        <span class="pill" [ngClass]="statusClass(cl.status)">{{ cl.status }}</span>
                      </td>
                      <td>
                        <span class="muted">{{ cl.updated_at | date:'dd MMM yyyy' }}</span>
                      </td>
                      <td class="right">
                        <div class="dropdown">
                          <button type="button" class="ghost-button" (click)="toggleRowDropdown(cl.id)">...</button>
                          @if (activeRowDropdown() === cl.id) {
                            <div class="dropdown-menu">
                              <button type="button" (click)="openEditModal(cl); toggleRowDropdown(cl.id)" [id]="'edit-club-' + cl.id">Edit</button>
                              @for (action of availableActions(cl.status); track action) {
                                <button
                                  type="button"
                                  (click)="openStatusModal(cl, action); toggleRowDropdown(cl.id)"
                                  [id]="'action-' + action + '-' + cl.id"
                                >{{ workflowLabel(action) }}</button>
                              }
                              @if (cl.status !== 'archived') {
                                <button type="button" style="color:var(--color-danger)" (click)="confirmDelete(cl); toggleRowDropdown(cl.id)" [id]="'delete-club-' + cl.id">Archive</button>
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
              <span>Showing {{ clubs().length }} of {{ total() }} clubs</span>
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
              <p class="eyebrow">{{ isEditMode() ? 'Update Club Profile' : 'New Club' }}</p>
              <h2>{{ isEditMode() ? form.title || 'Untitled' : 'Register Club' }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
          </header>

          <div class="two-column">
            <label class="form-field">
              <span>Club Name <em class="required">*</em></span>
              <input
                id="cl-title"
                type="text"
                [(ngModel)]="form.title"
                name="title"
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. Photography Club"
                required
              />
            </label>
            <label class="form-field">
              <span>Slug <em class="required">*</em></span>
              <input
                id="cl-slug"
                type="text"
                [(ngModel)]="form.slug"
                name="slug"
                placeholder="e.g. photography-club"
                required
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Linked Organization / Department <em class="required">*</em></span>
              <select id="cl-org" [(ngModel)]="form.organization_id" name="organization_id" required [disabled]="isEditMode()">
                <option [value]="''">Select Organization</option>
                @for (org of activeOrgs(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Meeting Schedule</span>
              <input
                id="cl-schedule"
                type="text"
                [(ngModel)]="form.meeting_schedule"
                name="meeting_schedule"
                placeholder="e.g. Every Friday, 4 PM to 6 PM"
              />
            </label>
          </div>

          <label class="form-field">
            <span>How to Join / Process</span>
            <textarea
              id="cl-joining"
              [(ngModel)]="form.joining_process"
              name="joining_process"
              rows="3"
              placeholder="Describe requirements and application process..."
            ></textarea>
          </label>

          <!-- Leadership Roster (Structured JSONB fields) -->
          <fieldset style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 8px 0 16px">
            <legend style="padding: 0 8px; font-size: 0.86rem; font-weight: 700; color: #475569">Executive Leadership</legend>
            <div class="two-column" style="margin-bottom:0">
              <label class="form-field" style="margin-bottom:0">
                <span>President Name</span>
                <input id="cl-president" type="text" [(ngModel)]="form.president" name="president" placeholder="e.g. Alice Smith" />
              </label>
              <label class="form-field" style="margin-bottom:0">
                <span>Secretary Name</span>
                <input id="cl-secretary" type="text" [(ngModel)]="form.secretary" name="secretary" placeholder="e.g. Bob Johnson" />
              </label>
            </div>
            <div style="margin-top: 12px">
              <label class="form-field" style="margin-bottom:0">
                <span>Faculty Advisor / Coordinator</span>
                <input id="cl-advisor" type="text" [(ngModel)]="form.advisor" name="advisor" placeholder="e.g. Dr. Sarah Lee" />
              </label>
            </div>
          </fieldset>

          <!-- Social Links (Structured JSONB fields) -->
          <fieldset style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 0 0 16px">
            <legend style="padding: 0 8px; font-size: 0.86rem; font-weight: 700; color: #475569">Social &amp; Web Links</legend>
            <div class="two-column" style="margin-bottom:0">
              <label class="form-field" style="margin-bottom:0">
                <span>Instagram URL</span>
                <input id="cl-insta" type="url" [(ngModel)]="form.insta_url" name="insta_url" placeholder="https://instagram.com/…" />
              </label>
              <label class="form-field" style="margin-bottom:0">
                <span>Facebook Page URL</span>
                <input id="cl-fb" type="url" [(ngModel)]="form.facebook_url" name="facebook_url" placeholder="https://facebook.com/…" />
              </label>
            </div>
          </fieldset>

          <footer>
            <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (isEditMode() ? 'Save Changes' : 'Register Club') }}
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
            Club: <strong>{{ statusTarget()?.title }}</strong>
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
export class AdminClubs implements OnInit {
  private readonly clubsService = inject(ClubsService);
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
  clubs = signal<Club[]>([]);
  total = signal(0);
  loading = signal(false);
  saving = signal(false);

  searchTerm = '';
  statusFilter: StatusFilter = '';
  orgFilter = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  // ─── Metrics ─────────────────────────────────────────────────────────────
  publishedCount = signal(0);
  reviewCount = signal(0);

  // ─── Metadata options ────────────────────────────────────────────────────
  activeOrgs = signal<Organization[]>([]);

  // ─── Form modal state ───────────────────────────────────────────────────
  showFormModal = signal(false);
  isEditMode = signal(false);
  editingId = signal<string | null>(null);

  form: {
    title: string;
    slug: string;
    organization_id: string;
    meeting_schedule: string;
    joining_process: string;
    president: string;
    secretary: string;
    advisor: string;
    insta_url: string;
    facebook_url: string;
  } = this.emptyForm();

  // ─── Status modal state ─────────────────────────────────────────────────
  showStatusModal = signal(false);
  statusTarget = signal<Club | null>(null);
  pendingAction = signal<WorkflowAction>('submit');
  pendingStatus = signal('');
  statusRemarks = '';
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
    this.loadClubs();
    this.loadMetadata();
    this.loadMetrics();

    this.route.queryParams.subscribe(params => {
      if (params['create']) {
        this.openCreateModal();
      } else if (params['edit']) {
        this.clubsService.getClub(params['edit']).subscribe({
          next: (cl) => this.openEditModal(cl),
          error: (err) => this.toast.error('Error', 'Failed to load club for editing')
        });
      }
    });
  }

  loadClubs() {
    this.loading.set(true);
    this.clubsService.listClubs({
      status: this.statusFilter || undefined,
      organization_id: this.orgFilter || undefined,
      search: this.searchTerm || undefined,
      limit: this.pageSize,
      offset: this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.clubs.set(res.clubs);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load clubs');
        this.loading.set(false);
      }
    });
  }

  loadMetrics() {
    this.clubsService.listClubs({ status: 'published', limit: 1 }).subscribe({
      next: (res) => this.publishedCount.set(res.total)
    });
    this.clubsService.listClubs({ status: 'review', limit: 1 }).subscribe({
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
    this.loadClubs();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadClubs();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadClubs();
  }

  // ─── Form modal controls ───────────────────────────────────────────────
  openCreateModal() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.showFormModal.set(true);
  }

  openEditModal(cl: Club) {
    this.isEditMode.set(true);
    this.editingId.set(cl.id);

    this.form = {
      title: cl.title,
      slug: cl.slug,
      organization_id: cl.organization_id,
      meeting_schedule: cl.meeting_schedule ?? '',
      joining_process: cl.joining_process ?? '',
      president: cl.leadership ? (cl.leadership['president'] as string || '') : '',
      secretary: cl.leadership ? (cl.leadership['secretary'] as string || '') : '',
      advisor: cl.leadership ? (cl.leadership['advisor'] as string || '') : '',
      insta_url: cl.social_links ? (cl.social_links['instagram'] as string || '') : '',
      facebook_url: cl.social_links ? (cl.social_links['facebook'] as string || '') : ''
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
      this.form.slug = this.clubsService.slugify(title);
    }
  }

  submitForm() {
    if (!this.form.title.trim() || !this.form.slug.trim()) {
      this.toast.error('Validation Error', 'Club Name and slug are required.');
      return;
    }
    if (!this.form.organization_id) {
      this.toast.error('Validation Error', 'Linked Organization is required.');
      return;
    }

    this.saving.set(true);

    const leadership: Record<string, string> = {};
    if (this.form.president.trim()) leadership['president'] = this.form.president.trim();
    if (this.form.secretary.trim()) leadership['secretary'] = this.form.secretary.trim();
    if (this.form.advisor.trim()) leadership['advisor'] = this.form.advisor.trim();

    const socialLinks: Record<string, string> = {};
    if (this.form.insta_url.trim()) socialLinks['instagram'] = this.form.insta_url.trim();
    if (this.form.facebook_url.trim()) socialLinks['facebook'] = this.form.facebook_url.trim();

    const payload = {
      title: this.form.title.trim(),
      slug: this.form.slug.trim(),
      organization_id: this.form.organization_id,
      meeting_schedule: this.form.meeting_schedule.trim() || null,
      joining_process: this.form.joining_process.trim() || null,
      leadership: Object.keys(leadership).length > 0 ? leadership : null,
      social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null
    };

    if (this.isEditMode()) {
      this.clubsService.updateClub(this.editingId()!, payload as UpdateClubPayload).subscribe({
        next: () => {
          this.toast.success('Club updated');
          this.saving.set(false);
          this.closeFormModal();
          this.loadClubs();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to update club');
          this.saving.set(false);
        }
      });
    } else {
      this.clubsService.createClub(payload as CreateClubPayload).subscribe({
        next: () => {
          this.toast.success('Club created');
          this.saving.set(false);
          this.closeFormModal();
          this.loadClubs();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to register club');
          this.saving.set(false);
        }
      });
    }
  }

  // ─── Status Workflow controls ──────────────────────────────────────────
  openStatusModal(cl: Club, action: WorkflowAction) {
    this.statusTarget.set(cl);
    this.pendingAction.set(action);
    this.pendingStatus.set(WORKFLOW_TRANSITIONS[action].status);
    this.statusRemarks = '';
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); }

  confirmStatus() {
    const cl = this.statusTarget();
    if (!cl) return;

    this.saving.set(true);
    this.clubsService.transitionStatus(cl.id, this.pendingStatus(), this.statusRemarks || undefined).subscribe({
      next: () => {
        this.toast.success(`Club ${this.pendingStatus()}`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadClubs();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Status transition failed');
        this.saving.set(false);
      }
    });
  }

  // ─── Archive / Delete ───────────────────────────────────────────────────
  confirmDelete(cl: Club) {
    if (!confirm(`Archive "${cl.title}"? It will be hidden from all public lists.`)) return;

    this.clubsService.deleteClub(cl.id).subscribe({
      next: () => {
        this.toast.success('Club archived');
        this.loadClubs();
        this.loadMetrics();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to archive club')
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
      case 'draft': return 'pill pill-draft';
      case 'review': return 'pill pill-review';
      case 'rejected': return 'pill pill-rejected';
      case 'archived': return 'pill';
      default: return 'pill';
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
      organization_id: '',
      meeting_schedule: '',
      joining_process: '',
      president: '',
      secretary: '',
      advisor: '',
      insta_url: '',
      facebook_url: ''
    };
  }
}
