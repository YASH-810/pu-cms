import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ToastHost } from '../toast-host/toast-host';
import { NotificationsService } from '../../services/notifications.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, ToastHost],
  template: `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="sidebar-scrollable-content">
          <div class="brand-row">
            <img src="/uni-logo.png" class="brand-logo" alt="University Logo">
            <div class="brand-copy">
              <strong>University CMS</strong>
              <span>Governance Console</span>
            </div>
          </div>

          <nav class="nav-list" aria-label="Admin navigation">
            @for (item of filteredNavItems(); track item.label) {
              @if (item.children) {
                <div class="nav-group">
                  <button type="button" class="nav-link dropdown-toggle" (click)="toggleDropdown(item.label)" [class.active]="isGroupActive(item)">
                    <span>{{ item.label }}</span>
                    <span class="caret" [class.open]="openDropdowns[item.label]">▼</span>
                  </button>
                  @if (openDropdowns[item.label]) {
                    <div class="nav-children">
                      @for (child of item.children; track child.path) {
                        <a [routerLink]="child.path" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link child-link">
                          <span>{{ child.label }}</span>
                        </a>
                      }
                    </div>
                  }
                </div>
              } @else {
                <a [routerLink]="item.path" routerLinkActive="active" class="nav-link">
                  <span>{{ item.label }}</span>
                </a>
              }
            }
          </nav>
        </div>

        <div class="sidebar-footer">
          @if (auth.context(); as context) {
            <div class="profile-card compact">
              <div class="profile-info">
                <strong>{{ context.user.fullName }}</strong>
                <span class="user-email">{{ context.user.email }}</span>
              </div>
              <a routerLink="/admin/notifications" class="notification-bell" [attr.aria-label]="unreadNotifications() + ' unread notifications'" title="Notifications">
                <span class="bell-icon">🔔</span>
                @if (unreadNotifications() > 0) {
                  <span class="badge">{{ unreadNotifications() }}</span>
                }
              </a>
              <button type="button" class="logout-btn" (click)="logout()" aria-label="Sign out" title="Sign out">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>
          } @else {
            <form class="dev-login" (ngSubmit)="localLogin()">
              <label for="dev-login-email">Local admin email</label>
              <input id="dev-login-email" name="email" [(ngModel)]="loginEmail" autocomplete="email" />
              <button type="submit">Sign in</button>
            </form>
          }
        </div>
      </aside>

      <section class="workspace">


        <main class="content-area">
          <router-outlet></router-outlet>
        </main>
      </section>
    </div>

    <app-toast-host></app-toast-host>
  `,
  styles: [`
    :host {
      display: block;
      height: 100dvh;
      color: #0f172a;
      background: #f6f8fb;
    }

    .admin-shell {
      display: grid;
      grid-template-columns: 286px 1fr;
      height: 100%;
      min-width: 0;
    }

    /* FIX: Converted sidebar from dark blue to uniform white background */
    .sidebar {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      min-height: 0;
      min-width: 0;
      padding: 20px 14px;
      background: #ffffff;
      color: #0f172a;
      border-right: 1px solid #e2e8f0;
      box-sizing: border-box;
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 8px 26px;
    }

    .brand-logo {
      width: 44px;
      height: 44px;
      max-width: 44px;
      max-height: 44px;
      object-fit: contain;
      border-radius: 10px;
      flex: 0 0 auto;
    }

    .brand-mark {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--primary-red), var(--accent-gold));
      color: #fff;
      font-weight: 800;
      box-shadow: 0 14px 30px var(--primary-red-shadow);
      flex: 0 0 auto;
    }

    .brand-copy {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      min-width: 0;
    }

    .brand-copy strong {
      font-size: 0.98rem;
      white-space: nowrap;
      color: #0f172a;
    }

    /* FIX: Adjusted dark mode text colors to readable slate shades */
    .brand-copy span {
      color: #64748b;
      font-size: 0.78rem;
      margin-top: 3px;
    }

    .sidebar-scrollable-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
      padding-bottom: 12px;
    }

    .sidebar-scrollable-content::-webkit-scrollbar {
      width: 4px;
    }

    .sidebar-scrollable-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .sidebar-scrollable-content::-webkit-scrollbar-thumb {
      background-color: #cbd5e1;
      border-radius: 4px;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 44px;
      padding: 0 12px;
      border-radius: 12px;
      color: #475569;
      font-size: 0.92rem;
      font-weight: 600;
      transition: background 0.16s ease, color 0.16s ease;
      text-decoration: none;
    }

    .nav-link:hover,
    .nav-link.active {
      background: var(--primary-red-light);
      color: var(--primary-red);
    }

    .dropdown-toggle {
      justify-content: space-between;
      width: 100%;
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: inherit;
    }

    .caret {
      font-size: 0.6rem;
      transition: transform 0.2s ease;
    }

    .caret.open {
      transform: rotate(180deg);
    }

    .nav-children {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
      margin-left: 18px;
      padding-left: 12px;
      border-left: 1px solid #e2e8f0;
    }

    .child-link {
      height: 38px;
      font-size: 0.86rem;
    }

    .nav-icon {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      color: inherit;
      font-size: 0.84rem;
      font-weight: 800;
      flex: 0 0 auto;
    }

    /* FIX: Light border separator */
    .sidebar-footer {
      margin-top: auto;
      padding: 14px 8px 0;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .user-email {
      font-size: 0.75rem !important;
      color: #94a3b8 !important;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 180px;
      display: block;
    }

    .profile-info {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      min-width: 0;
      flex: 1;
    }

    .logout-btn {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: #64748b;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.16s ease;
      flex-shrink: 0;
    }

    .logout-btn:hover {
      background: #fee2e2;
      color: #ef4444;
    }

    .logout-btn svg {
      width: 18px;
      height: 18px;
    }

    .workspace {
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
      overflow: hidden;
    }

    .profile-chip,
    .profile-card {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .profile-chip span,
    .profile-card span,
    .muted {
      color: #64748b;
      font-size: 0.8rem;
    }

    .profile-chip {
      padding: 7px 12px 7px 7px;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      background: #fff;
    }

    .profile-chip div:last-child,
    .profile-card div:last-child {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--primary-red-light);
      color: var(--primary-red);
      font-size: 0.82rem;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .avatar.small {
      width: 34px;
      height: 34px;
      border-radius: 999px;
    }

    .profile-card.compact {
      background: none;
      border: none;
      border-radius: 0;
      padding: 0;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .secondary-button,
    .dev-login button {
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #fff;
      color: #0f172a;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .dev-login {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* FIX: Dev authentication forms styling */
    .dev-login label {
      color: #475569;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .dev-login input {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #ffffff;
      color: #0f172a;
      padding: 10px 12px;
    }

    .dev-login button {
      border-color: transparent;
      background: var(--primary-red);
      color: #fff;
      transition: background 0.16s ease;
    }
    .dev-login button:hover {
      background: var(--primary-red-hover);
    }

    .content-area {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 30px;
    }

    @media (max-width: 900px) {
      .profile-chip div:last-child {
        display: none;
      }
    }

    .notification-bell {
      position: relative;
      font-size: 1.1rem;
      cursor: pointer;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      transition: all 0.16s ease;
      color: #64748b;
      text-decoration: none;
      flex-shrink: 0;
    }
    .notification-bell:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .notification-bell .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #fff;
      font-size: 0.68rem;
      font-weight: 800;
      border-radius: 999px;
      min-width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
    }
  `]
})
export class AdminLayout {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  private readonly notificationsService = inject(NotificationsService);

  readonly currentUrl = signal(this.router.url);
  loginEmail = 'admin@pu.edu';
  readonly unreadNotifications = signal(0);
  
  openDropdowns: Record<string, boolean> = { 'Content Pages': true };

  toggleDropdown(label: string) {
    this.openDropdowns[label] = !this.openDropdowns[label];
  }

  isGroupActive(item: any): boolean {
    return item.children.some((child: any) => this.currentUrl().startsWith(child.path));
  }

  readonly filteredNavItems = computed(() => {
    const roles = this.auth.context()?.globalRoles?.map(r => r.name) || [];
    const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('UNIVERSITY_ADMIN');
    
    let items: any[] = [
      { path: '/admin/dashboard', label: 'Dashboard' },
      { path: '/admin/content', label: 'Content' },
      { 
        label: 'Content Pages', 
        children: [
          { path: '/admin/blogs', label: 'Blogs & News' },
          { path: '/admin/events', label: 'Events' },
          { path: '/admin/announcements', label: 'Announcements' },
          { path: '/admin/achievements', label: 'Achievements' },
          { path: '/admin/stories', label: 'Stories' },
          { path: '/admin/clubs', label: 'Clubs & Societies' }
        ]
      },
      { path: '/admin/review-queue', label: isSuperAdmin ? 'Approvals' : 'Review Queue' }
    ];

    if (!isSuperAdmin) {
      items.push(
        { path: '/admin/published', label: 'Published' },
        { path: '/admin/archived', label: 'Archived' }
      );
    }

    if (isSuperAdmin) {
      items.push(
        { path: '/admin/users', label: 'Users' },
        { path: '/admin/organizations', label: 'Organizations' },
        { path: '/admin/taxonomies', label: 'Taxonomy' },
        { path: '/admin/notifications', label: 'Notifications' }
      );
    }
    
    return items;
  });

  readonly currentSection = computed(() => {
    const active = this.filteredNavItems().find((item) => this.currentUrl().startsWith(item.path));
    return active?.label ?? 'Dashboard';
  });

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
      if (this.auth.isAuthenticated()) {
        this.loadUnreadCount();
      }
    });

    if (this.auth.isAuthenticated()) {
      this.auth.loadMe().subscribe({
        next: () => this.loadUnreadCount(),
        error: () => this.auth.clearToken()
      });
    }
  }

  loadUnreadCount() {
    this.notificationsService.getUnreadCount().subscribe({
      next: (count) => this.unreadNotifications.set(count),
      error: () => {}
    });
  }

  localLogin() {
    this.auth.devLogin(this.loginEmail).subscribe({
      next: () => window.location.reload(),
      error: (error) => this.toast.fromApiError(error, 'Unable to sign in')
    });
  }

  logout() {
    this.auth.clearToken();
    this.toast.info('Signed out');
    this.router.navigate(['/login']);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}