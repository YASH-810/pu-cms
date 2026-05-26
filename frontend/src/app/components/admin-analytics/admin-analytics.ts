import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { AnalyticsService, OverviewMetrics, ViewsReport, SearchReport, WorkflowReport, ViewTrendPoint, TopContentItem, SearchTrendItem } from '../../services/analytics.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Insights & Compliance</p>
          <h1>System Analytics</h1>
          <p>Analyze content view metrics, search query logs, and editorial workflow timelines.</p>
        </div>
        <button type="button" class="secondary-button" (click)="refreshAll()">
          Refresh Data
        </button>
      </header>

      <!-- ─── Core KPI Metrics ──────────────────────────────────────────────── -->
      <div class="metric-grid">
        <div class="metric-card gradient-blue">
          <span>Total Page Impressions</span>
          <strong>{{ metrics()?.totalViews || 0 | number }}</strong>
        </div>
        <div class="metric-card gradient-teal">
          <span>Workflow Average Duration</span>
          <strong>{{ workflow()?.avgReviewHours || 0 }} hrs</strong>
        </div>
        <div class="metric-card gradient-purple">
          <span>In-App Messages Dispatched</span>
          <strong>{{ metrics()?.totalNotifications || 0 | number }}</strong>
        </div>
      </div>

      <!-- ─── Traffic Over Time SVG Graph ────────────────────────────────────── -->
      <div class="data-card" style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <h2 style="font-size:1.1rem;font-weight:700;color:#1e293b;margin:0">Views Traffic (Last 15 Runs/Days)</h2>
          <div style="font-size:0.8rem;color:#64748b">Showing daily view fluctuations</div>
        </div>

        @if (viewTrend().length > 0) {
          <div class="chart-container">
            <svg class="traffic-svg" viewBox="0 0 600 200" preserveAspectRatio="none">
              <!-- Grid lines -->
              <line x1="0" y1="50" x2="600" y2="50" stroke="#f1f5f9" stroke-width="1" />
              <line x1="0" y1="100" x2="600" y2="100" stroke="#f1f5f9" stroke-width="1" />
              <line x1="0" y1="150" x2="600" y2="150" stroke="#f1f5f9" stroke-width="1" />

              <!-- Polyline path -->
              <polyline
                fill="none"
                stroke="url(#chart-grad)"
                stroke-width="3"
                [attr.points]="chartPoints()"
              />

              <!-- Area under the curve -->
              <polygon
                fill="url(#chart-area-grad)"
                [attr.points]="areaPoints()"
              />

              <!-- Data points -->
              @for (pt of chartCoordinates(); track $index) {
                <circle
                  [attr.cx]="pt.x"
                  [attr.cy]="pt.y"
                  r="5"
                  fill="#3b82f6"
                  stroke="#fff"
                  stroke-width="1.5"
                  [attr.title]="pt.label + ': ' + pt.value"
                />
              }

              <!-- Gradients definition -->
              <defs>
                <linearGradient id="chart-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#3b82f6" />
                  <stop offset="100%" stop-color="#14b8a6" />
                </linearGradient>
                <linearGradient id="chart-area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.14" />
                  <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
                </linearGradient>
              </defs>
            </svg>

            <!-- X Axis Labels -->
            <div class="chart-x-axis">
              @for (pt of chartCoordinates(); track $index) {
                <span class="x-label">{{ pt.shortDate }}</span>
              }
            </div>
          </div>
        } @else {
          <div style="height:200px;display:grid;place-items:center;color:#64748b;font-size:0.9rem">
            No traffic data available. Visit pages to generate view analytics.
          </div>
        }
      </div>

      <!-- ─── Split Reports grid ─────────────────────────────────────────────── -->
      <div class="analytics-grid">
        <!-- Column 1: Top Content -->
        <div class="data-card">
          <h2 style="font-size:1.06rem;font-weight:700;color:#1e293b;margin:0 0 16px">Top Content by Views</h2>
          <div class="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Module</th>
                  <th class="right">Views</th>
                </tr>
              </thead>
              <tbody>
                @if (topContent().length === 0) {
                  <tr>
                    <td colspan="3" class="empty-cell">No viewed entities recorded yet.</td>
                  </tr>
                } @else {
                  @for (c of topContent(); track c.entity_id) {
                    <tr>
                      <td>
                        <strong style="color:#334155">{{ c.title }}</strong>
                      </td>
                      <td>
                        <span class="pill pill-draft">{{ c.content_type_slug | titlecase }}</span>
                      </td>
                      <td class="right font-mono font-bold">{{ c.views }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Column 2: Search Trends -->
        <div class="data-card">
          <h2 style="font-size:1.06rem;font-weight:700;color:#1e293b;margin:0 0 16px">Popular Search Keywords</h2>
          <div class="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Query Word</th>
                  <th>Searches</th>
                  <th class="right">Avg Hits</th>
                </tr>
              </thead>
              <tbody>
                @if (searchTrends().length === 0) {
                  <tr>
                    <td colspan="3" class="empty-cell">No search queries logged yet.</td>
                  </tr>
                } @else {
                  @for (s of searchTrends(); track s.query) {
                    <tr>
                      <td>
                        <span class="font-mono" style="color:#2563eb">"{{ s.query }}"</span>
                      </td>
                      <td>{{ s.count }} times</td>
                      <td class="right font-mono">{{ s.avg_results }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Column 3: Workflow Performance -->
        <div class="data-card">
          <h2 style="font-size:1.06rem;font-weight:700;color:#1e293b;margin:0 0 16px">Editorial Throughput</h2>
          <div class="workflow-stat-box">
            <div class="stat-item">
              <span>Submissions</span>
              <strong>{{ workflow()?.totalSubmissions || 0 }}</strong>
            </div>
            <div class="stat-item">
              <span>Approvals</span>
              <strong>{{ workflow()?.totalApprovals || 0 }}</strong>
            </div>
            <div class="stat-item">
              <span>Rejections</span>
              <strong>{{ workflow()?.totalRejections || 0 }}</strong>
            </div>
          </div>

          <div style="margin-top:20px;padding:12px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0">
            <span style="font-size:0.8rem;color:#64748b;display:block;margin-bottom:4px">Review Cycle Speed</span>
            <p style="font-size:0.88rem;color:#334155;margin:0">
              Content spends an average of <strong>{{ workflow()?.avgReviewHours || 0 }} hours</strong> in the <span class="pill pill-review">review</span> status before an editor approves or rejects it.
            </p>
          </div>
        </div>

        <!-- Column 4: Failed Search Terms -->
        <div class="data-card">
          <h2 style="font-size:1.06rem;font-weight:700;color:#1e293b;margin:0 0 16px">Queries with Zero Results</h2>
          <div class="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Failed Keyword</th>
                  <th class="right">Misses</th>
                </tr>
              </thead>
              <tbody>
                @if (zeroResultQueries().length === 0) {
                  <tr>
                    <td colspan="2" class="empty-cell">No zero-result query events.</td>
                  </tr>
                } @else {
                  @for (z of zeroResultQueries(); track z.query) {
                    <tr>
                      <td>
                        <span class="font-mono text-danger">"{{ z.query }}"</span>
                      </td>
                      <td class="right font-mono">{{ z.count }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .gradient-blue {
      background: linear-gradient(135deg, #eff6ff, #dbeafe);
      border: 1px solid #bfdbfe;
      color: #1e3a8a;
    }
    .gradient-teal {
      background: linear-gradient(135deg, #f0fdfa, #ccfbf1);
      border: 1px solid #99f6e4;
      color: #115e59;
    }
    .gradient-purple {
      background: linear-gradient(135deg, #faf5ff, #f3e8ff);
      border: 1px solid #e9d5ff;
      color: #581c87;
    }
    .chart-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 10px 0;
    }
    .traffic-svg {
      width: 100%;
      height: 180px;
      overflow: visible;
    }
    .chart-x-axis {
      display: flex;
      justify-content: space-between;
      padding: 0 4px;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
    }
    .x-label {
      font-size: 0.72rem;
      color: #64748b;
      font-family: monospace;
      width: 40px;
      text-align: center;
    }
    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 24px;
    }
    .compact-table td, .compact-table th {
      padding: 10px 8px;
      font-size: 0.88rem;
    }
    .workflow-stat-box {
      display: flex;
      justify-content: space-around;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .stat-item span {
      font-size: 0.78rem;
      color: #64748b;
      font-weight: 700;
    }
    .stat-item strong {
      font-size: 1.48rem;
      color: #0f172a;
    }
    .text-danger {
      color: #e11d48;
    }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminAnalytics implements OnInit {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly toast = inject(ToastService);

  metrics = signal<OverviewMetrics | null>(null);
  viewTrend = signal<ViewTrendPoint[]>([]);
  topContent = signal<TopContentItem[]>([]);
  searchTrends = signal<SearchTrendItem[]>([]);
  zeroResultQueries = signal<SearchTrendItem[]>([]);
  workflow = signal<WorkflowReport | null>(null);

  // Computed properties to map data points to SVG coordinates
  chartCoordinates = computed(() => {
    const trend = this.viewTrend();
    if (trend.length === 0) return [];

    const maxVal = Math.max(...trend.map(t => t.views), 10);
    const stepX = 600 / Math.max(trend.length - 1, 1);

    return trend.map((t, idx) => {
      // Map view count value into Y boundary of 200px (180px drawable height, padded)
      const ratio = t.views / maxVal;
      const yCoord = 170 - (ratio * 140); // 30px top padding, 170px bottom padding
      const shortDate = t.date.split('-').slice(1).join('/'); // MM/DD format
      return {
        x: idx * stepX,
        y: yCoord,
        value: t.views,
        label: t.date,
        shortDate
      };
    });
  });

  chartPoints = computed(() => {
    return this.chartCoordinates().map(pt => `${pt.x},${pt.y}`).join(' ');
  });

  areaPoints = computed(() => {
    const coords = this.chartCoordinates();
    if (coords.length === 0) return '';
    const pointsStr = coords.map(pt => `${pt.x},${pt.y}`).join(' ');
    // Close polygon at baseline (y=200)
    return `0,200 ${pointsStr} ${coords[coords.length - 1].x},200`;
  });

  ngOnInit() {
    this.refreshAll();
  }

  refreshAll() {
    this.loadOverview();
    this.loadViews();
    this.loadSearch();
    this.loadWorkflow();
  }

  loadOverview() {
    this.analyticsService.getOverview().subscribe({
      next: (res) => this.metrics.set(res),
      error: (err) => this.toast.fromApiError(err, 'Failed to load KPI overview')
    });
  }

  loadViews() {
    // Load last 15 days data points
    this.analyticsService.getViewsReport('day', 15).subscribe({
      next: (res) => {
        this.viewTrend.set(res.trend);
        this.topContent.set(res.top);
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to load view traffic')
    });
  }

  loadSearch() {
    this.analyticsService.getSearchReport().subscribe({
      next: (res) => {
        this.searchTrends.set(res.topQueries);
        this.zeroResultQueries.set(res.zeroResultQueries);
      },
      error: (err) => this.toast.fromApiError(err, 'Failed to load search trends')
    });
  }

  loadWorkflow() {
    this.analyticsService.getWorkflowReport().subscribe({
      next: (res) => this.workflow.set(res),
      error: (err) => this.toast.fromApiError(err, 'Failed to load workflow speed')
    });
  }
}
