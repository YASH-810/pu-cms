import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Event, EventsService, CreateEventPayload, UpdateEventPayload } from '../../services/events.service';
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

const EVENT_TYPES = ['seminar', 'workshop', 'conference', 'sports', 'cultural', 'academic', 'webinar', 'hackathon', 'other'];

const TIMEZONES = ['Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Singapore'];

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
        <!-- ─── Page Header ──────────────────────────────────────────────────── -->
        <header class="page-header">
          <div>
            <p class="eyebrow">Content</p>
            <h1>University Events</h1>
            <p>Create and manage online, offline, and hybrid university events.</p>
          </div>
          <button type="button" class="primary-button" (click)="openCreateModal()">
            + New Event
          </button>
        </header>

        <!-- ─── Metrics ──────────────────────────────────────────────────────── -->
        <div class="metric-grid">
          <div class="metric-card">
            <span>Total Events</span>
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
                  placeholder="Search events by title or slug…"
                  [(ngModel)]="searchTerm"
                  (ngModelChange)="onSearch()"
                  id="events-search"
                />
              </label>
              <label class="select-field">
                <select [(ngModel)]="statusFilter" (ngModelChange)="loadEvents()" id="events-status-filter">
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="review">In Review</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label class="select-field">
                <select [(ngModel)]="typeFilter" (ngModelChange)="loadEvents()" id="events-type-filter">
                  <option value="">All Types</option>
                  @for (t of eventTypes; track t) {
                    <option [value]="t">{{ t | titlecase }}</option>
                  }
                </select>
              </label>
              <label class="select-field">
                <select [(ngModel)]="modeFilter" (ngModelChange)="loadEvents()" id="events-mode-filter">
                  <option value="">All Modes</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
            </div>
          </div>

          <!-- ─── Table ─────────────────────────────────────────────────────── -->
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th>Updated</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="8" class="empty-cell">Loading events…</td>
                  </tr>
                } @else if (events().length === 0) {
                  <tr>
                    <td colspan="8" class="empty-cell">
                      No events found.
                      <button type="button" class="ghost-button" style="margin-left:10px" (click)="openCreateModal()">Create your first event</button>
                    </td>
                  </tr>
                } @else {
                  @for (event of events(); track event.id) {
                    <tr>
                      <td>
                        <div class="page-cell">
                          <strong>{{ event.title }}</strong>
                          <span class="muted font-mono" style="font-size:0.76rem">{{ event.slug }}</span>
                        </div>
                      </td>
                      <td><span class="pill pill-draft">{{ event.event_type | titlecase }}</span></td>
                      <td>{{ event.event_mode | titlecase }}</td>
                      <td>
                        <div style="font-size:0.84rem">
                          <div>Start: {{ event.start_at | date:'dd MMM yyyy, HH:mm' }}</div>
                          <div class="muted">End: {{ event.end_at | date:'dd MMM yyyy, HH:mm' }}</div>
                        </div>
                      </td>
                      <td>
                        <span class="pill" [ngClass]="statusClass(event.status)">{{ event.status }}</span>
                      </td>
                      <td>
                        @if (event.is_featured) {
                          <span class="pill pill-active">Featured</span>
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td>
                        <span class="muted">{{ event.updated_at | date:'dd MMM yyyy' }}</span>
                      </td>
                      <td class="right">
                        <div class="dropdown">
                          <button type="button" class="ghost-button" (click)="toggleRowDropdown(event.id)">...</button>
                          @if (activeRowDropdown() === event.id) {
                            <div class="dropdown-menu">
                              <button type="button" (click)="openEditModal(event); toggleRowDropdown(event.id)" [id]="'edit-event-' + event.id">Edit</button>
                              @for (action of availableActions(event.status); track action) {
                                <button
                                  type="button"
                                  (click)="openStatusModal(event, action); toggleRowDropdown(event.id)"
                                  [id]="'action-' + action + '-' + event.id"
                                >{{ workflowLabel(action) }}</button>
                              }
                              @if (event.status !== 'archived') {
                                <button type="button" style="color:var(--color-danger)" (click)="confirmDelete(event); toggleRowDropdown(event.id)" [id]="'delete-event-' + event.id">Archive</button>
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
              <span>Showing {{ events().length }} of {{ total() }} events</span>
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
              <p class="eyebrow">{{ isEditMode() ? 'Update Event' : 'New Event' }}</p>
              <h2>{{ isEditMode() ? form.title || 'Untitled' : 'Create Event' }}</h2>
            </div>
            <button type="button" class="icon-close" (click)="closeFormModal()">×</button>
          </header>

          <div class="two-column">
            <label class="form-field">
              <span>Title <em class="required">*</em></span>
              <input
                id="event-title"
                type="text"
                [(ngModel)]="form.title"
                name="title"
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. Annual Sports Meet 2026"
                required
              />
            </label>
            <label class="form-field">
              <span>Slug <em class="required">*</em></span>
              <input
                id="event-slug"
                type="text"
                [(ngModel)]="form.slug"
                name="slug"
                placeholder="e.g. annual-sports-meet-2026"
                required
              />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Event Type <em class="required">*</em></span>
              <select id="event-type" [(ngModel)]="form.event_type" name="event_type" required>
                @for (t of eventTypes; track t) {
                  <option [value]="t">{{ t | titlecase }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Event Mode <em class="required">*</em></span>
              <select id="event-mode" [(ngModel)]="form.event_mode" name="event_mode" required>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
          </div>

          @if (form.event_mode !== 'online') {
            <label class="form-field">
              <span>Venue Description / Physical Location <em class="required">*</em></span>
              <input id="event-venue" type="text" [(ngModel)]="form.venue" name="venue" placeholder="e.g. Main Seminar Hall, Block C" required />
            </label>
          }

          <div class="two-column">
            <label class="form-field">
              <span>Organizer</span>
              <input id="event-organizer" type="text" [(ngModel)]="form.organizer" name="organizer" placeholder="e.g. Dept of Computer Science" />
            </label>
            <label class="form-field">
              <span>Primary Institution / Organization</span>
              <select id="event-org" [(ngModel)]="form.organization_id" name="organization_id" [disabled]="isEditMode()">
                <option [value]="null">Select Organization</option>
                @for (org of activeOrgs(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Start Date &amp; Time <em class="required">*</em></span>
              <input id="event-start" type="datetime-local" [(ngModel)]="form.start_at" name="start_at" required />
            </label>
            <label class="form-field">
              <span>End Date &amp; Time <em class="required">*</em></span>
              <input id="event-end" type="datetime-local" [(ngModel)]="form.end_at" name="end_at" required />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Registration Deadline</span>
              <input id="event-deadline" type="datetime-local" [(ngModel)]="form.registration_deadline_at" name="registration_deadline_at" />
            </label>
            <label class="form-field">
              <span>Timezone</span>
              <select id="event-timezone" [(ngModel)]="form.timezone" name="timezone">
                @for (tz of timezones; track tz) {
                  <option [value]="tz">{{ tz }}</option>
                }
              </select>
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Max Participants</span>
              <input id="event-max-participants" type="number" min="1" [(ngModel)]="form.max_participants" name="max_participants" placeholder="e.g. 100" />
            </label>
            <label class="form-field">
              <span>Registration Link / Form URL</span>
              <input id="event-reg-link" type="url" [(ngModel)]="form.registration_link" name="registration_link" placeholder="https://forms.gle/…" />
            </label>
          </div>

          <div class="two-column">
            <label class="form-field">
              <span>Contact Email</span>
              <input id="event-contact-email" type="email" [(ngModel)]="form.contact_email" name="contact_email" placeholder="e.g. event@pu.edu" />
            </label>
            <label class="form-field">
              <span>Contact Phone</span>
              <input id="event-contact-phone" type="tel" [(ngModel)]="form.contact_phone" name="contact_phone" placeholder="e.g. +91 99999 88888" />
            </label>
          </div>

          <div style="display:flex;gap:20px;align-items:center;margin-top:8px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="event-featured" [(ngModel)]="form.is_featured" name="is_featured" style="width:auto;accent-color:var(--primary-red)" />
              <span style="font-size:0.86rem;font-weight:700;color:#334155">Mark as Featured Event</span>
            </label>
          </div>

          <footer>
            <button type="button" class="ghost-button" (click)="closeFormModal()">Cancel</button>
            <button type="submit" class="primary-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (isEditMode() ? 'Save Changes' : 'Create Event') }}
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
            Event: <strong>{{ statusTarget()?.title }}</strong>
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
export class AdminEvents implements OnInit {
  private readonly eventsService = inject(EventsService);
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
  events        = signal<Event[]>([]);
  total         = signal(0);
  loading       = signal(false);
  saving        = signal(false);

  searchTerm    = '';
  statusFilter: StatusFilter = '';
  typeFilter    = '';
  modeFilter    = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  // ─── Metrics ─────────────────────────────────────────────────────────────
  publishedCount = signal(0);
  reviewCount    = signal(0);

  // ─── Lists for selection ─────────────────────────────────────────────────
  activeOrgs  = signal<Organization[]>([]);
  readonly eventTypes = EVENT_TYPES;
  readonly timezones = TIMEZONES;

  // ─── Form modal ──────────────────────────────────────────────────────────
  showFormModal = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);

  form: {
    title: string;
    slug: string;
    event_type: string;
    event_mode: string;
    venue: string;
    organizer: string;
    organization_id: string | null;
    start_at: string;
    end_at: string;
    timezone: string;
    registration_deadline_at: string;
    max_participants: number | null;
    registration_link: string;
    contact_email: string;
    contact_phone: string;
    is_featured: boolean;
  } = this.emptyForm();

  // ─── Status modal ─────────────────────────────────────────────────────────
  showStatusModal  = signal(false);
  statusTarget     = signal<Event | null>(null);
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
    this.loadEvents();
    this.loadMetrics();
    this.loadMetadataOptions();

    this.route.queryParams.subscribe(params => {
      if (params['create']) {
        this.openCreateModal();
      } else if (params['edit']) {
        this.eventsService.getEvent(params['edit']).subscribe({
          next: (ev) => this.openEditModal(ev),
          error: (err) => this.toast.error('Error', 'Failed to load event for editing')
        });
      }
    });
  }

  loadEvents() {
    this.loading.set(true);
    this.eventsService.listEvents({
      status:     this.statusFilter || undefined,
      event_type: this.typeFilter   || undefined,
      event_mode: this.modeFilter   || undefined,
      search:     this.searchTerm   || undefined,
      limit:      this.pageSize,
      offset:     this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.events.set(res.events);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load events');
        this.loading.set(false);
      }
    });
  }

  loadMetrics() {
    this.eventsService.listEvents({ status: 'published', limit: 1 }).subscribe({
      next: (res) => this.publishedCount.set(res.total)
    });
    this.eventsService.listEvents({ status: 'review', limit: 1 }).subscribe({
      next: (res) => this.reviewCount.set(res.total)
    });
  }

  loadMetadataOptions() {
    this.orgService.listOrganizations(undefined, true).subscribe({
      next: (res) => this.activeOrgs.set(res)
    });
  }

  onSearch() {
    this.currentOffset.set(0);
    this.loadEvents();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadEvents();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadEvents();
  }

  // ─── Form modal ──────────────────────────────────────────────────────────
  openCreateModal() {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.showFormModal.set(true);
  }

  openEditModal(ev: Event) {
    this.isEditMode.set(true);
    this.editingId.set(ev.id);

    // Format ISO string dates to local datetime input format YYYY-MM-DDTHH:MM
    const formatInputDate = (isoStr: string | null) => {
      if (!isoStr) return '';
      const date = new Date(isoStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    this.form = {
      title:                    ev.title,
      slug:                     ev.slug,
      event_type:               ev.event_type,
      event_mode:               ev.event_mode,
      venue:                    ev.venue ?? '',
      organizer:                ev.organizer ?? '',
      organization_id:          null,
      start_at:                 formatInputDate(ev.start_at),
      end_at:                   formatInputDate(ev.end_at),
      timezone:                 ev.timezone,
      registration_deadline_at: formatInputDate(ev.registration_deadline_at),
      max_participants:         ev.max_participants,
      registration_link:        ev.registration_link ?? '',
      contact_email:            ev.contact_email ?? '',
      contact_phone:            ev.contact_phone ?? '',
      is_featured:              ev.is_featured
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
      this.form.slug = this.eventsService.slugify(title);
    }
  }

  submitForm() {
    if (!this.form.title.trim() || !this.form.slug.trim()) {
      this.toast.error('Validation', 'Title and slug are required.');
      return;
    }
    if (!this.form.start_at || !this.form.end_at) {
      this.toast.error('Validation', 'Start and end dates are required.');
      return;
    }

    // Chronological validation
    const startDate = new Date(this.form.start_at);
    const endDate = new Date(this.form.end_at);

    if (startDate >= endDate) {
      this.toast.error('Validation', 'Start date & time must be strictly before end date & time.');
      return;
    }

    if (this.form.registration_deadline_at) {
      const deadlineDate = new Date(this.form.registration_deadline_at);
      if (deadlineDate >= startDate) {
        this.toast.error('Validation', 'Registration deadline must be before start date.');
        return;
      }
    }

    // Venue description check
    if (this.form.event_mode !== 'online' && !this.form.venue.trim()) {
      this.toast.error('Validation', 'Venue location is required for offline or hybrid events.');
      return;
    }

    this.saving.set(true);

    const payload = {
      title:                    this.form.title.trim(),
      slug:                     this.form.slug.trim(),
      event_type:               this.form.event_type,
      event_mode:               this.form.event_mode,
      venue:                    this.form.event_mode !== 'online' ? this.form.venue.trim() : null,
      organizer:                this.form.organizer.trim() || null,
      start_at:                 new Date(this.form.start_at).toISOString(),
      end_at:                   new Date(this.form.end_at).toISOString(),
      timezone:                 this.form.timezone,
      registration_deadline_at: this.form.registration_deadline_at ? new Date(this.form.registration_deadline_at).toISOString() : null,
      max_participants:         this.form.max_participants,
      registration_link:        this.form.registration_link.trim() || null,
      contact_email:            this.form.contact_email.trim() || null,
      contact_phone:            this.form.contact_phone.trim() || null,
      is_featured:              this.form.is_featured
    };

    if (this.isEditMode()) {
      this.eventsService.updateEvent(this.editingId()!, payload as UpdateEventPayload).subscribe({
        next: () => {
          this.toast.success('Event updated');
          this.saving.set(false);
          this.closeFormModal();
          this.loadEvents();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to update event');
          this.saving.set(false);
        }
      });
    } else {
      const createPayload: CreateEventPayload = {
        ...payload,
        organization_ids: this.form.organization_id ? [this.form.organization_id] : []
      };

      this.eventsService.createEvent(createPayload).subscribe({
        next: () => {
          this.toast.success('Event created');
          this.saving.set(false);
          this.closeFormModal();
          this.loadEvents();
          this.loadMetrics();
        },
        error: (err) => {
          this.toast.fromApiError(err, 'Failed to create event');
          this.saving.set(false);
        }
      });
    }
  }

  // ─── Status modal ─────────────────────────────────────────────────────────
  openStatusModal(ev: Event, action: WorkflowAction) {
    this.statusTarget.set(ev);
    this.pendingAction.set(action);
    this.pendingStatus.set(WORKFLOW_TRANSITIONS[action].status);
    this.statusRemarks = '';
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); }

  confirmStatus() {
    const ev = this.statusTarget();
    if (!ev) return;

    this.saving.set(true);
    this.eventsService.transitionStatus(ev.id, this.pendingStatus(), this.statusRemarks || undefined).subscribe({
      next: () => {
        this.toast.success(`Event ${this.pendingStatus()}`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadEvents();
        this.loadMetrics();
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Status transition failed');
        this.saving.set(false);
      }
    });
  }

  // ─── Archive / delete ─────────────────────────────────────────────────────
  confirmDelete(ev: Event) {
    if (!confirm(`Archive "${ev.title}"? It will be hidden from all public views.`)) return;

    this.eventsService.deleteEvent(ev.id).subscribe({
      next: () => {
        this.toast.success('Event archived');
        this.loadEvents();
        this.loadMetrics();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to archive event')
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
      title: '', slug: '', event_type: 'seminar', event_mode: 'online',
      venue: '', organizer: '', organization_id: null,
      start_at: '', end_at: '', timezone: 'Asia/Kolkata',
      registration_deadline_at: '', max_participants: null,
      registration_link: '', contact_email: '', contact_phone: '',
      is_featured: false
    };
  }
}
