import type { Knex } from 'knex';

export interface OverviewStats {
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

export interface SearchTrendItem {
  query: string;
  count: number;
  avg_results: number;
}

export interface WorkflowAnalytics {
  avgReviewHours: number;
  totalSubmissions: number;
  totalApprovals: number;
  totalRejections: number;
}

export class AnalyticsService {
  public constructor(private readonly db: Knex) {}

  // -------------------------------------------------------------------------
  // Overview Summary
  // -------------------------------------------------------------------------
  public async getOverviewStats(): Promise<OverviewStats> {
    // Counts by content type
    const contentTypeCounts = await this.db('content_entities as ce')
      .join('content_types as ct', 'ct.id', 'ce.content_type_id')
      .whereNull('ce.deleted_at')
      .select('ct.slug')
      .count('ce.id as count')
      .groupBy('ct.slug');

    const entities: Record<string, number> = {};
    for (const row of contentTypeCounts) {
      entities[String(row.slug)] = Number(row.count);
    }

    // Total view impressions
    const viewsCountRow = await this.db('entity_views').count('id as total').first();
    const totalViews = Number(viewsCountRow?.total ?? 0);

    // Total notifications sent
    const notificationsCountRow = await this.db('notifications').count('id as total').first();
    const totalNotifications = Number(notificationsCountRow?.total ?? 0);

    return {
      entities,
      totalViews,
      totalNotifications
    };
  }

  // -------------------------------------------------------------------------
  // View Traffic Trends
  // -------------------------------------------------------------------------
  public async getViewTrends(interval: 'day' | 'week' | 'month' = 'day', limit = 30): Promise<ViewTrendPoint[]> {
    let truncateUnit = 'day';
    if (interval === 'week') truncateUnit = 'week';
    if (interval === 'month') truncateUnit = 'month';

    const rows = await this.db('entity_views')
      .select(this.db.raw(`date_trunc(?, viewed_at)::date as date`, [truncateUnit]))
      .count('id as count')
      .groupBy('date')
      .orderBy('date', 'desc')
      .limit(limit);

    return rows.map((r: any) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      views: Number(r.count)
    })).reverse(); // Return in chronological order
  }

  public async getTopContent(limit = 10): Promise<TopContentItem[]> {
    const rows = await this.db('entity_views as ev')
      .join('content_entities as ce', 'ce.id', 'ev.entity_id')
      .join('content_types as ct', 'ct.id', 'ev.content_type_id')
      .select(
        'ev.entity_id',
        'ce.title',
        'ct.slug as content_type_slug'
      )
      .count('ev.id as views')
      .groupBy('ev.entity_id', 'ce.title', 'ct.slug')
      .orderBy('views', 'desc')
      .limit(limit);

    return rows.map((r: any) => ({
      entity_id: String(r.entity_id),
      title: String(r.title),
      content_type_slug: String(r.content_type_slug),
      views: Number(r.views)
    }));
  }

  // -------------------------------------------------------------------------
  // Search Trend Analysis
  // -------------------------------------------------------------------------
  public async getSearchTrends(limit = 10): Promise<{ topQueries: SearchTrendItem[]; zeroResultQueries: SearchTrendItem[] }> {
    const topQueries = await this.db('search_queries')
      .select('query')
      .count('id as count')
      .avg('results_count as avg_results')
      .groupBy('query')
      .orderBy('count', 'desc')
      .limit(limit);

    const zeroResultQueries = await this.db('search_queries')
      .where({ results_count: 0 })
      .select('query')
      .count('id as count')
      .groupBy('query')
      .orderBy('count', 'desc')
      .limit(5);

    return {
      topQueries: topQueries.map((q: any) => ({
        query: String(q.query),
        count: Number(q.count),
        avg_results: Math.round(Number(q.avg_results || 0))
      })),
      zeroResultQueries: zeroResultQueries.map((q: any) => ({
        query: String(q.query),
        count: Number(q.count),
        avg_results: 0
      }))
    };
  }

  // -------------------------------------------------------------------------
  // Workflow Bottleneck Analysis
  // -------------------------------------------------------------------------
  public async getWorkflowAnalytics(): Promise<WorkflowAnalytics> {
    // Average hours spent in review state before transition to published/rejected
    const avgRow = await this.db.raw(`
      SELECT AVG(EXTRACT(EPOCH FROM (l2.created_at - l1.created_at)) / 3600) as avg_hours
      FROM entity_approval_logs l1
      JOIN LATERAL (
        SELECT created_at FROM entity_approval_logs
        WHERE entity_id = l1.entity_id
          AND created_at > l1.created_at
          AND status_to IN ('published', 'rejected')
        ORDER BY created_at ASC
        LIMIT 1
      ) l2 ON true
      WHERE l1.status_to = 'review'
    `);

    const avgReviewHours = Math.round(Number(avgRow.rows?.[0]?.avg_hours || 0) * 10) / 10;

    // Total workflow submissions, approvals, rejections counts
    const transitionCounts = await this.db('entity_approval_logs')
      .select('status_to')
      .count('id as count')
      .groupBy('status_to');

    let totalSubmissions = 0;
    let totalApprovals = 0;
    let totalRejections = 0;

    for (const row of transitionCounts) {
      if (row.status_to === 'review') {
        totalSubmissions = Number(row.count);
      } else if (row.status_to === 'published') {
        totalApprovals = Number(row.count);
      } else if (row.status_to === 'rejected') {
        totalRejections = Number(row.count);
      }
    }

    return {
      avgReviewHours,
      totalSubmissions,
      totalApprovals,
      totalRejections
    };
  }
}
