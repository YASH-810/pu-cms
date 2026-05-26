import type { FastifyInstance } from 'fastify';
import { PageService } from '../pages/page-service.js';

interface ListPublicPagesQuery {
  search?: string;
  limit?: string;
  offset?: string;
}

export async function publicPagesRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/pages
  // Returns published pages only. No auth required.
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPublicPagesQuery }>('/api/v1/public/pages', async (request) => {
    const { search, limit, offset } = request.query;
    const service = new PageService(request.server.db);

    return service.listPublishedPages({
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/pages/:slug
  // Returns a single published page by slug and records a view impression.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>('/api/v1/public/pages/:slug', async (request) => {
    const service = new PageService(request.server.db);
    const page = await service.getPublishedPageBySlug(request.params.slug);

    // Fire-and-forget view tracking — do not block the response
    service.trackView(page.entity_id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    }).catch(() => { /* non-critical */ });

    return page;
  });
}
