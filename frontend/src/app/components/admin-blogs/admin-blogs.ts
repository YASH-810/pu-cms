import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Blog, BlogsService, CreateBlogPayload, UpdateBlogPayload } from '../../services/blogs.service';
import { UserService, User } from '../../services/user.service';
import { OrganizationService, Organization } from '../../services/organization.service';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

type StatusFilter = '' | 'draft' | 'review' | 'published' | 'archived' | 'rejected';

type WorkflowAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'unpublish';

const WORKFLOW_TRANSITIONS: Record<WorkflowAction, { status: string; label: string; class: string }> = {
  submit:    { status: 'review',    label: 'Submit for Review', class: 'primary-button' },
  approve:   { status: 'published', label: 'Approve & Publish', class: 'success-button' },
  reject:    { status: 'rejected',  label: 'Reject',            class: 'danger-button'  },
  publish:   { status: 'published', label: 'Publish',           class: 'success-button' },
  archive:   { status: 'archived',  label: 'Archive',           class: 'warning-button' },
  unpublish: { status: 'draft',     label: 'Unpublish',         class: 'ghost-button'   }
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

@Component({
  selector: 'app-admin-blogs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
        <!-- ─── Page Header ──────────────────────────────────────────────────── -->
        <header class="page-header">
          <div>
            <p class="eyebrow">Content</p>
            <h1>Blogs &amp; News</h1>
            <p>Create, manage, and publish news articles and institutional blogs.</p>
          </div>
          <button type="button" class="primary-button" (click)="openCreateModal()">
            + New Article
          </button>
        </header>

        <!-- ─── Metrics ──────────────────────────────────────────────────────── -->
        <div class="metric-grid">
          <div class="metric-card">
            <span>Total Articles</span>
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
                  placeholder="Search articles by title or slug…"
                  [(ngModel)]="searchTerm"
                  (ngModelChange)="onSearch()"
                  id="blogs-search"
                />
              </label>
              <label class="select-field">
                <select [(ngModel)]="statusFilter" (ngModelChange)="loadBlogs()" id="blogs-status-filter">
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
                  <th>Article</th>
                  <th>Author</th>
                  <th>Status</th>
                  <th>Read Time</th>
                  <th>Pinned / Featured</th>
                  <th>Updated</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="7" class="empty-cell">Loading articles…</td>
                  </tr>
                } @else if (blogs().length === 0) {
                  <tr>
                    <td colspan="7" class="empty-cell">
                      No articles found.
                      <button type="button" class="ghost-button" style="margin-left:10px" (click)="openCreateModal()">Create your first article</button>
                    </td>
                  </tr>
                } @else {
                  @for (blog of blogs(); track blog.id) {
                    <tr>
                      <td>
                        <div class="page-cell">
                          <strong>{{ blog.title }}</strong>
                          <span class="muted font-mono" style="font-size:0.76rem">{{ blog.slug }}</span>
                        </div>
                      </td>
                      <td>
                        {{ blog.author_name || 'System' }}
                      </td>
                      <td>
                        <span class="pill" [ngClass]="statusClass(blog.status)">{{ blog.status }}</span>
                      </td>
                      <td>{{ blog.reading_time }} min</td>
                      <td>
                        <div style="display:flex;gap:6px">
                          @if (blog.is_pinned) {
                            <span class="pill pill-pinned">Pinned</span>
                          }
                          @if (blog.is_featured) {
                            <span class="pill pill-active">Featured</span>
                          }
                          @if (!blog.is_pinned && !blog.is_featured) {
                            <span class="muted">—</span>
                          }
                        </div>
                      </td>
                      <td>
                        <span class="muted">{{ blog.updated_at | date:'dd MMM yyyy' }}</span>
                      </td>
                      <td class="right">
                        <div class="dropdown">
                          <button type="button" class="ghost-button" (click)="toggleRowDropdown(blog.id)">...</button>
                          @if (activeRowDropdown() === blog.id) {
                            <div class="dropdown-menu">
                              <button type="button" (click)="openEditModal(blog); toggleRowDropdown(blog.id)" [id]="'edit-blog-' + blog.id">Edit</button>
                              @for (action of availableActions(blog.status); track action) {
                                <button
                                  type="button"
                                  (click)="openStatusModal(blog, action); toggleRowDropdown(blog.id)"
                                  [id]="'action-' + action + '-' + blog.id"
                                >{{ workflowLabel(action) }}</button>
                              }
                              @if (blog.status !== 'archived') {
                                <button type="button" style="color:var(--color-danger)" (click)="confirmDelete(blog); toggleRowDropdown(blog.id)" [id]="'delete-blog-' + blog.id">Archive</button>
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
              <span>Showing {{ blogs().length }} of {{ total() }} articles</span>
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
              <p class="eyebrow">{{ isEditMode() ? 'Update Article' : 'New Article' }}</p>
              <h2>{{ isEditMode() ? form.title || 'Untitled' : 'Create Article' }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
          </header>

          <div class="two-column">
            <label class="form-field">
              <span>Title <em class="required">*</em></span>
              <input
                id="blog-title"
                type="text"
                [(ngModel)]="form.title"
                name="title"
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. New Research Center Opened"
                required
              />
            </label>
            <label class="form-field">
              <span>Slug <em class="required">*</em></span>
              <input
                id="blog-slug"
                type="text"
                [(ngModel)]="form.slug"
                name="slug"
                placeholder="e.g. new-research-center-opened"
                required
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Author Attribution</span>
              <select id="blog-author" [(ngModel)]="form.author_id" name="author_id">
                <option [value]="null">Select Author (Default: Me)</option>
                @for (user of activeUsers(); track user.id) {
                  <option [value]="user.id">{{ user.full_name }} ({{ user.email }})</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Primary Institution / Organization</span>
              <select id="blog-org" [(ngModel)]="form.organization_id" name="organization_id" [disabled]="isEditMode()">
                <option [value]="null">Select Organization</option>
                @for (org of activeOrgs(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </label>
          </div>

          <label class="form-field">
            <span>Summary <span class="muted">(shown in listings &amp; search fallbacks)</span></span>
            <textarea id="blog-summary" [(ngModel)]="form.summary" name="summary" rows="2" placeholder="Short summary description…"></textarea>
          </label>

          <label class="form-field" style="flex:1">
            <span>Body Content <span class="muted">(HTML / rich text)</span></span>
            <textarea
              id="blog-body"
              [(ngModel)]="form.body_html"
              name="body_html"
              rows="8"
              style="font-family:monospace;font-size:0.86rem;resize:vertical"
              placeholder="&lt;p&gt;Article content goes here…&lt;/p&gt;"
            ></textarea>
          </label>

          <div class="two-column">
            <label class="form-field">
              <span>Hero Image URL</span>
              <input id="blog-hero" type="url" [(ngModel)]="form.hero_image_url" name="hero_image_url" placeholder="https://…" />
            </label>
            <div style="display:flex;gap:20px;align-items:center;margin-top:20px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="blog-featured" [(ngModel)]="form.is_featured" name="is_featured" style="width:auto;accent-color:var(--primary-red)" />
                <span style="font-size:0.86rem;font-weight:700;color:#334155">Mark as Featured</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="blog-pinned" [(ngModel)]="form.is_pinned" name="is_pinned" style="width:auto;accent-color:var(--primary-red)" />
                <span style="font-size:0.86rem;font-weight:700;color:#334155">Pin Article</span>
              </label>
            </div>
          </div>

          <footer>
            <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (isEditMode() ? 'Save Changes' : 'Create Article') }}
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
            Article: <strong>{{ statusTarget()?.title }}</strong>
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

    .select-field select { min-width: 160px; }

    .pill-pinned {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminBlogs implements OnInit {
  private readonly blogsService = inject(BlogsService);
  private readonly userService = inject(UserService);
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
  blogs         = signal<Blog[]>([]);
  total         = signal(0);
  loading       = signal(false);
  saving        = signal(false);

  searchTerm    = '';
  statusFilter: StatusFilter = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  // ─── Metrics (counts from current full listing) ───────────────────────────
  publishedCount = signal(0);
  reviewCount    = signal(0);

  // ─── Lists for selection ─────────────────────────────────────────────────
  activeUsers = signal<User[]>([]);
  activeOrgs  = signal<Organization[]>([]);

  // ─── Form modal ──────────────────────────────────────────────────────────
  showFormModal = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);

  form: {
    title: string;
    slug: string;
    summary: string;
    body_html: string;
    hero_image_url: string;
    author_id: string | null;
    organization_id: string | null;
    is_featured: boolean;
    is_pinned: boolean;
  } = this.emptyForm();

  // ─── Status modal ─────────────────────────────────────────────────────────
  showStatusModal  = signal(false);
  statusTarget     = signal<Blog | null>(null);
  pendingAction    = signal<WorkflowAction>('submit');
  pendingStatus    = signal('');
  statusRemarks    = '';
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
    this.loadBlogs();
    this.loadMetrics();
    this.loadMetadataOptions();

    this.route.queryParams.subscribe(params => {
      if (params['create']) {
        this.openCreateModal();
      } else if (params['edit']) {
        this.blogsService.getBlog(params['edit']).subscribe({
          next: (blog) => this.openEditModal(blog),
          error: (err) => this.toast.error('Error', 'Failed to load article for editing')
        });
      }
    });
  }

  loadBlogs() {
    this.loading.set(true);
    this.blogsService.listBlogs({
      status:  this.statusFilter || undefined,
      search:  this.searchTerm   || undefined,
      limit:   this.pageSize,
      offset:  this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.blogs.set(res.blogs);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load articles');
        this.loading.set(false);
      }
    });
  }

  loadMetrics() {
    this.blogsService.listBlogs({ status: 'published', limit: 1 }).subscribe({
      next: (res) => this.publishedCount.set(res.total)
    });
    this.blogsService.listBlogs({ status: 'review', limit: 1 }).subscribe({
      next: (res) => this.reviewCount.set(res.total)
    });
  }

  loadMetadataOptions() {
    this.userService.listUsers(undefined, true, 1, 100).subscribe({
      next: (res) => this.activeUsers.set(res.users)
    });
    this.orgService.listOrganizations(undefined, true).subscribe({
      next: (res) => this.activeOrgs.set(res)
    });
  }

  onSearch() {
    this.currentOffset.set(0);
    this.loadBlogs();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadBlogs();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadBlogs();
  }

  // ─── Form modal ──────────────────────────────────────────────────────────
  openCreateModal() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.showFormModal.set(true);
  }

  openEditModal(blog: Blog) {
    this.isEditMode.set(true);
    this.editingId.set(blog.id);
    this.form = {
      title:           blog.title,
      slug:            blog.slug,
      summary:         blog.summary ?? '',
      body_html:       blog.body_html ?? '',
      hero_image_url:  blog.hero_image_url ?? '',
      author_id:       blog.author_id,
      organization_id: null, // Scoped org relation cannot be directly edited after creation
      is_featured:     blog.is_featured,
      is_pinned:       blog.is_pinned
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
      this.form.slug = this.blogsService.slugify(title);
    }
  }

  submitForm() {
    if (!this.form.title.trim() || !this.form.slug.trim()) {
      this.toast.error('Validation', 'Title and slug are required.');
      return;
    }

    this.saving.set(true);

    const payload = {
      title:           this.form.title.trim(),
      slug:            this.form.slug.trim(),
      summary:         this.form.summary.trim() || null,
      body_html:       this.form.body_html || null,
      hero_image_url:  this.form.hero_image_url.trim() || null,
      author_id:       this.form.author_id,
      is_featured:     this.form.is_featured,
      is_pinned:       this.form.is_pinned
    };

    if (this.isEditMode()) {
      this.blogsService.updateBlog(this.editingId()!, payload as UpdateBlogPayload).subscribe({
        next: () => {
          this.toast.success('Article updated');
          this.saving.set(false);
          this.closeFormModal();
          this.loadBlogs();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to update article');
          this.saving.set(false);
        }
      });
    } else {
      const createPayload: CreateBlogPayload = {
        ...payload,
        organization_ids: this.form.organization_id ? [this.form.organization_id] : []
      };

      this.blogsService.createBlog(createPayload).subscribe({
        next: () => {
          this.toast.success('Article created');
          this.saving.set(false);
          this.closeFormModal();
          this.loadBlogs();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to create article');
          this.saving.set(false);
        }
      });
    }
  }

  // ─── Status modal ─────────────────────────────────────────────────────────
  openStatusModal(blog: Blog, action: WorkflowAction) {
    this.statusTarget.set(blog);
    this.pendingAction.set(action);
    this.pendingStatus.set(WORKFLOW_TRANSITIONS[action].status);
    this.statusRemarks = '';
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); }

  confirmStatus() {
    const blog = this.statusTarget();
    if (!blog) return;

    this.saving.set(true);
    this.blogsService.transitionStatus(blog.id, this.pendingStatus(), this.statusRemarks || undefined).subscribe({
      next: () => {
        this.toast.success(`Article ${this.pendingStatus()}`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadBlogs();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Status transition failed');
        this.saving.set(false);
      }
    });
  }

  // ─── Archive / delete ─────────────────────────────────────────────────────
  confirmDelete(blog: Blog) {
    if (!confirm(`Archive "${blog.title}"? It will be hidden from all public views.`)) return;

    this.blogsService.deleteBlog(blog.id).subscribe({
      next: () => {
        this.toast.success('Article archived');
        this.loadBlogs();
        this.loadMetrics();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to archive article')
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
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
      title: '', slug: '', summary: '', body_html: '',
      hero_image_url: '', author_id: null, organization_id: null,
      is_featured: false, is_pinned: false
    };
  }
}
