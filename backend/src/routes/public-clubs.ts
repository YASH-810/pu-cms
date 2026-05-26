import type { FastifyInstance } from 'fastify';
import { ClubService } from '../clubs/club-service.js';
import type { PublicClubListFilter } from '../clubs/club-service.js';

interface ListPublicClubsQuery {
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function publicClubsRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/clubs
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPublicClubsQuery }>('/api/v1/public/clubs', async (request) => {
    const {
      organization_id,
      category_id,
      tag_id,
      search,
      limit,
      offset
    } = request.query;

    const service = new ClubService(request.server.db);

    return service.listPublishedClubs({
      organizationId: organization_id ?? undefined,
      categoryId: category_id ?? undefined,
      tagId: tag_id ?? undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies PublicClubListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/clubs/:slug
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>('/api/v1/public/clubs/:slug', async (request) => {
    const service = new ClubService(request.server.db);
    const club = await service.getPublishedClubBySlug(request.params.slug);

    // Fire-and-forget view tracking
    service.trackView(club.entity_id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    }).catch(() => { /* non-critical */ });

    return club;
  });
}
