import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsService, Notification } from '../../services/notifications.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">User Space</p>
          <h1>Notifications</h1>
          <p>Read review alerts, publication confirmations, and status updates.</p>
        </div>
        <div style="display:flex;gap:12px">
          <button type="button" class="secondary-button" (click)="loadNotifications()">
            Refresh
          </button>
          <button type="button" class="primary-button" (click)="markAllRead()" [disabled]="unreadCount() === 0">
            Mark All as Read
          </button>
        </div>
      </header>

      <div class="metric-grid">
        <div class="metric-card">
          <span>Unread Notifications</span>
          <strong [class.unread-highlight]="unreadCount() > 0">{{ unreadCount() }}</strong>
        </div>
        <div class="metric-card">
          <span>Total Received</span>
          <strong>{{ total() }}</strong>
        </div>
      </div>

      <div class="data-card">
        <div class="card-toolbar" style="display:flex;gap:12px">
          <button
            type="button"
            class="filter-tab"
            [class.active]="filterRead() === null"
            (click)="setReadFilter(null)"
          >All</button>
          <button
            type="button"
            class="filter-tab"
            [class.active]="filterRead() === false"
            (click)="setReadFilter(false)"
          >Unread</button>
          <button
            type="button"
            class="filter-tab"
            [class.active]="filterRead() === true"
            (click)="setReadFilter(true)"
          >Read</button>
        </div>

        <div class="table-wrap">
          <table class="notification-table">
            <tbody>
              @if (loading()) {
                <tr>
                  <td class="empty-cell">Loading notifications…</td>
                </tr>
              } @else if (notifications().length === 0) {
                <tr>
                  <td class="empty-cell">No notifications found.</td>
                </tr>
              } @else {
                @for (n of notifications(); track n.id) {
                  <tr [class.unread-row]="!n.is_read" (click)="handleNotificationClick(n)" style="cursor:pointer">
                    <td>
                      <div class="notification-row-content">
                        <div class="notification-indicator" [class.unread]="!n.is_read"></div>
                        <div class="notification-text">
                          <strong class="notification-title">{{ n.title }}</strong>
                          <p class="notification-body">{{ n.body }}</p>
                          <span class="notification-time">{{ n.created_at | date:'medium' }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="right" (click)="$event.stopPropagation()">
                      @if (!n.is_read) {
                        <button type="button" class="ghost-button small-btn" (click)="markRead(n.id)">
                          Mark read
                        </button>
                      } @else {
                        <span class="read-check">✓ Read</span>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <div class="table-footer">
            <span>Showing {{ notifications().length }} of {{ total() }}</span>
            <div style="display:flex;gap:8px">
              <button type="button" class="ghost-button" [disabled]="currentOffset() === 0" (click)="prevPage()">← Prev</button>
              <button type="button" class="ghost-button" [disabled]="currentOffset() + pageSize >= total()" (click)="nextPage()">Next →</button>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .unread-highlight {
      color: var(--primary-red);
    }
    .filter-tab {
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 8px 16px;
      background: var(--bg-card);
      font-weight: 700;
      cursor: pointer;
      font-size: 0.88rem;
      color: var(--text-muted);
      transition: all 0.16s ease;
    }
    .filter-tab.active {
      background: var(--primary-red-light);
      color: var(--primary-red);
      border-color: var(--primary-red);
    }
    .notification-table tr {
      transition: background 0.12s ease;
      border-bottom: 1px solid var(--border-color);
    }
    .notification-table tr:hover {
      background: var(--bg-primary);
    }
    .unread-row {
      background: var(--bg-primary);
    }
    .notification-row-content {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 12px 6px;
    }
    .notification-indicator {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: transparent;
      margin-top: 6px;
      flex-shrink: 0;
    }
    .notification-indicator.unread {
      background: var(--primary-red);
      box-shadow: 0 0 8px var(--primary-red-shadow);
    }
    .notification-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .notification-title {
      font-size: 0.94rem;
      color: #0f172a;
    }
    .notification-body {
      font-size: 0.88rem;
      color: #475569;
      margin: 0;
    }
    .notification-time {
      font-size: 0.76rem;
      color: #94a3b8;
    }
    .small-btn {
      padding: 6px 10px;
      font-size: 0.8rem;
    }
    .read-check {
      color: #94a3b8;
      font-size: 0.82rem;
      font-weight: 700;
      padding-right: 8px;
    }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminNotifications implements OnInit {
  private readonly notificationsService = inject(NotificationsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  notifications = signal<Notification[]>([]);
  total = signal(0);
  unreadCount = signal(0);
  loading = signal(false);

  filterRead = signal<boolean | null>(null);
  currentOffset = signal(0);
  readonly pageSize = 20;

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.loading.set(true);
    
    // Fetch notifications list
    this.notificationsService.listNotifications({
      is_read: this.filterRead() === null ? undefined : this.filterRead()!,
      limit: this.pageSize,
      offset: this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.notifications.set(res.notifications);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load notifications');
        this.loading.set(false);
      }
    });

    // Fetch unread count
    this.notificationsService.getUnreadCount().subscribe({
      next: (count) => this.unreadCount.set(count)
    });
  }

  setReadFilter(status: boolean | null) {
    this.filterRead.set(status);
    this.currentOffset.set(0);
    this.loadNotifications();
  }

  markRead(id: string) {
    this.notificationsService.markSingleAsRead(id).subscribe({
      next: () => {
        this.toast.success('Marked as read');
        this.loadNotifications();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to update notification')
    });
  }

  markAllRead() {
    this.notificationsService.markAsRead().subscribe({
      next: () => {
        this.toast.success('All notifications marked as read');
        this.loadNotifications();
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to update notifications')
    });
  }

  handleNotificationClick(n: Notification) {
    if (!n.is_read) {
      this.notificationsService.markSingleAsRead(n.id).subscribe({
        next: () => {
          this.loadNotifications();
          if (n.action_url) {
            this.router.navigateByUrl(n.action_url);
          }
        },
        error: () => {
          if (n.action_url) {
            this.router.navigateByUrl(n.action_url);
          }
        }
      });
    } else if (n.action_url) {
      this.router.navigateByUrl(n.action_url);
    }
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadNotifications();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadNotifications();
  }
}
