import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission, requireStatusPermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { ClubService } from '../clubs/club-service.js';
import type { CreateClubInput, UpdateClubInput, ClubListFilter } from '../clubs/club-service.js';
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

interface CreateClubBody {
  title: string;
  slug: string;
  organization_id: string;
  leadership?: Record<string, unknown> | null;
  social_links?: Record<string, unknown> | null;
  meeting_schedule?: string | null;
  joining_process?: string | null;
}

interface UpdateClubBody {
  title?: string;
  slug?: string;
  organization_id?: string;
  leadership?: Record<string, unknown> | null;
  social_links?: Record<string, unknown> | null;
  meeting_schedule?: string | null;
  joining_process?: string | null;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface ListClubsQuery {
  status?: string;
  organization_id?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function adminClubsRoutes(app: FastifyInstance): Promise<void> {
  const readGuard = requirePermission('UPDATE_CLUB');
  const writeGuard = requirePermission('UPDATE_CLUB');
  const createGuard = requirePermission('CREATE_CLUB');
  const deleteGuard = requirePermission('DELETE_CLUB');
  const publishGuard = requirePermission('APPROVE_CLUB');
  const statusGuard = requireStatusPermission('UPDATE_CLUB', 'APPROVE_CLUB');

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/clubs
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreateClubBody }>('/api/v1/admin/clubs', { preHandler: [createGuard] }, async (request) => {
    const body = request.body;

    if (!body.title || !body.slug) {
      throw badRequest('title and slug are required');
    }
    if (!body.organization_id) {
      throw badRequest('organization_id is required');
    }

    const service = new ClubService(request.server.db);
    const context = await getActorContext(request);

    return service.createClub(
      {
        title: body.title,
        slug: body.slug,
        organizationId: body.organization_id,
        leadership: body.leadership ?? null,
        socialLinks: body.social_links ?? null,
        meetingSchedule: body.meeting_schedule ?? null,
        joiningProcess: body.joining_process ?? null
      } satisfies CreateClubInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/clubs
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListClubsQuery }>('/api/v1/admin/clubs', { preHandler: [readGuard] }, async (request) => {
    const { status, organization_id, search, limit, offset } = request.query;
    const service = new ClubService(request.server.db);

    return service.listClubs({
      status: status ?? undefined,
      organizationId: organization_id ?? undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies ClubListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/clubs/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/clubs/:id', { preHandler: [readGuard] }, async (request) => {
    const service = new ClubService(request.server.db);
    return service.getClubById(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/clubs/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateClubBody }>(
    '/api/v1/admin/clubs/:id',
    { preHandler: [writeGuard] },
    async (request) => {
      const service = new ClubService(request.server.db);
      const context = await getActorContext(request);

      return service.updateClub(
        {
          id: request.params.id,
          title: request.body.title,
          slug: request.body.slug,
          organizationId: request.body.organization_id,
          leadership: request.body.leadership,
          socialLinks: request.body.social_links,
          meetingSchedule: request.body.meeting_schedule,
          joiningProcess: request.body.joining_process
        } satisfies UpdateClubInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/clubs/:id/status
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: StatusBody }>(
    '/api/v1/admin/clubs/:id/status',
    { preHandler: [statusGuard] },
    async (request) => {
      const { status, remarks } = request.body;
      if (!status) {
        throw badRequest('status is required');
      }

      const service = new ClubService(request.server.db);
      const context = await getActorContext(request);

      return service.transitionStatus(request.params.id, status, remarks ? sanitizeInputHtml(remarks) : undefined, context);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/clubs/:id (soft-archive)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/clubs/:id', { preHandler: [deleteGuard] }, async (request) => {
    const service = new ClubService(request.server.db);
    const context = await getActorContext(request);
    await service.archiveClub(request.params.id, context);
    return { success: true };
  });
}
