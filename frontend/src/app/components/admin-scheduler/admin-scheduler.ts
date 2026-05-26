import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SchedulerService, SchedulerJob, JobExecutionLog } from '../../services/scheduler.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-scheduler',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">System Administration</p>
          <h1>Background Job Scheduler</h1>
          <p>Monitor scheduled publishing, automated archival, sitemap generation, and job retries.</p>
        </div>
        <button type="button" class="secondary-button" (click)="refreshAll()">
          Refresh
        </button>
      </header>

      <!-- ─── Registered Jobs List ────────────────────────────────────────── -->
      <h2 style="font-size:1.16rem;font-weight:700;color:#1e293b;margin:0 0 12px">Scheduler Jobs</h2>
      <div class="data-card" style="margin-bottom:24px">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Interval</th>
                <th>Status</th>
                <th>Last Run</th>
                <th>Next Run</th>
                <th class="right">Action</th>
              </tr>
            </thead>
            <tbody>
              @if (loadingJobs()) {
                <tr>
                  <td colspan="6" class="empty-cell">Loading job configurations…</td>
                </tr>
              } @else {
                @for (job of jobs(); track job.id) {
                  <tr>
                    <td>
                      <strong style="color:#0f172a">{{ job.job_name }}</strong>
                    </td>
                    <td>
                      <span class="font-mono text-sm">{{ job.cron_expression_or_interval }}</span>
                    </td>
                    <td>
                      <span class="pill" [class.pill-active]="job.is_active" [class.pill-draft]="!job.is_active">
                        {{ job.is_active ? 'Active' : 'Paused' }}
                      </span>
                    </td>
                    <td>
                      {{ job.last_run_at ? (job.last_run_at | date:'medium') : 'Never' }}
                    </td>
                    <td>
                      {{ job.next_run_at ? (job.next_run_at | date:'medium') : '—' }}
                    </td>
                    <td class="right">
                      <button
                        type="button"
                        class="primary-button run-btn"
                        [disabled]="triggering() === job.job_name"
                        (click)="triggerJob(job.job_name)"
                      >
                        {{ triggering() === job.job_name ? 'Running…' : 'Run Now ⚡' }}
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- ─── Job Execution Logs ──────────────────────────────────────────── -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="font-size:1.16rem;font-weight:700;color:#1e293b;margin:0">Execution Logs</h2>
      </div>

      <div class="data-card">
        <!-- Logs Toolbar Filters -->
        <div class="card-toolbar" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <label class="select-field">
            <select [(ngModel)]="filterJobName" (ngModelChange)="onFilterChange()" id="logs-job-filter">
              <option value="">All Jobs</option>
              @for (job of jobs(); track job.id) {
                <option [value]="job.job_name">{{ job.job_name }}</option>
              }
            </select>
          </label>

          <label class="select-field">
            <select [(ngModel)]="filterStatus" (ngModelChange)="onFilterChange()" id="logs-status-filter">
              <option value="">All Statuses</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Status</th>
                <th>Started At</th>
                <th>Duration (ms)</th>
                <th>Retries</th>
                <th>Details / Error</th>
              </tr>
            </thead>
            <tbody>
              @if (loadingLogs()) {
                <tr>
                  <td colspan="6" class="empty-cell">Loading execution history…</td>
                </tr>
              } @else if (logs().length === 0) {
                <tr>
                  <td colspan="6" class="empty-cell">No logs matched the selected filters.</td>
                </tr>
              } @else {
                @for (log of logs(); track log.id) {
                  <tr>
                    <td>{{ log.job_name }}</td>
                    <td>
                      <span class="pill" [class]="statusClass(log.status)">
                        {{ log.status }}
                      </span>
                    </td>
                    <td>{{ log.started_at | date:'medium' }}</td>
                    <td>
                      {{ durationMs(log) }}
                    </td>
                    <td>{{ log.retry_count }}</td>
                    <td>
                      @if (log.error_message) {
                        <span class="error-text font-mono" [title]="log.error_message">{{ truncateError(log.error_message) }}</span>
                      } @else if (log.status === 'completed') {
                        <span class="success-text">Success</span>
                      } @else {
                        <span class="running-text">Running…</span>
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
            <span>Showing {{ logs().length }} of {{ total() }} logs</span>
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
    .run-btn {
      padding: 6px 10px;
      font-size: 0.8rem;
      border-radius: 8px;
    }
    .text-sm {
      font-size: 0.82rem;
    }
    .error-text {
      color: #ef4444;
      font-size: 0.82rem;
    }
    .success-text {
      color: #10b981;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .running-text {
      color: #3b82f6;
      font-size: 0.82rem;
    }
  `],
  styleUrl: '../admin-shared.scss'
})
export class AdminScheduler implements OnInit {
  private readonly schedulerService = inject(SchedulerService);
  private readonly toast = inject(ToastService);

  jobs = signal<SchedulerJob[]>([]);
  logs = signal<JobExecutionLog[]>([]);
  total = signal(0);

  loadingJobs = signal(false);
  loadingLogs = signal(false);
  triggering = signal<string | null>(null);

  filterJobName = '';
  filterStatus = '';
  currentOffset = signal(0);
  readonly pageSize = 20;

  ngOnInit() {
    this.refreshAll();
  }

  refreshAll() {
    this.loadJobs();
    this.loadLogs();
  }

  loadJobs() {
    this.loadingJobs.set(true);
    this.schedulerService.listJobs().subscribe({
      next: (res) => {
        this.jobs.set(res);
        this.loadingJobs.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load job configs');
        this.loadingJobs.set(false);
      }
    });
  }

  loadLogs() {
    this.loadingLogs.set(true);
    this.schedulerService.listLogs({
      job_name: this.filterJobName || undefined,
      status: this.filterStatus || undefined,
      limit: this.pageSize,
      offset: this.currentOffset()
    }).subscribe({
      next: (res) => {
        this.logs.set(res.logs);
        this.total.set(res.total);
        this.loadingLogs.set(false);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Failed to load execution logs');
        this.loadingLogs.set(false);
      }
    });
  }

  triggerJob(jobName: string) {
    this.triggering.set(jobName);
    this.schedulerService.runJob(jobName).subscribe({
      next: () => {
        this.toast.success(`Rerun command triggered for: ${jobName}`);
        this.triggering.set(null);
        setTimeout(() => this.refreshAll(), 1500); // Allow time for run to record
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Manual trigger failed');
        this.triggering.set(null);
      }
    });
  }

  onFilterChange() {
    this.currentOffset.set(0);
    this.loadLogs();
  }

  prevPage() {
    this.currentOffset.update(o => Math.max(0, o - this.pageSize));
    this.loadLogs();
  }

  nextPage() {
    this.currentOffset.update(o => o + this.pageSize);
    this.loadLogs();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  statusClass(status: string): string {
    switch (status) {
      case 'completed': return 'pill pill-active'; // Green
      case 'failed':    return 'pill pill-rejected'; // Red
      case 'running':   return 'pill pill-review'; // Orange
      default:          return 'pill';
    }
  }

  durationMs(log: JobExecutionLog): string {
    if (!log.completed_at) return '—';
    const start = new Date(log.started_at).getTime();
    const end = new Date(log.completed_at).getTime();
    return `${end - start} ms`;
  }

  truncateError(err: string): string {
    if (!err) return '';
    return err.length > 50 ? `${err.slice(0, 50)}…` : err;
  }
}
