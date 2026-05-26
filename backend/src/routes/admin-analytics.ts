import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { AnalyticsService } from '../analytics/analytics-service.js';

interface ViewTrendQuery {
  interval?: 'day' | 'week' | 'month';
  limit?: string;
}

export async function adminAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  const readGuard = requirePermission('REVIEW_CONTENT'); // Shared reviewer metrics access

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/analytics/overview
  // ---------------------------------------------------------------------------
  app.get('/api/v1/admin/analytics/overview', { preHandler: [readGuard] }, async (request) => {
    const service = new AnalyticsService(request.server.db);
    return service.getOverviewStats();
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/analytics/views
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ViewTrendQuery }>('/api/v1/admin/analytics/views', { preHandler: [readGuard] }, async (request) => {
    const { interval, limit } = request.query;
    const service = new AnalyticsService(request.server.db);

    const trend = await service.getViewTrends(
      interval || 'day',
      limit ? Number(limit) : 30
    );

    const top = await service.getTopContent();

    return {
      trend,
      top
    };
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/analytics/search
  // ---------------------------------------------------------------------------
  app.get('/api/v1/admin/analytics/search', { preHandler: [readGuard] }, async (request) => {
    const service = new AnalyticsService(request.server.db);
    return service.getSearchTrends();
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/analytics/workflow
  // ---------------------------------------------------------------------------
  app.get('/api/v1/admin/analytics/workflow', { preHandler: [readGuard] }, async (request) => {
    const service = new AnalyticsService(request.server.db);
    return service.getWorkflowAnalytics();
  });
}
