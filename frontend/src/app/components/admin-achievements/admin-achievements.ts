import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AchievementsService, Achievement, CreateAchievementPayload, UpdateAchievementPayload } from '../../services/achievements.service';
import { OrganizationService, Organization } from '../../services/organization.service';
import { ToastService } from '../../services/toast.service';

type StatusFilter = '' | 'draft' | 'review' | 'published' | 'archived' | 'rejected';
type WorkflowAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive';

const WORKFLOW_TRANSITIONS: Record<WorkflowAction, { status: string; label: string; class: string }> = {
  submit:    { status: 'review',    label: 'Submit for Review', class: 'primary-button' },
  approve:   { status: 'published', label: 'Approve & Publish', class: 'success-button' },
  reject:    { status: 'rejected',  label: 'Reject',            class: 'danger-button'  },
  publish:   { status: 'published', label: 'Publish',           class: 'success-button' },
  archive:   { status: 'archived',  label: 'Archive',           class: 'warning-button' }
};

function availableActions(status: string): WorkflowAction[] {
  switch (status) {
    case 'draft':     return ['submit'];
    case 'review':    return ['approve', 'reject'];
    case 'published': return ['archive'];
    case 'rejected':  return ['submit'];
    default:          return [];
  }
}

const LEVELS = ['international', 'national', 'state', 'university', 'school'];
const TYPES = ['academic', 'research', 'sports', 'cultural', 'community', 'other'];

@Component({
  selector: 'app-admin-achievements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <!-- ─── Page Header ──────────────────────────────────────────────────── -->
      <header class="page-header">
        <div>
          <p class="eyebrow">Content</p>
          <h1>University Achievements</h1>
          <p>Highlight student, faculty, and institutional awards and accolades.</p>
        </div>
        <button type="button" class="primary-button" (click)="openCreateModal()">
          + New Achievement
        </button>
      </header>

      <!-- ─── Metrics ──────────────────────────────────────────────────────── -->
      <div class="metric-grid">
        <div class="metric-card">
          <span>Total Achievements</span>
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
                placeholder="Search achievements by title, slug or awarded by…"
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearch()"
                id="achievements-search"
              />
            </label>
            <label class="select-field">
              <select [(ngModel)]="statusFilter" (ngModelChange)="loadAchievements()" id="achievements-status-filter">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="review">In Review</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label class="select-field">
              <select [(ngModel)]="levelFilter" (ngModelChange)="loadAchievements()" id="achievements-level-filter">
                <option value="">All Levels</option>
                @for (l of levels; track l) {
                  <option [value]="l">{{ l | titlecase }}</option>
                }
              </select>
            </label>
            <label class="select-field">
              <select [(ngModel)]="typeFilter" (ngModelChange)="loadAchievements()" id="achievements-type-filter">
                <option value="">All Types</option>
                @for (t of types; track t) {
                  <option [value]="t">{{ t | titlecase }}</option>
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
                <th>Achievement</th>
                <th>Type</th>
                <th>Level</th>
                <th>Awarded By / Date</th>
                <th>Prize</th>
                <th>Status</th>
                <th>Featured</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr>
                  <td colspan="8" class="empty-cell">Loading achievements…</td>
                </tr>
              } @else if (achievements().length === 0) {
                <tr>
                  <td colspan="8" class="empty-cell">
                    No achievements found.
                    <button type="button" class="ghost-button" style="margin-left:10px" (click)="openCreateModal()">Add achievement</button>
                  </td>
                </tr>
              } @else {
                @for (ac of achievements(); track ac.id) {
                  <tr>
                    <td>
                      <div class="page-cell">
                        <strong>{{ ac.title }}</strong>
                        <span class="muted font-mono" style="font-size:0.76rem">{{ ac.slug }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="pill pill-draft">{{ ac.achievement_type | titlecase }}</span>
                    </td>
                    <td>{{ ac.level | titlecase }}</td>
                    <td>
                      <div style="font-size:0.84rem">
                        <div>By: {{ ac.awarded_by }}</div>
                        <div class="muted">Date: {{ ac.awarded_at | date:'dd MMM yyyy' }}</div>
                      </div>
                    </td>
                    <td>
                      @if (ac.prize_amount) {
                        {{ ac.prize_amount | currency:'INR':'symbol':'1.0-0' }}
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td>
                      <span class="pill" [ngClass]="statusClass(ac.status)">{{ ac.status }}</span>
                    </td>
                    <td>
                      @if (ac.is_featured) {
                        <span class="pill pill-active">Featured</span>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="right">
                      <div class="row-actions">
                        <button type="button" class="ghost-button" (click)="openEditModal(ac)" [id]="'edit-achievement-' + ac.id">Edit</button>
                        @for (action of availableActions(ac.status); track action) {
                          <button
                            type="button"
                            [class]="workflowClass(action)"
                            (click)="openStatusModal(ac, action)"
                            [id]="'action-' + action + '-' + ac.id"
                          >{{ workflowLabel(action) }}</button>
                        }
                        @if (ac.status !== 'archived') {
                          <button type="button" class="danger-button" (click)="confirmDelete(ac)" [id]="'delete-achievement-' + ac.id">Archive</button>
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
            <span>Showing {{ achievements().length }} of {{ total() }} achievements</span>
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
              <p class="eyebrow">{{ isEditMode() ? 'Update Achievement' : 'New Achievement' }}</p>
              <h2>{{ isEditMode() ? form.title || 'Untitled' : 'Create Achievement' }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
          </header>

          <div class="two-column">
            <label class="form-field">
              <span>Title <em class="required">*</em></span>
              <input
                id="ac-title"
                type="text"
                [(ngModel)]="form.title"
                name="title"
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. Winner of Smart India Hackathon"
                required
              />
            </label>
            <label class="form-field">
              <span>Slug <em class="required">*</em></span>
              <input
                id="ac-slug"
                type="text"
                [(ngModel)]="form.slug"
                name="slug"
                placeholder="e.g. winner-of-smart-india-hackathon"
                required
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Achievement Type <em class="required">*</em></span>
              <select id="ac-type" [(ngModel)]="form.achievement_type" name="achievement_type" required>
                @for (t of types; track t) {
                  <option [value]="t">{{ t | titlecase }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Level <em class="required">*</em></span>
              <select id="ac-level" [(ngModel)]="form.level" name="level" required>
                @for (l of levels; track l) {
                  <option [value]="l">{{ l | titlecase }}</option>
                }
              </select>
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Awarded By <em class="required">*</em></span>
              <input
                id="ac-awarded-by"
                type="text"
                [(ngModel)]="form.awarded_by"
                name="awarded_by"
                placeholder="e.g. Ministry of Education, Govt of India"
                required
              />
            </label>
            <label class="form-field">
              <span>Awarded Date <em class="required">*</em></span>
              <input id="ac-awarded-at" type="date" [(ngModel)]="form.awarded_at" name="awarded_at" required />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Prize Amount (INR)</span>
              <input
                id="ac-prize-amount"
                type="number"
                min="0"
                [(ngModel)]="form.prize_amount"
                name="prize_amount"
                placeholder="e.g. 100000"
              />
            </label>
            <label class="form-field">
              <span>Primary Institution / Organization</span>
              <select id="ac-org" [(ngModel)]="form.organization_id" name="organization_id" [disabled]="isEditMode()">
                <option [value]="null">Select Organization</option>
                @for (org of activeOrgs(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </label>
          </div>

          <div style="display:flex;gap:20px;align-items:center;margin-top:8px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="ac-featured" [(ngModel)]="form.is_featured" name="is_featured" style="width:auto;accent-color:#2563eb" />
              <span style="font-size:0.86rem;font-weight:700;color:#334155">Mark as Featured Achievement</span>
            </label>
          </div>

          <footer>
            <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (isEditMode() ? 'Save Changes' : 'Create Achievement') }}
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
            Achievement: <strong>{{ statusTarget()?.title }}</strong>
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
export class AdminAchievements implements OnInit {
  private readonly achievementsService = inject(AchievementsService);
  private readonly orgService = inject(OrganizationService);
  private readonly toast = inject(ToastService);

  // ─── State ────────────────────────────────────────────────────────────────
  achievements  = signal<Achievement[]>([]);
  total         = signal(0);
  loading       = signal(false);
  saving        = signal(false);

  searchTerm    = '';
  statusFilter: StatusFilter = '';
  levelFilter   = '';
  typeFilter    = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  // ─── Metrics ─────────────────────────────────────────────────────────────
  publishedCount = signal(0);
  reviewCount    = signal(0);

  // ─── Metadata options ────────────────────────────────────────────────────
  activeOrgs = signal<Organization[]>([]);
  readonly levels = LEVELS;
  readonly types = TYPES;

  // ─── Form modal state ───────────────────────────────────────────────────
  showFormModal = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);

  form: {
    title: string;
    slug: string;
    achievement_type: string;
    level: string;
    awarded_at: string;
    awarded_by: string;
    prize_amount: number | null;
    is_featured: boolean;
    organization_id: string | null;
  } = this.emptyForm();

  // ─── Status modal state ─────────────────────────────────────────────────
  showStatusModal = signal(false);
  statusTarget    = signal<Achievement | null>(null);
  pendingAction   = signal<WorkflowAction>('submit');
  pendingStatus   = signal('');
  statusRemarks   = '';

  readonly statusModalTitle = computed(() => {
    const a = this.pendingAction();
    return WORKFLOW_TRANSITIONS[a]?.label ?? 'Confirm';
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadAchievements();
    this.loadMetadata();
    this.loadMetrics();
  }

  loadAchievements() {
    this.loading.set(true);
    this.achievementsService.listAchievements({
      status:           this.statusFilter || undefined,
      achievement_type: this.typeFilter || undefined,
      level:            this.levelFilter || undefined,
      search:           this.searchTerm || undefined,
      limit:            this.pageSize,
      offset:           this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.achievements.set(res.achievements);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load achievements');
        this.loading.set(false);
      }
    });
  }

  loadMetrics() {
    this.achievementsService.listAchievements({ status: 'published', limit: 1 }).subscribe({
      next: (res) => this.publishedCount.set(res.total)
    });
    this.achievementsService.listAchievements({ status: 'review', limit: 1 }).subscribe({
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
    this.loadAchievements();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadAchievements();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadAchievements();
  }

  // ─── Form modal controls ───────────────────────────────────────────────
  openCreateModal() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form = this.emptyForm();
    const today = new Date();
    this.form.awarded_at = today.toISOString().split('T')[0];
    this.showFormModal.set(true);
  }

  openEditModal(ac: Achievement) {
    this.isEditMode.set(true);
    this.editingId.set(ac.id);

    this.form = {
      title:            ac.title,
      slug:             ac.slug,
      achievement_type: ac.achievement_type,
      level:            ac.level,
      awarded_at:       ac.awarded_at ? ac.awarded_at.split('T')[0] : '',
      awarded_by:       ac.awarded_by,
      prize_amount:     ac.prize_amount,
      is_featured:      ac.is_featured,
      organization_id:  null
    };
    this.showFormModal.set(true);
  }

  closeFormModal() { this.showFormModal.set(false); }

  onTitleChange(title: string) {
    if (!this.isEditMode()) {
      this.form.slug = this.achievementsService.slugify(title);
    }
  }

  submitForm() {
    if (!this.form.title.trim() || !this.form.slug.trim()) {
      this.toast.error('Validation Error', 'Title and slug are required.');
      return;
    }
    if (!this.form.achievement_type || !this.form.level || !this.form.awarded_by.trim() || !this.form.awarded_at) {
      this.toast.error('Validation Error', 'Type, level, awarded by, and date are required.');
      return;
    }

    this.saving.set(true);

    const payload = {
      title:            this.form.title.trim(),
      slug:             this.form.slug.trim(),
      achievement_type: this.form.achievement_type,
      level:            this.form.level,
      awarded_at:       new Date(this.form.awarded_at).toISOString(),
      awarded_by:       this.form.awarded_by.trim(),
      prize_amount:     this.form.prize_amount,
      is_featured:      this.form.is_featured
    };

    if (this.isEditMode()) {
      this.achievementsService.updateAchievement(this.editingId()!, payload as UpdateAchievementPayload).subscribe({
        next: () => {
          this.toast.success('Achievement updated');
          this.saving.set(false);
          this.closeFormModal();
          this.loadAchievements();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to update achievement');
          this.saving.set(false);
        }
      });
    } else {
      const createPayload: CreateAchievementPayload = {
        ...payload,
        organization_ids: this.form.organization_id ? [this.form.organization_id] : []
      };

      this.achievementsService.createAchievement(createPayload).subscribe({
        next: () => {
          this.toast.success('Achievement created');
          this.saving.set(false);
          this.closeFormModal();
          this.loadAchievements();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to create achievement');
          this.saving.set(false);
        }
      });
    }
  }

  // ─── Status Workflow controls ──────────────────────────────────────────
  openStatusModal(ac: Achievement, action: WorkflowAction) {
    this.statusTarget.set(ac);
    this.pendingAction.set(action);
    this.pendingStatus.set(WORKFLOW_TRANSITIONS[action].status);
    this.statusRemarks = '';
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); }

  confirmStatus() {
    const ac = this.statusTarget();
    if (!ac) return;

    this.saving.set(true);
    this.achievementsService.transitionStatus(ac.id, this.pendingStatus(), this.statusRemarks || undefined).subscribe({
      next: () => {
        this.toast.success(`Achievement ${this.pendingStatus()}`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadAchievements();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Status transition failed');
        this.saving.set(false);
      }
    });
  }

  // ─── Archive / Delete ───────────────────────────────────────────────────
  confirmDelete(ac: Achievement) {
    if (!confirm(`Archive "${ac.title}"? It will be hidden from all public lists.`)) return;

    this.achievementsService.deleteAchievement(ac.id).subscribe({
      next: () => {
        this.toast.success('Achievement archived');
        this.loadAchievements();
        this.loadMetrics();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to archive achievement')
    });
  }

  // ─── Helper utilities ──────────────────────────────────────────────────
  availableActions(status: string): WorkflowAction[] {
    return availableActions(status);
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
      achievement_type: 'academic',
      level: 'university',
      awarded_at: '',
      awarded_by: '',
      prize_amount: null,
      is_featured: false,
      organization_id: null
    };
  }
}
