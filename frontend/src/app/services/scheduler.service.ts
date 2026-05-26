import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SchedulerJob {
  id: string;
  job_name: string;
  is_active: boolean;
  cron_expression_or_interval: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

export interface JobExecutionLog {
  id: string;
  job_name: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
}

export interface JobLogsResponse {
  logs: JobExecutionLog[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SchedulerService {
  private readonly http = inject(HttpClient);

  listJobs(): Observable<SchedulerJob[]> {
    return this.http.get<{ data: SchedulerJob[] }>('/api/v1/admin/scheduler/jobs').pipe(
      map(res => res.data)
    );
  }

  listLogs(params: { job_name?: string; status?: string; limit?: number; offset?: number } = {}): Observable<JobLogsResponse> {
    let httpParams = new HttpParams();
    if (params.job_name) httpParams = httpParams.set('job_name', params.job_name);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.offset !== undefined) httpParams = httpParams.set('offset', String(params.offset));

    return this.http.get<{ data: JobLogsResponse }>('/api/v1/admin/scheduler/logs', { params: httpParams }).pipe(
      map(res => res.data)
    );
  }

  runJob(jobName: string): Observable<boolean> {
    return this.http.post<{ data: { success: boolean } }>(`/api/v1/admin/scheduler/jobs/${jobName}/run`, {}).pipe(
      map(res => res.data.success)
    );
  }
}
