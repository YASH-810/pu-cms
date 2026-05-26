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
        <div>
          <h1 class="page-title">Command Center</h1>
          <p class="page-subtitle">Governance overview and system health at a glance</p>
        </div>
        <div class="header-decoration">
          <div class="pulse-ring"></div>
          <div class="pulse-dot"></div>
          <span class="system-status-text">System Online</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper users">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Active Users</span>
            <span class="stat-value">{{ userCount() }}</span>
          </div>
          <div class="stat-bg-glow users-glow"></div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper orgs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Institutions</span>
            <span class="stat-value">{{ orgCount() }}</span>
          </div>
          <div class="stat-bg-glow orgs-glow"></div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper cats">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Categories</span>
            <span class="stat-value">{{ categoryCount() }}</span>
          </div>
          <div class="stat-bg-glow cats-glow"></div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper tags">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Tags</span>
            <span class="stat-value">{{ tagCount() }}</span>
          </div>
          <div class="stat-bg-glow tags-glow"></div>
        </div>
      </div>

      <div class="section-header">
        <h2 class="section-title">Quick Actions</h2>
        <div class="section-line"></div>
      </div>
      
      <div class="actions-grid">
        <a routerLink="/admin/users" class="action-card">
          <div class="action-icon-bg users-bg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
          </div>
          <div class="action-text">
            <span class="action-title">Manage Users</span>
            <span class="action-desc">Create, update, and assign roles</span>
          </div>
          <div class="action-arrow">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </div>
        </a>
        
        <a routerLink="/admin/organizations" class="action-card">
          <div class="action-icon-bg orgs-bg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>
          </div>
          <div class="action-text">
            <span class="action-title">Organization Tree</span>
            <span class="action-desc">Manage university hierarchy</span>
          </div>
          <div class="action-arrow">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </div>
        </a>
        
        <a routerLink="/admin/taxonomies" class="action-card">
          <div class="action-icon-bg cats-bg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
          </div>
          <div class="action-text">
            <span class="action-title">Taxonomy Manager</span>
            <span class="action-desc">Categories, tags & content types</span>
          </div>
          <div class="action-arrow">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </div>
        </a>
      </div>

      <div class="section-header">
        <h2 class="section-title">System Status</h2>
        <div class="section-line"></div>
      </div>
      
      <div class="info-grid">
        <div class="info-card">
          <div class="info-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm-3-6h.008v.008h-.008v-.008Z" /></svg>
          </div>
          <div class="info-content">
            <span class="info-label">API Server</span>
            <span class="info-value">Operational</span>
          </div>
          <div class="info-status-indicator online"></div>
        </div>
        
        <div class="info-card">
          <div class="info-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
          </div>
          <div class="info-content">
            <span class="info-label">Database</span>
            <span class="info-value">Connected</span>
          </div>
          <div class="info-status-indicator online"></div>
        </div>
        
        <div class="info-card">
          <div class="info-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          </div>
          <div class="info-content">
            <span class="info-label">Auth Provider</span>
            <span class="info-value">Google OAuth Active</span>
          </div>
          <div class="info-status-indicator online"></div>
        </div>
        
        <div class="info-card warning">
          <div class="info-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
          </div>
          <div class="info-content">
            <span class="info-label">System State</span>
            <span class="info-value">Production Ready</span>
          </div>
          <div class="info-status-indicator online"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

    :host { 
      display: block; 
      /* A clean, premium light theme background */
      background-color: transparent;
      padding: 1.5rem 2rem 3rem;
      box-sizing: border-box;
      color: #0f172a;
      font-family: 'Outfit', system-ui, -apple-system, sans-serif;
    }

    .dashboard {
      animation: smoothReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 1400px;
      margin: 0 auto;
    }

    @keyframes smoothReveal {
      0% { opacity: 0; transform: translateY(15px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
    }

    .page-title {
      font-size: 2.25rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin: 0;
      background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .page-subtitle {
      color: #64748b;
      margin: 0.25rem 0 0;
      font-size: 1.05rem;
      font-weight: 400;
    }

    /* System Status Pulse */
    .header-decoration {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.06);
      padding: 0.65rem 1.15rem;
      border-radius: 999px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.02);
    }

    .pulse-ring {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .pulse-dot {
      position: relative;
      width: 10px;
      height: 10px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.7; }
      100% { transform: scale(2.5); opacity: 0; }
    }

    .system-status-text {
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
      letter-spacing: 0.02em;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
      margin-bottom: 3.5rem;
    }

    .stat-card {
      position: relative;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.04);
      border-radius: 20px;
      padding: 1.75rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.02);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .stat-card:hover {
      transform: translateY(-5px);
      border-color: rgba(99, 102, 241, 0.2);
      box-shadow: 0 15px 35px -5px rgba(0,0,0,0.06), 0 5px 15px -5px rgba(0,0,0,0.04);
    }

    .stat-icon-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
    }

    .stat-icon-wrapper svg {
      width: 28px;
      height: 28px;
      color: #ffffff;
    }

    .stat-icon-wrapper.users { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 8px 16px rgba(59, 130, 246, 0.25); }
    .stat-icon-wrapper.orgs { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); box-shadow: 0 8px 16px rgba(139, 92, 246, 0.25); }
    .stat-icon-wrapper.cats { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 8px 16px rgba(245, 158, 11, 0.25); }
    .stat-icon-wrapper.tags { background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 8px 16px rgba(16, 185, 129, 0.25); }

    .stat-content {
      display: flex;
      flex-direction: column;
      z-index: 2;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }

    .stat-value {
      font-size: 2.25rem;
      font-weight: 700;
      color: #0f172a; 
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .stat-bg-glow {
      position: absolute;
      width: 150px;
      height: 150px;
      right: -50px;
      top: -50px;
      border-radius: 50%;
      filter: blur(40px);
      opacity: 0.08;
      z-index: 1;
      transition: opacity 0.4s ease;
    }

    .stat-card:hover .stat-bg-glow {
      opacity: 0.15;
    }

    .users-glow { background: #3b82f6; }
    .orgs-glow { background: #8b5cf6; }
    .cats-glow { background: #f59e0b; }
    .tags-glow { background: #10b981; }

    /* Section Headers */
    .section-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
      white-space: nowrap;
    }

    .section-line {
      height: 1px;
      width: 100%;
      background: linear-gradient(90deg, rgba(0,0,0,0.06) 0%, transparent 100%);
    }

    /* Actions Grid */
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      margin-bottom: 3.5rem;
    }

    .action-card {
      position: relative;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 4px 10px rgba(0,0,0,0.015);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    .action-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, transparent 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .action-card:hover {
      border-color: rgba(99, 102, 241, 0.25);
      transform: translateY(-3px);
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06);
    }

    .action-card:hover::before { opacity: 1; }

    .action-icon-bg {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid rgba(0,0,0,0.03);
      z-index: 1;
      transition: background 0.3s ease;
    }

    .action-card:hover .action-icon-bg.users-bg { background: #eff6ff; }
    .action-card:hover .action-icon-bg.orgs-bg { background: #f5f3ff; }
    .action-card:hover .action-icon-bg.cats-bg { background: #fffbeb; }

    .action-icon-bg svg {
      width: 24px;
      height: 24px;
    }

    .users-bg svg { color: #3b82f6; }
    .orgs-bg svg { color: #8b5cf6; }
    .cats-bg svg { color: #f59e0b; }

    .action-text {
      display: flex;
      flex-direction: column;
      flex: 1;
      z-index: 1;
    }

    .action-title {
      font-weight: 600;
      font-size: 1.05rem;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }

    .action-desc {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 400;
    }

    .action-arrow {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      transition: all 0.3s ease;
      z-index: 1;
    }

    .action-arrow svg {
      width: 16px; height: 16px;
    }

    .action-card:hover .action-arrow {
      background: #6366f1;
      color: white;
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
    }

    .info-card {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.015);
    }
    
    .info-card:hover {
      box-shadow: 0 6px 16px rgba(0,0,0,0.04);
      transform: translateY(-2px);
    }

    .info-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .info-icon svg {
      width: 20px;
      height: 20px;
      color: #64748b;
    }

    .info-content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .info-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.15rem;
    }

    .info-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: #0f172a;
    }

    .info-status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .info-status-indicator.online {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
    }
    
    .info-status-indicator.warning-dot {
      background: #f59e0b;
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
    }

    @media (max-width: 1200px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .info-grid { grid-template-columns: repeat(2, 1fr); }
    }
    
    @media (max-width: 768px) {
      .actions-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
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