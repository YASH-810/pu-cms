import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Page, PagesService, CreatePagePayload, UpdatePagePayload } from '../../services/pages.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';

type StatusFilter = '' | 'draft' | 'review' | 'published' | 'archived' | 'rejected';

type WorkflowAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'unpublish' | 'unarchive';

const WORKFLOW_TRANSITIONS: Record<WorkflowAction, { status: string; label: string; class: string }> = {
  submit: { status: 'review', label: 'Submit for Review', class: 'primary-button' },
  approve: { status: 'published', label: 'Approve & Publish', class: 'success-button' },
  reject: { status: 'rejected', label: 'Reject', class: 'danger-button' },
  publish: { status: 'published', label: 'Publish', class: 'success-button' },
  archive: { status: 'archived', label: 'Archive', class: 'warning-button' },
  unpublish: { status: 'draft', label: 'Unpublish', class: 'ghost-button' },
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

const TEMPLATES = ['default', 'full-width', 'landing', 'sidebar'];

@Component({
  selector: 'app-admin-pages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <!-- ─── Page Header ──────────────────────────────────────────────────── -->
      <header class="page-header">
        <div>
          <p class="eyebrow">Content</p>
          <h1>CMS Pages</h1>
          <p>Create, manage, and publish static pages for your university website.</p>
        </div>
        <button type="button" class="primary-button" (click)="openCreateModal()">
          + New Page
        </button>
      </header>

      <!-- ─── Metrics ──────────────────────────────────────────────────────── -->
      <div class="metric-grid">
        <div class="metric-card">
          <span>Total Pages</span>
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
                placeholder="Search pages by title or slug…"
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearch()"
                id="pages-search"
              />
            </label>
            <label class="select-field">
              <select [(ngModel)]="statusFilter" (ngModelChange)="loadPages()" id="pages-status-filter">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="review">In Review</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
        </div>

        <!-- ─── Table ─────────────────────────────────────────────────────── -->
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Template</th>
                <th>Featured</th>
                <th>Updated</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr>
                  <td colspan="7" class="empty-cell">Loading pages…</td>
                </tr>
              } @else if (pages().length === 0) {
                <tr>
                  <td colspan="7" class="empty-cell">
                    No pages found.
                    <button type="button" class="ghost-button" style="margin-left:10px" (click)="openCreateModal()">Create your first page</button>
                  </td>
                </tr>
              } @else {
                @for (page of pages(); track page.id) {
                  <tr>
                    <td>
                      <div class="page-cell">
                        <strong>{{ page.title }}</strong>
                        @if (page.summary) {
                          <span class="muted">{{ page.summary | slice:0:60 }}{{ page.summary.length > 60 ? '…' : '' }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <code class="slug-pill">{{ page.slug }}</code>
                    </td>
                    <td>
                      <span class="pill" [ngClass]="statusClass(page.status)">{{ page.status }}</span>
                    </td>
                    <td>{{ page.template }}</td>
                    <td>
                      @if (page.is_featured) {
                        <span class="pill pill-active">Featured</span>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td>
                      <span class="muted">{{ page.updated_at | date:'dd MMM yyyy' }}</span>
                    </td>
                    <td class="right">
                      <div class="row-actions">
                        <button type="button" class="ghost-button" (click)="openEditModal(page)" [id]="'edit-page-' + page.id">Edit</button>
                        @for (action of availableActions(page.status); track action) {
                          <button
                            type="button"
                            [class]="workflowClass(action)"
                            (click)="openStatusModal(page, action)"
                            [id]="'action-' + action + '-' + page.id"
                          >{{ workflowLabel(action) }}</button>
                        }
                        @if (page.status !== 'archived') {
                          <button type="button" class="danger-button" (click)="confirmDelete(page)" [id]="'delete-page-' + page.id">Archive</button>
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
            <span>Showing {{ pages().length }} of {{ total() }} pages</span>
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
              <p class="eyebrow">{{ isEditMode() ? 'Update Page' : 'New Page' }}</p>
              <h2>{{ isEditMode() ? form.title || 'Untitled' : 'Create Page' }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
          </header>

          <div class="two-column">
            <label class="form-field">
              <span>Title <em class="required">*</em></span>
              <input
                id="page-title"
                type="text"
                [(ngModel)]="form.title"
                name="title"
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. About the University"
                required
              />
            </label>
            <label class="form-field">
              <span>Slug <em class="required">*</em></span>
              <input
                id="page-slug"
                type="text"
                [(ngModel)]="form.slug"
                name="slug"
                placeholder="e.g. about-the-university"
                required
              />
            </label>
          </div>

          <label class="form-field">
            <span>Summary <span class="muted">(shown in listings &amp; meta fallback)</span></span>
            <textarea id="page-summary" [(ngModel)]="form.summary" name="summary" rows="2" placeholder="Short description of the page…"></textarea>
          </label>

          <label class="form-field" style="flex:1">
            <span>Body Content <span class="muted">(HTML / rich text)</span></span>
            <textarea
              id="page-body"
              [(ngModel)]="form.body_html"
              name="body_html"
              rows="10"
              style="font-family:monospace;font-size:0.86rem;resize:vertical"
              placeholder="&lt;p&gt;Page content goes here…&lt;/p&gt;"
            ></textarea>
          </label>

          <div class="two-column">
            <label class="form-field">
              <span>Template</span>
              <select id="page-template" [(ngModel)]="form.template" name="template">
                @for (tpl of templates; track tpl) {
                  <option [value]="tpl">{{ tpl }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Hero Image URL</span>
              <input id="page-hero" type="url" [(ngModel)]="form.hero_image_url" name="hero_image_url" placeholder="https://…" />
            </label>
          </div>

          <div style="display:flex;gap:20px;margin-top:8px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="page-featured" [(ngModel)]="form.is_featured" name="is_featured" style="width:auto;accent-color:var(--primary-red)" />
              <span style="font-size:0.86rem;font-weight:700;color:#334155">Mark as Featured</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="page-show-nav" [(ngModel)]="form.show_in_nav" name="show_in_nav" style="width:auto;accent-color:var(--primary-red)" />
              <span style="font-size:0.86rem;font-weight:700;color:#334155">Show in Navigation</span>
            </label>
          </div>

          <footer>
            <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (isEditMode() ? 'Save Changes' : 'Create Page') }}
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
            Page: <strong>{{ statusTarget()?.title }}</strong>
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

    code.slug-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 8px;
      background: #f1f5f9;
      color: #475569;
      font-size: 0.78rem;
      font-family: ui-monospace, monospace;
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

    .select-field select { min-width: 160px; }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminPages implements OnInit {
  private readonly pagesService = inject(PagesService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly isEditor = computed(() => {
    const roles = this.auth.context()?.globalRoles?.map(r => r.name) || [];
    return !roles.includes('SUPER_ADMIN') && !roles.includes('UNIVERSITY_ADMIN');
  });

  // ─── State ────────────────────────────────────────────────────────────────
  pages = signal<Page[]>([]);
  total = signal(0);
  loading = signal(false);
  saving = signal(false);

  searchTerm = '';
  statusFilter: StatusFilter = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  // ─── Metrics (counts from current full listing) ───────────────────────────
  publishedCount = signal(0);
  reviewCount = signal(0);

  // ─── Form modal ──────────────────────────────────────────────────────────
  showFormModal = signal(false);
  isEditMode = signal(false);
  editingId = signal<string | null>(null);

  form: {
    title: string;
    slug: string;
    summary: string;
    body_html: string;
    template: string;
    hero_image_url: string;
    is_featured: boolean;
    show_in_nav: boolean;
  } = this.emptyForm();

  readonly templates = TEMPLATES;

  // ─── Status modal ─────────────────────────────────────────────────────────
  showStatusModal = signal(false);
  statusTarget = signal<Page | null>(null);
  pendingAction = signal<WorkflowAction>('submit');
  pendingStatus = signal('');
  statusRemarks = '';

  readonly statusModalTitle = computed(() => {
    const a = this.pendingAction();
    return WORKFLOW_TRANSITIONS[a]?.label ?? 'Confirm';
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadPages();
    this.loadMetrics();
  }

  loadPages() {
    this.loading.set(true);
    this.pagesService.listPages({
      status: this.statusFilter || undefined,
      search: this.searchTerm || undefined,
      limit: this.pageSize,
      offset: this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.pages.set(res.pages);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load pages');
        this.loading.set(false);
      }
    });
  }

  loadMetrics() {
    // Load published/review counts using unfiltered requests
    this.pagesService.listPages({ status: 'published', limit: 1 }).subscribe({
      next: (res) => this.publishedCount.set(res.total)
    });
    this.pagesService.listPages({ status: 'review', limit: 1 }).subscribe({
      next: (res) => this.reviewCount.set(res.total)
    });
  }

  onSearch() {
    this.currentOffset.set(0);
    this.loadPages();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadPages();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadPages();
  }

  // ─── Form modal ──────────────────────────────────────────────────────────
  openCreateModal() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.showFormModal.set(true);
  }

  openEditModal(page: Page) {
    this.isEditMode.set(true);
    this.editingId.set(page.id);
    this.form = {
      title: page.title,
      slug: page.slug,
      summary: page.summary ?? '',
      body_html: page.body_html ?? '',
      template: page.template,
      hero_image_url: page.hero_image_url ?? '',
      is_featured: page.is_featured,
      show_in_nav: page.show_in_nav
    };
    this.showFormModal.set(true);
  }

  closeFormModal() { this.showFormModal.set(false); }

  onTitleChange(title: string) {
    if (!this.isEditMode()) {
      this.form.slug = this.pagesService.slugify(title);
    }
  }

  submitForm() {
    if (!this.form.title.trim() || !this.form.slug.trim()) {
      this.toast.error('Validation', 'Title and slug are required.');
      return;
    }

    this.saving.set(true);

    const payload = {
      title: this.form.title.trim(),
      slug: this.form.slug.trim(),
      summary: this.form.summary.trim() || null,
      body_html: this.form.body_html || null,
      template: this.form.template,
      hero_image_url: this.form.hero_image_url.trim() || null,
      is_featured: this.form.is_featured,
      show_in_nav: this.form.show_in_nav
    };

    const request = this.isEditMode()
      ? this.pagesService.updatePage(this.editingId()!, payload as UpdatePagePayload)
      : this.pagesService.createPage(payload as CreatePagePayload);

    request.subscribe({
      next: () => {
        this.toast.success(this.isEditMode() ? 'Page updated' : 'Page created');
        this.saving.set(false);
        this.closeFormModal();
        this.loadPages();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to save page');
        this.saving.set(false);
      }
    });
  }

  // ─── Status modal ─────────────────────────────────────────────────────────
  openStatusModal(page: Page, action: WorkflowAction) {
    this.statusTarget.set(page);
    this.pendingAction.set(action);
    this.pendingStatus.set(WORKFLOW_TRANSITIONS[action].status);
    this.statusRemarks = '';
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); }

  confirmStatus() {
    const page = this.statusTarget();
    if (!page) return;

    this.saving.set(true);
    this.pagesService.transitionStatus(page.id, this.pendingStatus(), this.statusRemarks || undefined).subscribe({
      next: () => {
        this.toast.success(`Page ${this.pendingStatus()}`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadPages();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Status transition failed');
        this.saving.set(false);
      }
    });
  }

  // ─── Archive / delete ─────────────────────────────────────────────────────
  confirmDelete(page: Page) {
    if (!confirm(`Archive "${page.title}"? It will be hidden from all public views.`)) return;

    this.pagesService.deletePage(page.id).subscribe({
      next: () => {
        this.toast.success('Page archived');
        this.loadPages();
        this.loadMetrics();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to archive page')
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
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
      title: '', slug: '', summary: '', body_html: '',
      template: 'default', hero_image_url: '',
      is_featured: false, show_in_nav: false
    };
  }
}
