import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface UnifiedContent {
  id: string;
  title: string;
  slug: string;
  status: string;
  updated_at: string;
  author_id: string;
  type_slug: string;
  type_name: string;
  author_name: string;
}

@Component({
  selector: 'app-admin-unified-content',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Workspace</p>
          <h1>{{ pageTitle() }}</h1>
          <p>{{ pageDescription() }}</p>
        </div>
        <div class="dropdown" style="position:relative">
          <button type="button" class="primary-button" (click)="toggleDropdown()">
            + Create New
          </button>
          @if (dropdownOpen()) {
            <div class="dropdown-menu">
              <a routerLink="/admin/blogs" [queryParams]="{create: true}">Blog & News</a>
              <a routerLink="/admin/events" [queryParams]="{create: true}">Event</a>
              <a routerLink="/admin/announcements" [queryParams]="{create: true}">Announcement</a>
              <a routerLink="/admin/achievements" [queryParams]="{create: true}">Achievement</a>
              <a routerLink="/admin/stories" [queryParams]="{create: true}">Story</a>
              <a routerLink="/admin/clubs" [queryParams]="{create: true}">Club & Society</a>
            </div>
          }
        </div>
      </header>

      <div class="data-card" (click)="dropdownOpen.set(false)">
        <div class="card-toolbar">
          <label class="search-field">
            <input type="search" placeholder="Search by title or slug…" [(ngModel)]="searchTerm" (ngModelChange)="onSearch()" />
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Author</th>
                <th>Status</th>
                <th>Updated</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="6" class="empty-cell">Loading content…</td></tr>
              } @else if (items().length === 0) {
                <tr><td colspan="6" class="empty-cell">No content found.</td></tr>
              } @else {
                @for (item of items(); track item.id) {
                  <tr>
                    <td>
                      <div class="page-cell">
                        <strong>{{ item.title }}</strong>
                        <span class="muted font-mono" style="font-size:0.76rem">{{ item.slug }}</span>
                      </div>
                    </td>
                    <td><span class="pill pill-draft">{{ item.type_name }}</span></td>
                    <td>{{ item.author_name || 'System' }}</td>
                    <td><span class="pill" [ngClass]="statusClass(item.status)">{{ item.status }}</span></td>
                    <td><span class="muted">{{ item.updated_at | date:'dd MMM yyyy' }}</span></td>
                    <td class="right">
                      <div class="dropdown">
                        <button type="button" class="ghost-button" (click)="toggleRowDropdown(item.id)">...</button>
                        @if (activeRowDropdown() === item.id) {
                          <div class="dropdown-menu">
                            <a [routerLink]="'/admin/' + (item.type_slug === 'blog' ? 'blogs' : item.type_slug + 's')" [queryParams]="{edit: item.id}">Edit Content</a>
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

        @if (total() > pageSize) {
          <div class="table-footer">
            <span>Showing {{ items().length }} of {{ total() }}</span>
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
    .page-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminUnifiedContent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  items = signal<UnifiedContent[]>([]);
  total = signal(0);
  loading = signal(false);
  dropdownOpen = signal(false);
  activeRowDropdown = signal<string | null>(null);

  searchTerm = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  viewMode = signal<'all' | 'review' | 'published' | 'archived'>('all');

  readonly pageTitle = computed(() => {
    switch (this.viewMode()) {
      case 'review': return 'Review Queue';
      case 'published': return 'Published Content';
      case 'archived': return 'Archived Content';
      default: return 'All Content';
    }
  });

  readonly pageDescription = computed(() => {
    switch (this.viewMode()) {
      case 'review': return 'Content awaiting approval.';
      case 'published': return 'Content currently live on the site.';
      case 'archived': return 'Old content kept for records.';
      default: return 'Manage all content types in one place.';
    }
  });

  ngOnInit() {
    this.route.data.subscribe(data => {
      if (data['view']) {
        this.viewMode.set(data['view']);
      }
      this.currentOffset.set(0);
      this.loadData();
    });
  }

  toggleDropdown() {
    this.dropdownOpen.update(v => !v);
  }

  toggleRowDropdown(id: string) {
    if (this.activeRowDropdown() === id) {
      this.activeRowDropdown.set(null);
    } else {
      this.activeRowDropdown.set(id);
    }
  }

  loadData() {
    this.loading.set(true);
    let url = `/api/v1/admin/content?limit=${this.pageSize}&offset=${this.currentOffset()}`;

    const status = this.viewMode() === 'all' ? '' : this.viewMode();
    if (status) {
      url += `&status=${status}`;
    }

    if (this.searchTerm) {
      url += `&search=${encodeURIComponent(this.searchTerm)}`;
    }

    const roles = this.auth.context()?.globalRoles?.map(r => r.name) || [];
    const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('UNIVERSITY_ADMIN');
    
    // Editors only see their own content in the 'All' tab, but maybe they should see everything they created everywhere.
    // Let's filter by author_id if they are not admin.
    if (!isSuperAdmin) {
      url += `&author_id=${this.auth.context()?.user?.id}`;
    }

    this.http.get<{ data: UnifiedContent[], total: number }>(url).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', 'Failed to load content');
        this.loading.set(false);
      }
    });
  }

  onSearch() {
    this.currentOffset.set(0);
    this.loadData();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadData();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadData();
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
}
