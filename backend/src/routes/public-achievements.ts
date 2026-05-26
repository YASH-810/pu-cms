import type { FastifyInstance } from 'fastify';
import { AchievementService } from '../achievements/achievement-service.js';
import type { PublicAchievementListFilter } from '../achievements/achievement-service.js';

interface ListPublicAchievementsQuery {
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  achievement_type?: string;
  level?: string;
  is_featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function publicAchievementsRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/achievements
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPublicAchievementsQuery }>('/api/v1/public/achievements', async (request) => {
    const {
      organization_id,
      category_id,
      tag_id,
      achievement_type,
      level,
      is_featured,
      search,
      limit,
      offset
    } = request.query;

    const service = new AchievementService(request.server.db);

    return service.listPublishedAchievements({
      organizationId: organization_id ?? undefined,
      categoryId: category_id ?? undefined,
      tagId: tag_id ?? undefined,
      achievementType: achievement_type ?? undefined,
      level: level ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies PublicAchievementListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/achievements/:slug
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>('/api/v1/public/achievements/:slug', async (request) => {
    const service = new AchievementService(request.server.db);
    const achievement = await service.getPublishedAchievementBySlug(request.params.slug);

    // Fire-and-forget view tracking
    service.trackView(achievement.entity_id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    }).catch(() => { /* non-critical */ });

    return achievement;
  });
}
