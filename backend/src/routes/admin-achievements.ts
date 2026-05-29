import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission, requireStatusPermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { AchievementService } from '../achievements/achievement-service.js';
import type { CreateAchievementInput, UpdateAchievementInput, AchievementListFilter } from '../achievements/achievement-service.js';
import type { ContentStatus } from '../content/content-service.js';
import { sanitizeInputHtml } from '../utils/sanitizer.js';

interface JwtPayload {
  sub: string;
  email: string;
}

async function getActorContext(request: FastifyRequest): Promise<{ actorId: string; ipAddress?: string; userAgent?: string }> {
  const payload = await request.jwtVerify<JwtPayload>();
  return {
    actorId: payload.sub,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  };
}

interface CreateAchievementBody {
  title: string;
  slug: string;
  achievement_type: string;
  level: string;
  awarded_at: string;
  awarded_by: string;
  prize_amount?: number | null;
  is_featured?: boolean;
  organization_ids?: string[];
}

interface UpdateAchievementBody {
  title?: string;
  slug?: string;
  achievement_type?: string;
  level?: string;
  awarded_at?: string;
  awarded_by?: string;
  prize_amount?: number | null;
  is_featured?: boolean;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface ListAchievementsQuery {
  status?: string;
  achievement_type?: string;
  level?: string;
  is_featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function adminAchievementsRoutes(app: FastifyInstance): Promise<void> {
  const readGuard = requirePermission('REVIEW_CONTENT');
  const writeGuard = requirePermission('REVIEW_CONTENT');
  const createGuard = requirePermission('REVIEW_CONTENT');
  const deleteGuard = requirePermission('REVIEW_CONTENT');
  const publishGuard = requirePermission('APPROVE_CONTENT');
  const statusGuard = requireStatusPermission('REVIEW_CONTENT', 'APPROVE_CONTENT');

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/achievements
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreateAchievementBody }>('/api/v1/admin/achievements', { preHandler: [createGuard] }, async (request) => {
    const body = request.body;

    if (!body.title || !body.slug) {
      throw badRequest('title and slug are required');
    }
    if (!body.achievement_type || !body.level || !body.awarded_by || !body.awarded_at) {
      throw badRequest('achievement_type, level, awarded_by, and awarded_at are required');
    }

    const service = new AchievementService(request.server.db);
    const context = await getActorContext(request);

    return service.createAchievement(
      {
        title: body.title,
        slug: body.slug,
        achievementType: body.achievement_type,
        level: body.level,
        awardedAt: body.awarded_at,
        awardedBy: body.awarded_by,
        prizeAmount: body.prize_amount ?? null,
        isFeatured: body.is_featured ?? false,
        organizationIds: body.organization_ids ?? []
      } satisfies CreateAchievementInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/achievements
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListAchievementsQuery }>('/api/v1/admin/achievements', { preHandler: [readGuard] }, async (request) => {
    const { status, achievement_type, level, is_featured, search, limit, offset } = request.query;
    const service = new AchievementService(request.server.db);

    return service.listAchievements({
      status: status ?? undefined,
      achievementType: achievement_type ?? undefined,
      level: level ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies AchievementListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/achievements/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/achievements/:id', { preHandler: [readGuard] }, async (request) => {
    const service = new AchievementService(request.server.db);
    return service.getAchievementById(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/achievements/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateAchievementBody }>(
    '/api/v1/admin/achievements/:id',
    { preHandler: [writeGuard] },
    async (request) => {
      const service = new AchievementService(request.server.db);
      const context = await getActorContext(request);

      return service.updateAchievement(
        {
          id: request.params.id,
          title: request.body.title,
          slug: request.body.slug,
          achievementType: request.body.achievement_type,
          level: request.body.level,
          awardedAt: request.body.awarded_at,
          awardedBy: request.body.awarded_by,
          prizeAmount: request.body.prize_amount,
          isFeatured: request.body.is_featured
        } satisfies UpdateAchievementInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/achievements/:id/status
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: StatusBody }>(
    '/api/v1/admin/achievements/:id/status',
    { preHandler: [statusGuard] },
    async (request) => {
      const { status, remarks } = request.body;
      if (!status) {
        throw badRequest('status is required');
      }

      const service = new AchievementService(request.server.db);
      const context = await getActorContext(request);

      return service.transitionStatus(request.params.id, status, remarks ? sanitizeInputHtml(remarks) : undefined, context);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/achievements/:id (soft-archive)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/achievements/:id', { preHandler: [deleteGuard] }, async (request) => {
    const service = new AchievementService(request.server.db);
    const context = await getActorContext(request);
    await service.archiveAchievement(request.params.id, context);
    return { success: true };
  });
}
