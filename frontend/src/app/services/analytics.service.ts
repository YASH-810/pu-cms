import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OverviewMetrics {
  entities: Record<string, number>;
  totalViews: number;
  totalNotifications: number;
}

export interface ViewTrendPoint {
  date: string;
  views: number;
}

export interface TopContentItem {
  entity_id: string;
  title: string;
  content_type_slug: string;
  views: number;
}

export interface ViewsReport {
  trend: ViewTrendPoint[];
  top: TopContentItem[];
}

export interface SearchTrendItem {
  query: string;
  count: number;
  avg_results: number;
}

export interface SearchReport {
  topQueries: SearchTrendItem[];
  zeroResultQueries: SearchTrendItem[];
}

export interface WorkflowReport {
  avgReviewHours: number;
  totalSubmissions: number;
  totalApprovals: number;
  totalRejections: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<OverviewMetrics> {
    return this.http.get<{ data: OverviewMetrics }>('/api/v1/admin/analytics/overview').pipe(
      map(res => res.data)
    );
  }

  getViewsReport(interval: 'day' | 'week' | 'month' = 'day', limit = 30): Observable<ViewsReport> {
    let httpParams = new HttpParams().set('interval', interval).set('limit', String(limit));
    return this.http.get<{ data: ViewsReport }>('/api/v1/admin/analytics/views', { params: httpParams }).pipe(
      map(res => res.data)
    );
  }

  getSearchReport(): Observable<SearchReport> {
    return this.http.get<{ data: SearchReport }>('/api/v1/admin/analytics/search').pipe(
      map(res => res.data)
    );
  }

  getWorkflowReport(): Observable<WorkflowReport> {
    return this.http.get<{ data: WorkflowReport }>('/api/v1/admin/analytics/workflow').pipe(
      map(res => res.data)
    );
  }
}
