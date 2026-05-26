import type { FastifyInstance } from 'fastify';
import { AnnouncementService } from '../announcements/announcement-service.js';
import type { PublicAnnouncementListFilter } from '../announcements/announcement-service.js';

interface ListPublicAnnouncementsQuery {
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  announcement_type_id?: string;
  priority?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function publicAnnouncementsRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/announcements/types
  // ---------------------------------------------------------------------------
  app.get('/api/v1/public/announcements/types', async (request) => {
    const service = new AnnouncementService(request.server.db);
    return service.listAnnouncementTypes();
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/announcements
  // Returns active published announcements only. No auth required.
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPublicAnnouncementsQuery }>('/api/v1/public/announcements', async (request) => {
    const {
      organization_id,
      category_id,
      tag_id,
      announcement_type_id,
      priority,
      search,
      limit,
      offset
    } = request.query;

    const service = new AnnouncementService(request.server.db);

    return service.listPublishedAnnouncements({
      organizationId: organization_id ?? undefined,
      categoryId: category_id ?? undefined,
      tagId: tag_id ?? undefined,
      announcementTypeId: announcement_type_id ?? undefined,
      priority: priority ?? undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies PublicAnnouncementListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/announcements/:slug
  // Returns a single published announcement by slug and records a view.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>('/api/v1/public/announcements/:slug', async (request) => {
    const service = new AnnouncementService(request.server.db);
    const announcement = await service.getPublishedAnnouncementBySlug(request.params.slug);
    // Fire-and-forget view tracking
    service.trackView(announcement.entity_id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    }).catch((err) => { console.error('TRACK VIEW ERROR ANNOUNCEMENT:', err); });

    return announcement;
  });
}
