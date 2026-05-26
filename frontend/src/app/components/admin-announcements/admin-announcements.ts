import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnnouncementsService, Announcement, AnnouncementType, CreateAnnouncementPayload, UpdateAnnouncementPayload } from '../../services/announcements.service';
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

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <!-- ─── Page Header ──────────────────────────────────────────────────── -->
      <header class="page-header">
        <div>
          <p class="eyebrow">Content</p>
          <h1>University Announcements</h1>
          <p>Create and manage general notices, PDF circulars, and rich content announcements.</p>
        </div>
        <button type="button" class="primary-button" (click)="openCreateModal()">
          + New Announcement
        </button>
      </header>

      <!-- ─── Metrics ──────────────────────────────────────────────────────── -->
      <div class="metric-grid">
        <div class="metric-card">
          <span>Total Announcements</span>
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
                placeholder="Search announcements by title or slug…"
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearch()"
                id="announcements-search"
              />
            </label>
            <label class="select-field">
              <select [(ngModel)]="statusFilter" (ngModelChange)="loadAnnouncements()" id="announcements-status-filter">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="review">In Review</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label class="select-field">
              <select [(ngModel)]="typeFilter" (ngModelChange)="loadAnnouncements()" id="announcements-type-filter">
                <option value="">All Types</option>
                @for (t of announcementTypes(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </label>
            <label class="select-field">
              <select [(ngModel)]="priorityFilter" (ngModelChange)="loadAnnouncements()" id="announcements-priority-filter">
                <option value="">All Priorities</option>
                @for (p of priorities; track p) {
                  <option [value]="p">{{ p | titlecase }}</option>
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
                <th>Announcement</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Validity Range</th>
                <th>Status</th>
                <th>Updated</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr>
                  <td colspan="7" class="empty-cell">Loading announcements…</td>
                </tr>
              } @else if (announcements().length === 0) {
                <tr>
                  <td colspan="7" class="empty-cell">
                    No announcements found.
                    <button type="button" class="ghost-button" style="margin-left:10px" (click)="openCreateModal()">Create one now</button>
                  </td>
                </tr>
              } @else {
                @for (ann of announcements(); track ann.id) {
                  <tr>
                    <td>
                      <div class="page-cell">
                        <strong>{{ ann.title }}</strong>
                        <span class="muted font-mono" style="font-size:0.76rem">{{ ann.slug }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="pill pill-draft">{{ ann.announcement_type_name }}</span>
                    </td>
                    <td>
                      <span [class]="priorityClass(ann.priority)">{{ ann.priority | uppercase }}</span>
                    </td>
                    <td>
                      <div style="font-size:0.84rem">
                        <div>From: {{ ann.valid_from | date:'dd MMM yyyy, HH:mm' }}</div>
                        <div class="muted">
                          @if (ann.valid_until) {
                            Until: {{ ann.valid_until | date:'dd MMM yyyy, HH:mm' }}
                          } @else {
                            Until: Permanent
                          }
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="pill" [ngClass]="statusClass(ann.status)">{{ ann.status }}</span>
                    </td>
                    <td>
                      <span class="muted">{{ ann.updated_at | date:'dd MMM yyyy' }}</span>
                    </td>
                    <td class="right">
                      <div class="row-actions">
                        <button type="button" class="ghost-button" (click)="openEditModal(ann)" [id]="'edit-announcement-' + ann.id">Edit</button>
                        @for (action of availableActions(ann.status); track action) {
                          <button
                            type="button"
                            [class]="workflowClass(action)"
                            (click)="openStatusModal(ann, action)"
                            [id]="'action-' + action + '-' + ann.id"
                          >{{ workflowLabel(action) }}</button>
                        }
                        @if (ann.status !== 'archived') {
                          <button type="button" class="danger-button" (click)="confirmDelete(ann)" [id]="'delete-announcement-' + ann.id">Archive</button>
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
            <span>Showing {{ announcements().length }} of {{ total() }} announcements</span>
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
              <p class="eyebrow">{{ isEditMode() ? 'Update Announcement' : 'New Announcement' }}</p>
              <h2>{{ isEditMode() ? form.title || 'Untitled' : 'Create Announcement' }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
          </header>

          <div class="two-column">
            <label class="form-field">
              <span>Title <em class="required">*</em></span>
              <input
                id="ann-title"
                type="text"
                [(ngModel)]="form.title"
                name="title"
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. End Semester Exam Schedule"
                required
              />
            </label>
            <label class="form-field">
              <span>Slug <em class="required">*</em></span>
              <input
                id="ann-slug"
                type="text"
                [(ngModel)]="form.slug"
                name="slug"
                placeholder="e.g. end-semester-exam-schedule"
                required
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Announcement Type <em class="required">*</em></span>
              <select id="ann-type" [(ngModel)]="form.announcement_type_id" name="announcement_type_id" [disabled]="isEditMode()" required>
                <option [value]="''">Select Announcement Type</option>
                @for (t of announcementTypes(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Priority <em class="required">*</em></span>
              <select id="ann-priority" [(ngModel)]="form.priority" name="priority" required>
                @for (p of priorities; track p) {
                  <option [value]="p">{{ p | titlecase }}</option>
                }
              </select>
            </label>
          </div>

          <!-- Dynamic content inputs depending on the selected Type -->
          @if (selectedTypeSlug() === 'title_plus_pdf') {
            <label class="form-field">
              <span>PDF Document URL <em class="required">*</em></span>
              <input
                id="ann-pdf-url"
                type="url"
                [(ngModel)]="form.pdf_url"
                name="pdf_url"
                placeholder="https://example.com/documents/circular.pdf"
                required
              />
            </label>
          } @else if (selectedTypeSlug() === 'title_plus_description') {
            <label class="form-field">
              <span>Summary / Description <em class="required">*</em></span>
              <textarea
                id="ann-summary"
                [(ngModel)]="form.summary"
                name="summary"
                rows="4"
                placeholder="Write a brief description or notice text here…"
                required
              ></textarea>
            </label>
          } @else if (selectedTypeSlug() === 'full_content') {
            <label class="form-field">
              <span>Rich Content (HTML) <em class="required">*</em></span>
              <textarea
                id="ann-body-html"
                [(ngModel)]="form.body_html"
                name="body_html"
                rows="8"
                placeholder="<p>Write your detailed announcement body here with HTML formatting...</p>"
                required
              ></textarea>
            </label>
          }

          <div class="two-column">
            <label class="form-field">
              <span>Primary Institution / Organization</span>
              <select id="ann-org" [(ngModel)]="form.organization_id" name="organization_id" [disabled]="isEditMode()">
                <option [value]="null">Select Organization</option>
                @for (org of activeOrgs(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </label>
            <div style="display:flex;align-items:center;padding-top:20px">
              <span class="muted" style="font-size:0.84rem">
                Note: Types determine template visualization for public viewers.
              </span>
            </div>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Valid From <em class="required">*</em></span>
              <input id="ann-valid-from" type="datetime-local" [(ngModel)]="form.valid_from" name="valid_from" required />
            </label>
            <label class="form-field">
              <span>Valid Until <span class="muted">(Leave blank for permanent)</span></span>
              <input id="ann-valid-until" type="datetime-local" [(ngModel)]="form.valid_until" name="valid_until" />
            </label>
          </div>

          <footer>
            <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (isEditMode() ? 'Save Changes' : 'Create Announcement') }}
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
            Announcement: <strong>{{ statusTarget()?.title }}</strong>
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

    /* Custom Priority pills styling using existing status palette or HSL */
    .pill-priority-critical {
      background: #ffe4e6;
      color: #e11d48;
      font-weight: 800;
      border: 1px solid #fecdd3;
    }
    .pill-priority-high {
      background: #ffedd5;
      color: #ea580c;
      font-weight: 700;
      border: 1px solid #fed7aa;
    }
    .pill-priority-medium {
      background: #e0f2fe;
      color: #0284c7;
      font-weight: 600;
      border: 1px solid #bae6fd;
    }
    .pill-priority-low {
      background: #f1f5f9;
      color: #64748b;
      font-weight: 500;
      border: 1px solid #e2e8f0;
    }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminAnnouncements implements OnInit {
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly orgService = inject(OrganizationService);
  private readonly toast = inject(ToastService);

  // ─── State ────────────────────────────────────────────────────────────────
  announcements    = signal<Announcement[]>([]);
  total            = signal(0);
  loading          = signal(false);
  saving           = signal(false);

  searchTerm       = '';
  statusFilter: StatusFilter = '';
  typeFilter       = '';
  priorityFilter   = '';
  currentOffset    = signal(0);
  readonly pageSize = 20;

  // ─── Metrics ─────────────────────────────────────────────────────────────
  publishedCount = signal(0);
  reviewCount    = signal(0);

  // ─── Metadata lists ──────────────────────────────────────────────────────
  announcementTypes = signal<AnnouncementType[]>([]);
  activeOrgs        = signal<Organization[]>([]);
  readonly priorities = PRIORITIES;

  // ─── Form modal state ───────────────────────────────────────────────────
  showFormModal = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);

  form: {
    title: string;
    slug: string;
    announcement_type_id: string;
    summary: string;
    body_html: string;
    pdf_url: string;
    priority: string;
    organization_id: string | null;
    valid_from: string;
    valid_until: string;
  } = this.emptyForm();

  // Computed field helper to find slug of currently selected type
  selectedTypeSlug = computed(() => {
    const selectedId = this.form.announcement_type_id;
    if (!selectedId) return '';
    const match = this.announcementTypes().find(x => x.id === selectedId);
    return match ? match.slug : '';
  });

  // ─── Status modal state ─────────────────────────────────────────────────
  showStatusModal = signal(false);
  statusTarget    = signal<Announcement | null>(null);
  pendingAction   = signal<WorkflowAction>('submit');
  pendingStatus   = signal('');
  statusRemarks   = '';

  readonly statusModalTitle = computed(() => {
    const a = this.pendingAction();
    return WORKFLOW_TRANSITIONS[a]?.label ?? 'Confirm';
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadAnnouncements();
    this.loadMetadata();
    this.loadMetrics();
  }

  loadAnnouncements() {
    this.loading.set(true);
    this.announcementsService.listAnnouncements({
      status:               this.statusFilter || undefined,
      announcement_type_id: this.typeFilter || undefined,
      priority:             this.priorityFilter || undefined,
      search:               this.searchTerm || undefined,
      limit:                this.pageSize,
      offset:               this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.announcements.set(res.announcements);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load announcements');
        this.loading.set(false);
      }
    });
  }

  loadMetrics() {
    this.announcementsService.listAnnouncements({ status: 'published', limit: 1 }).subscribe({
      next: (res) => this.publishedCount.set(res.total)
    });
    this.announcementsService.listAnnouncements({ status: 'review', limit: 1 }).subscribe({
      next: (res) => this.reviewCount.set(res.total)
    });
  }

  loadMetadata() {
    this.announcementsService.listAnnouncementTypes().subscribe({
      next: (res) => this.announcementTypes.set(res)
    });
    this.orgService.listOrganizations(undefined, true).subscribe({
      next: (res) => this.activeOrgs.set(res)
    });
  }

  onSearch() {
    this.currentOffset.set(0);
    this.loadAnnouncements();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadAnnouncements();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadAnnouncements();
  }

  // ─── Form modal controls ───────────────────────────────────────────────
  openCreateModal() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form = this.emptyForm();
    // Default valid_from to local YYYY-MM-DDTHH:MM representation of current time
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.form.valid_from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    this.showFormModal.set(true);
  }

  openEditModal(ann: Announcement) {
    this.isEditMode.set(true);
    this.editingId.set(ann.id);

    const formatInputDate = (isoStr: string | null) => {
      if (!isoStr) return '';
      const date = new Date(isoStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    this.form = {
      title:                ann.title,
      slug:                 ann.slug,
      announcement_type_id: ann.announcement_type_id,
      summary:              ann.summary ?? '',
      body_html:            ann.body_html ?? '',
      pdf_url:              ann.pdf_url ?? '',
      priority:             ann.priority,
      organization_id:      null,
      valid_from:           formatInputDate(ann.valid_from),
      valid_until:          formatInputDate(ann.valid_until)
    };
    this.showFormModal.set(true);
  }

  closeFormModal() { this.showFormModal.set(false); }

  onTitleChange(title: string) {
    if (!this.isEditMode()) {
      this.form.slug = this.announcementsService.slugify(title);
    }
  }

  submitForm() {
    if (!this.form.title.trim() || !this.form.slug.trim()) {
      this.toast.error('Validation Error', 'Title and slug are required.');
      return;
    }
    if (!this.form.announcement_type_id) {
      this.toast.error('Validation Error', 'Announcement type is required.');
      return;
    }
    if (!this.form.valid_from) {
      this.toast.error('Validation Error', 'Validity start date is required.');
      return;
    }

    // Type-specific field validations
    const slug = this.selectedTypeSlug();
    if (slug === 'title_plus_pdf' && !this.form.pdf_url.trim()) {
      this.toast.error('Validation Error', 'PDF circulars require a valid PDF Document URL.');
      return;
    }
    if (slug === 'title_plus_description' && !this.form.summary.trim()) {
      this.toast.error('Validation Error', 'Description announcements require a Summary/Description.');
      return;
    }
    if (slug === 'full_content' && !this.form.body_html.trim()) {
      this.toast.error('Validation Error', 'Full content announcements require Rich Content body (HTML).');
      return;
    }

    // Date range validation
    const fromDate = new Date(this.form.valid_from);
    if (this.form.valid_until) {
      const untilDate = new Date(this.form.valid_until);
      if (fromDate >= untilDate) {
        this.toast.error('Validation Error', 'Validity end date must be after validity start date.');
        return;
      }
    }

    this.saving.set(true);

    const payload: Record<string, any> = {
      title:                this.form.title.trim(),
      slug:                 this.form.slug.trim(),
      announcement_type_id: this.form.announcement_type_id,
      priority:             this.form.priority,
      valid_from:           new Date(this.form.valid_from).toISOString(),
      valid_until:          this.form.valid_until ? new Date(this.form.valid_until).toISOString() : null,
      summary:              slug === 'title_plus_description' ? this.form.summary.trim() : null,
      body_html:            slug === 'full_content' ? this.form.body_html.trim() : null,
      pdf_url:              slug === 'title_plus_pdf' ? this.form.pdf_url.trim() : null
    };

    if (this.isEditMode()) {
      this.announcementsService.updateAnnouncement(this.editingId()!, payload as UpdateAnnouncementPayload).subscribe({
        next: () => {
          this.toast.success('Announcement updated');
          this.saving.set(false);
          this.closeFormModal();
          this.loadAnnouncements();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to update announcement');
          this.saving.set(false);
        }
      });
    } else {
      const createPayload: CreateAnnouncementPayload = {
        ...payload,
        title: this.form.title.trim(),
        slug: this.form.slug.trim(),
        announcement_type_id: this.form.announcement_type_id,
        organization_ids: this.form.organization_id ? [this.form.organization_id] : []
      };

      this.announcementsService.createAnnouncement(createPayload).subscribe({
        next: () => {
          this.toast.success('Announcement created');
          this.saving.set(false);
          this.closeFormModal();
          this.loadAnnouncements();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to create announcement');
          this.saving.set(false);
        }
      });
    }
  }

  // ─── Status Workflow controls ──────────────────────────────────────────
  openStatusModal(ann: Announcement, action: WorkflowAction) {
    this.statusTarget.set(ann);
    this.pendingAction.set(action);
    this.pendingStatus.set(WORKFLOW_TRANSITIONS[action].status);
    this.statusRemarks = '';
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); }

  confirmStatus() {
    const ann = this.statusTarget();
    if (!ann) return;

    this.saving.set(true);
    this.announcementsService.transitionStatus(ann.id, this.pendingStatus(), this.statusRemarks || undefined).subscribe({
      next: () => {
        this.toast.success(`Announcement ${this.pendingStatus()}`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadAnnouncements();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Status transition failed');
        this.saving.set(false);
      }
    });
  }

  // ─── Archive / Delete ───────────────────────────────────────────────────
  confirmDelete(ann: Announcement) {
    if (!confirm(`Archive "${ann.title}"? It will be hidden from all public lists.`)) return;

    this.announcementsService.deleteAnnouncement(ann.id).subscribe({
      next: () => {
        this.toast.success('Announcement archived');
        this.loadAnnouncements();
        this.loadMetrics();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to archive announcement')
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

  priorityClass(p: string): string {
    switch (p) {
      case 'critical': return 'pill pill-priority-critical';
      case 'high':     return 'pill pill-priority-high';
      case 'medium':   return 'pill pill-priority-medium';
      case 'low':      return 'pill pill-priority-low';
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
      announcement_type_id: '',
      summary: '',
      body_html: '',
      pdf_url: '',
      priority: 'medium',
      organization_id: null,
      valid_from: '',
      valid_until: ''
    };
  }
}
