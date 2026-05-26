import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ToastHost } from '../toast-host/toast-host';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, ToastHost],
  template: `
    <div class="admin-shell" [class.sidebar-collapsed]="isCollapsed()">
      <aside class="sidebar">
        <div class="brand-row">
          <div class="brand-mark">PU</div>
          @if (!isCollapsed()) {
            <div class="brand-copy">
              <strong>University CMS</strong>
              <span>Governance Console</span>
            </div>
          }
        </div>

        <nav class="nav-list" aria-label="Admin navigation">
          @for (item of navItems; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-link">
              <span class="nav-icon">{{ item.icon }}</span>
              @if (!isCollapsed()) {
                <span>{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          @if (auth.context(); as context) {
            <div class="profile-card compact">
              <div class="avatar">{{ initials(context.user.fullName) }}</div>
              @if (!isCollapsed()) {
                <div>
                  <strong>{{ context.user.fullName }}</strong>
                  <span>{{ context.globalRoles[0]?.name || 'Authenticated' }}</span>
                </div>
              }
            </div>
          } @else if (!isCollapsed()) {
            <form class="dev-login" (ngSubmit)="localLogin()">
              <label for="dev-login-email">Local admin email</label>
              <input id="dev-login-email" name="email" [(ngModel)]="loginEmail" autocomplete="email" />
              <button type="submit">Sign in</button>
            </form>
          }
        </div>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div class="topbar-left">
            <button type="button" class="icon-button" (click)="isCollapsed.set(!isCollapsed())" aria-label="Toggle sidebar">
              <span></span>
              <span></span>
              <span></span>
            </button>
            <div class="breadcrumb">
              <span>Admin</span>
              <strong>{{ currentSection() }}</strong>
            </div>
          </div>

          <div class="topbar-right">
            @if (auth.context(); as context) {
              <div class="profile-chip">
                <div class="avatar small">{{ initials(context.user.fullName) }}</div>
                <div>
                  <strong>{{ context.user.fullName }}</strong>
                  <span>{{ context.user.email }}</span>
                </div>
              </div>
              <button type="button" class="secondary-button" (click)="logout()">Logout</button>
            } @else {
              <span class="muted">Sign in to manage content governance</span>
            }
          </div>
        </header>

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
      transition: grid-template-columns 0.2s ease;
    }

    .admin-shell.sidebar-collapsed {
      grid-template-columns: 86px 1fr;
    }

    /* FIX: Converted sidebar from dark blue to uniform white background */
    .sidebar {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 20px 14px;
      background: #ffffff;
      color: #0f172a;
      border-right: 1px solid #e2e8f0;
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 8px 26px;
    }

    .brand-mark {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #2563eb, #14b8a6);
      color: #fff;
      font-weight: 800;
      box-shadow: 0 14px 30px rgba(20, 184, 166, 0.22);
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

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }

    /* FIX: Changed navigation link text colors and hover states for light mode */
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
    }

    .nav-link:hover,
    .nav-link.active {
      background: #f1f5f9;
      color: #2563eb;
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
      padding: 14px 8px 0;
      border-top: 1px solid #e2e8f0;
    }

    .workspace {
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
    }

    .topbar {
      height: 76px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 0 30px;
      background: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid #e2e8f0;
      backdrop-filter: blur(14px);
    }

    .topbar-left,
    .topbar-right,
    .profile-chip,
    .profile-card {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon-button {
      display: grid;
      place-items: center;
      gap: 3px;
      width: 40px;
      height: 40px;
      border: 1px solid #dbe4ef;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
    }

    .icon-button span {
      display: block;
      width: 16px;
      height: 2px;
      border-radius: 999px;
      background: #334155;
    }

    .breadcrumb {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .breadcrumb span,
    .profile-chip span,
    .profile-card span,
    .muted {
      color: #64748b;
      font-size: 0.8rem;
    }

    .breadcrumb strong {
      font-size: 1rem;
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
      background: #dbeafe;
      color: #1d4ed8;
      font-size: 0.82rem;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .avatar.small {
      width: 34px;
      height: 34px;
      border-radius: 999px;
    }

    /* FIX: Profile card container background and borders for light theme */
    .profile-card.compact {
      min-height: 52px;
      padding: 8px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #0f172a;
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
      background: #2563eb;
      color: #fff;
    }

    .content-area {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 30px;
    }

    @media (max-width: 900px) {
      .admin-shell,
      .admin-shell.sidebar-collapsed {
        grid-template-columns: 1fr;
      }

      .sidebar {
        display: none;
      }

      .topbar {
        padding: 0 16px;
      }

      .profile-chip div:last-child {
        display: none;
      }
    }
  `]
})
export class AdminLayout {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly isCollapsed = signal(false);
  readonly currentUrl = signal(this.router.url);
  loginEmail = 'admin@pu.edu';

  readonly navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: 'DB' },
    { path: '/admin/users', label: 'Users', icon: 'US' },
    { path: '/admin/organizations', label: 'Organizations', icon: 'OR' },
    { path: '/admin/taxonomies', label: 'Taxonomy', icon: 'TX' },
    { path: '/admin/pages', label: 'Pages', icon: 'PG' },
    { path: '/admin/blogs', label: 'Blogs & News', icon: 'BL' },
    { path: '/admin/events', label: 'Events', icon: 'EV' }
  ];

  readonly currentSection = computed(() => {
    const active = this.navItems.find((item) => this.currentUrl().startsWith(item.path));
    return active?.label ?? 'Dashboard';
  });

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });

    if (this.auth.isAuthenticated()) {
      this.auth.loadMe().subscribe({
        error: () => this.auth.clearToken()
      });
    }
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
    this.router.navigate(['/admin/dashboard']);
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