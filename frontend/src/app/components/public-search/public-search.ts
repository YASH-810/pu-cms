import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { SearchService, SearchResultItem, SearchParams } from '../../services/search.service';
import { TaxonomyService, Category, Tag } from '../../services/taxonomy.service';
import { OrganizationService, Organization } from '../../services/organization.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-public-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Discover Content</p>
          <h1>University Search Engine</h1>
          <p>Find articles, events, official announcements, student clubs, and stories.</p>
        </div>
      </header>

      <div class="search-layout">
        <!-- ─── Filter Sidebar ────────────────────────────────────────────── -->
        <aside class="sidebar-card">
          <h3>Refine Results</h3>
          
          <div class="filter-section">
            <label class="filter-label">Content Type</label>
            <div class="checkbox-group">
              @for (type of contentTypes; track type.value) {
                <label class="checkbox-label">
                  <input
                    type="radio"
                    name="contentType"
                    [value]="type.value"
                    [(ngModel)]="selectedContentType"
                    (change)="executeSearch(true)"
                  />
                  <span>{{ type.label }}</span>
                </label>
              }
            </div>
          </div>

          <div class="filter-section">
            <label class="filter-label">Sort Order</label>
            <select [(ngModel)]="sortBy" (change)="executeSearch(true)" class="sidebar-select">
              <option value="relevance">Most Relevant ⚡</option>
              <option value="date">Most Recent 📅</option>
            </select>
          </div>

          @if (organizations().length > 0) {
            <div class="filter-section">
              <label class="filter-label">Organization</label>
              <select [(ngModel)]="selectedOrgId" (change)="executeSearch(true)" class="sidebar-select">
                <option value="">All Organizations</option>
                @for (org of organizations(); track org.id) {
                  <option [value]="org.id">{{ org.name }}</option>
                }
              </select>
            </div>
          }

          @if (categories().length > 0) {
            <div class="filter-section">
              <label class="filter-label">Category</label>
              <select [(ngModel)]="selectedCategoryId" (change)="executeSearch(true)" class="sidebar-select">
                <option value="">All Categories</option>
                @for (cat of categories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>
          }

          @if (tags().length > 0) {
            <div class="filter-section">
              <label class="filter-label">Tag</label>
              <select [(ngModel)]="selectedTagId" (change)="executeSearch(true)" class="sidebar-select">
                <option value="">All Tags</option>
                @for (t of tags(); track t.id) {
                  <option [value]="t.id">#{{ t.name }}</option>
                }
              </select>
            </div>
          }

          <button type="button" class="ghost-button full" (click)="resetFilters()">
            Clear All Filters
          </button>
        </aside>

        <!-- ─── Main Search Content ────────────────────────────────────────── -->
        <div class="search-main">
          <!-- Search input bar -->
          <div class="search-input-card">
            <form (submit)="onSearchSubmit($event)" style="display:flex;gap:12px;width:100%">
              <input
                type="text"
                class="search-bar-input"
                placeholder="Search by keywords (e.g. 'science', 'cricket', 'academic')..."
                [(ngModel)]="searchQuery"
                name="searchQuery"
              />
              <button type="submit" class="primary-button" [disabled]="loading()">
                {{ loading() ? 'Searching…' : 'Search' }}
              </button>
            </form>
          </div>

          <!-- Total found & active filters display -->
          <div class="search-info">
            <span *ngIf="!loading()">
              Found <strong>{{ totalResults() }}</strong> results
              <span *ngIf="searchQuery"> for "{{ searchQuery }}"</span>
            </span>
            <span *ngIf="loading()">Searching database...</span>
          </div>

          <!-- Results listing -->
          <div class="results-list">
            @if (loading()) {
              <div class="state-card">
                <p>Loading matching content...</p>
              </div>
            } @else if (results().length === 0) {
              <div class="state-card">
                <h3>No matches found</h3>
                <p>Try refining your search keyword or clearing filters.</p>
              </div>
            } @else {
              @for (item of results(); track item.entity_id) {
                <div class="result-card" (click)="selectItem(item)">
                  <div class="result-header">
                    <span class="type-badge" [class]="item.content_type_slug">
                      {{ item.content_type_slug | uppercase }}
                    </span>
                    <span class="result-date">{{ item.updated_at | date:'mediumDate' }}</span>
                  </div>
                  <h3 class="result-title">{{ item.title }}</h3>
                  <div class="result-footer">
                    <span class="rank-score" *ngIf="item.rank !== undefined">Rank: {{ item.rank | number:'1.2-2' }}</span>
                    <span class="view-link">View Details →</span>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Pagination -->
          @if (totalResults() > pageSize) {
            <div class="table-footer" style="margin-top:20px; border-radius: 14px; border: 1px solid #e2e8f0;">
              <span>Showing {{ results().length }} of {{ totalResults() }}</span>
              <div style="display:flex;gap:8px">
                <button type="button" class="ghost-button" [disabled]="currentOffset() === 0" (click)="prevPage()">← Prev</button>
                <button type="button" class="ghost-button" [disabled]="currentOffset() + pageSize >= totalResults()" (click)="nextPage()">Next →</button>
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ─── Preview Modal ────────────────────────────────────────────────── -->
    <div class="modal-backdrop" *ngIf="selectedItem()">
      <div class="modal-card">
        <header>
          <div>
            <span class="type-badge" [class]="selectedItem()?.content_type_slug">
              {{ selectedItem()?.content_type_slug | uppercase }}
            </span>
            <h2 style="margin-top:8px">{{ selectedItem()?.title }}</h2>
          </div>
          <button type="button" class="icon-close" (click)="closePreview()">×</button>
        </header>

        <section style="display:flex;flex-direction:column;gap:12px">
          <div class="detail-row">
            <strong>Entity ID:</strong>
            <span class="font-mono text-sm">{{ selectedItem()?.entity_id }}</span>
          </div>
          <div class="detail-row">
            <strong>Status:</strong>
            <span class="pill pill-active">{{ selectedItem()?.status }}</span>
          </div>
          <div class="detail-row">
            <strong>Last Updated:</strong>
            <span>{{ selectedItem()?.updated_at | date:'medium' }}</span>
          </div>
        </section>

        <footer>
          <button type="button" class="primary-button" (click)="closePreview()">Close</button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .search-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 24px;
      align-items: start;
    }
    .sidebar-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.04);
    }
    .sidebar-card h3 {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .filter-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .filter-label {
      font-size: 0.78rem;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      color: #334155;
      cursor: pointer;
    }
    .checkbox-label input {
      accent-color: #2563eb;
    }
    .sidebar-select {
      width: 100%;
      padding: 8px 10px;
      font-size: 0.88rem;
    }
    .search-main {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .search-input-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
    }
    .search-bar-input {
      flex: 1;
      font-size: 1rem;
      padding: 12px 16px;
    }
    .search-info {
      font-size: 0.88rem;
      color: #64748b;
    }
    .results-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .result-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
      cursor: pointer;
      transition: all 0.16s ease;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.02);
    }
    .result-card:hover {
      transform: translateY(-2px);
      border-color: #cbd5e1;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .type-badge {
      font-size: 0.72rem;
      font-weight: 800;
      padding: 4px 8px;
      border-radius: 999px;
      letter-spacing: 0.04em;
    }
    .type-badge.blog { background: #eff6ff; color: #1e40af; }
    .type-badge.event { background: #f0fdfa; color: #0f766e; }
    .type-badge.announcement { background: #faf5ff; color: #6b21a8; }
    .type-badge.story { background: #fff7ed; color: #c2410c; }
    .type-badge.page { background: #f8fafc; color: #475569; }
    .type-badge.club { background: #e0e7ff; color: #3730a3; }
    .type-badge.achievement { background: #fef9c3; color: #854d0e; }
    
    .result-date {
      font-size: 0.78rem;
      color: #94a3b8;
    }
    .result-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
      line-height: 1.3;
    }
    .result-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
    }
    .rank-score {
      color: #10b981;
      font-weight: 700;
      background: #ecfdf5;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .view-link {
      color: #2563eb;
      font-weight: 700;
    }
    .state-card {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
      padding: 40px;
      text-align: center;
      color: #64748b;
    }
    .state-card h3 {
      color: #475569;
      margin-bottom: 6px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      padding: 8px 0;
    }
    .detail-row strong {
      color: #475569;
    }
    @media (max-width: 980px) {
      .search-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
  styleUrl: '../admin-shared.scss'
})
export class PublicSearch implements OnInit {
  private readonly searchService = inject(SearchService);
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly orgService = inject(OrganizationService);
  private readonly toast = inject(ToastService);

  // Filter lists fetched dynamically (or caught if forbidden)
  categories = signal<Category[]>([]);
  tags = signal<Tag[]>([]);
  organizations = signal<Organization[]>([]);

  // Bound filters
  searchQuery = '';
  selectedContentType = '';
  sortBy: 'relevance' | 'date' = 'relevance';
  selectedOrgId = '';
  selectedCategoryId = '';
  selectedTagId = '';

  // Results state
  results = signal<SearchResultItem[]>([]);
  totalResults = signal(0);
  loading = signal(false);

  // Pagination
  currentOffset = signal(0);
  readonly pageSize = 15;

  // Selected item for preview
  selectedItem = signal<SearchResultItem | null>(null);

  readonly contentTypes = [
    { label: 'All Types', value: '' },
    { label: 'Blogs', value: 'blog' },
    { label: 'Events', value: 'event' },
    { label: 'Announcements', value: 'announcement' },
    { label: 'Stories', value: 'story' },
    { label: 'Clubs', value: 'club' },
    { label: 'Achievements', value: 'achievement' },
    { label: 'Pages', value: 'page' },
  ];

  ngOnInit() {
    this.loadFilterOptions();
    this.executeSearch();
  }

  loadFilterOptions() {
    // Gracefully catch errors on optional lookup endpoints (e.g. if unauthorized)
    this.orgService.listOrganizations(undefined, true).pipe(
      catchError(() => of([]))
    ).subscribe(orgs => this.organizations.set(orgs));

    this.taxonomyService.listCategories().pipe(
      catchError(() => of([]))
    ).subscribe(cats => this.categories.set(cats));

    this.taxonomyService.listTags().pipe(
      catchError(() => of([]))
    ).subscribe(tags => this.tags.set(tags));
  }

  onSearchSubmit(event: Event) {
    event.preventDefault();
    this.executeSearch(true);
  }

  executeSearch(resetOffset = false) {
    if (resetOffset) {
      this.currentOffset.set(0);
    }

    this.loading.set(true);

    const params: SearchParams = {
      q: this.searchQuery,
      content_type: this.selectedContentType || undefined,
      sort: this.sortBy,
      organization_id: this.selectedOrgId || undefined,
      category_id: this.selectedCategoryId || undefined,
      tag_id: this.selectedTagId || undefined,
      limit: this.pageSize,
      offset: this.currentOffset()
    };

    this.searchService.globalSearch(params).subscribe({
      next: (res) => {
        this.results.set(res.results);
        this.totalResults.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to fetch search results');
        this.loading.set(false);
      }
    });
  }

  resetFilters() {
    this.selectedContentType = '';
    this.sortBy = 'relevance';
    this.selectedOrgId = '';
    this.selectedCategoryId = '';
    this.selectedTagId = '';
    this.executeSearch(true);
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.executeSearch();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.executeSearch();
  }

  selectItem(item: SearchResultItem) {
    this.selectedItem.set(item);
  }

  closePreview() {
    this.selectedItem.set(null);
  }
}
