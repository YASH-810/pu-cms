import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { OrganizationService } from '../../services/organization.service';
import { TaxonomyService } from '../../services/taxonomy.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard">
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Governance overview and system health at a glance</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card" id="stat-users">
          <div class="stat-icon users-icon">👥</div>
          <div class="stat-content">
            <span class="stat-value">{{ userCount() }}</span>
            <span class="stat-label">Active Users</span>
          </div>
          <div class="stat-glow users-glow"></div>
        </div>

        <div class="stat-card" id="stat-organizations">
          <div class="stat-icon orgs-icon">🏫</div>
          <div class="stat-content">
            <span class="stat-value">{{ orgCount() }}</span>
            <span class="stat-label">Institutions</span>
          </div>
          <div class="stat-glow orgs-glow"></div>
        </div>

        <div class="stat-card" id="stat-categories">
          <div class="stat-icon cats-icon">📂</div>
          <div class="stat-content">
            <span class="stat-value">{{ categoryCount() }}</span>
            <span class="stat-label">Categories</span>
          </div>
          <div class="stat-glow cats-glow"></div>
        </div>

        <div class="stat-card" id="stat-tags">
          <div class="stat-icon tags-icon">🏷️</div>
          <div class="stat-content">
            <span class="stat-value">{{ tagCount() }}</span>
            <span class="stat-label">Tags</span>
          </div>
          <div class="stat-glow tags-glow"></div>
        </div>
      </div>

      <div class="section-header">
        <h2>Quick Actions</h2>
      </div>
      <div class="actions-grid">
        <a routerLink="/admin/users" class="action-card" id="action-manage-users">
          <div class="action-icon">👤</div>
          <div class="action-text">
            <span class="action-title">Manage Users</span>
            <span class="action-desc">Create, update, and assign roles</span>
          </div>
          <span class="action-arrow">→</span>
        </a>
        <a routerLink="/admin/organizations" class="action-card" id="action-manage-orgs">
          <div class="action-icon">🏛️</div>
          <div class="action-text">
            <span class="action-title">Organization Tree</span>
            <span class="action-desc">Manage university hierarchy</span>
          </div>
          <span class="action-arrow">→</span>
        </a>
        <a routerLink="/admin/taxonomies" class="action-card" id="action-manage-taxonomies">
          <div class="action-icon">📑</div>
          <div class="action-text">
            <span class="action-title">Taxonomy Manager</span>
            <span class="action-desc">Categories, tags & content types</span>
          </div>
          <span class="action-arrow">→</span>
        </a>
      </div>

      <div class="section-header">
        <h2>System Status</h2>
      </div>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-header">
            <span class="info-dot online"></span>
            <span>API Server</span>
          </div>
          <span class="info-status">Operational</span>
        </div>
        <div class="info-card">
          <div class="info-header">
            <span class="info-dot online"></span>
            <span>Database</span>
          </div>
          <span class="info-status">Connected</span>
        </div>
        <div class="info-card">
          <div class="info-header">
            <span class="info-dot online"></span>
            <span>Auth Provider</span>
          </div>
          <span class="info-status">Google OAuth Active</span>
        </div>
        <div class="info-card">
          <div class="info-header">
            <span class="info-dot warning"></span>
            <span>Content Pipeline</span>
          </div>
          <span class="info-status">Phase 4 In Progress</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { 
      display: block; 
      background-color: #f8fafc; /* Matches the clean off-white dashboard wrapper */
      min-height: 100vh;
      padding: 2rem;
      box-sizing: border-box;
      color: #0f172a;
    }

    .dashboard {
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin: 0;
      color: #0f172a; /* Sharp, dark heading */
    }

    .page-subtitle {
      color: #64748b;
      margin: 0.5rem 0 0;
      font-size: 0.95rem;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }

    .stat-card {
      position: relative;
      background: #ffffff; /* Pure white surface */
      border: 1px solid #e2e8f0; /* Subtle light border */
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      overflow: hidden;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .stat-card:hover {
      transform: translateY(-3px);
      border-color: #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }

    .stat-glow {
      position: absolute;
      top: -40px;
      right: -40px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      filter: blur(40px);
      opacity: 0.06; /* Softened back glow for light interface background */
    }

    .users-glow { background: #3b82f6; }
    .orgs-glow { background: #8b5cf6; }
    .cats-glow { background: #f59e0b; }
    .tags-glow { background: #10b981; }

    .stat-icon {
      font-size: 2rem;
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
    }

    .users-icon { background: #eff6ff; }
    .orgs-icon { background: #f5f3ff; }
    .cats-icon { background: #fffbeb; }
    .tags-icon { background: #ecfdf5; }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #0f172a; 
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Section Headers */
    .section-header {
      margin-bottom: 1rem;
    }

    .section-header h2 {
      font-size: 1.15rem;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    /* Actions Grid */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2.5rem;
    }

    .action-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }

    .action-card:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      transform: translateX(4px);
    }

    .action-icon {
      font-size: 1.5rem;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
      border-radius: 12px;
      flex-shrink: 0;
    }

    .action-text {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .action-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: #0f172a;
    }

    .action-desc {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 0.15rem;
    }

    .action-arrow {
      color: #94a3b8;
      font-size: 1.25rem;
      transition: transform 0.2s ease;
    }

    .action-card:hover .action-arrow {
      transform: translateX(4px);
      color: #6366f1;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .info-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }

    .info-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #64748b;
    }

    .info-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .info-dot.online {
      background: #22c55e;
      box-shadow: 0 0 6px rgba(34, 197, 94, 0.2);
    }

    .info-dot.warning {
      background: #f59e0b;
      box-shadow: 0 0 6px rgba(245, 158, 11, 0.2);
    }

    .info-status {
      font-size: 0.8rem;
      font-weight: 500;
      color: #1e293b;
    }

    @media (max-width: 1100px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .actions-grid { grid-template-columns: 1fr; }
      .info-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class AdminDashboard implements OnInit {
  private readonly userService = inject(UserService);
  private readonly orgService = inject(OrganizationService);
  private readonly taxonomyService = inject(TaxonomyService);

  userCount = signal(0);
  orgCount = signal(0);
  categoryCount = signal(0);
  tagCount = signal(0);

  ngOnInit() {
    forkJoin({
      users: this.userService.listUsers(undefined, true, 1, 1),
      orgs: this.orgService.listOrganizations(undefined, true),
      categories: this.taxonomyService.listCategories(),
      tags: this.taxonomyService.listTags()
    }).subscribe({
      next: (result) => {
        this.userCount.set(result.users.pagination?.total ?? 0);
        this.orgCount.set(result.orgs.length);
        this.categoryCount.set(result.categories.length);
        this.tagCount.set(result.tags.length);
      },
      error: () => {
        // Gracefully handle when backend is unreachable
      }
    });
  }
}