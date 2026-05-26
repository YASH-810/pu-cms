import type { FastifyInstance } from 'fastify';
import { EventService } from '../events/event-service.js';

interface ListPublicEventsQuery {
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  event_type?: string;
  event_mode?: string;
  is_featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function publicEventsRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/events
  // Returns published events only. No auth required.
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPublicEventsQuery }>('/api/v1/public/events', async (request) => {
    const {
      organization_id,
      category_id,
      tag_id,
      event_type,
      event_mode,
      is_featured,
      search,
      limit,
      offset
    } = request.query;

    const service = new EventService(request.server.db);

    return service.listPublishedEvents({
      organizationId: organization_id ?? undefined,
      categoryId: category_id ?? undefined,
      tagId: tag_id ?? undefined,
      eventType: event_type ?? undefined,
      eventMode: event_mode ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/events/:slug
  // Returns a single published event by slug and records a view impression.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>('/api/v1/public/events/:slug', async (request) => {
    const service = new EventService(request.server.db);
    const event = await service.getPublishedEventBySlug(request.params.slug);

    // Fire-and-forget view tracking
    service.trackView(event.entity_id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    }).catch(() => { /* non-critical */ });

    return event;
  });
}
