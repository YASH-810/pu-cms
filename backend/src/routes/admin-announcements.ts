import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission, requireStatusPermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { AnnouncementService } from '../announcements/announcement-service.js';
import type { CreateAnnouncementInput, UpdateAnnouncementInput, AnnouncementListFilter } from '../announcements/announcement-service.js';
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

interface CreateAnnouncementBody {
  title: string;
  slug: string;
  announcement_type_id: string;
  summary?: string | null;
  body_html?: string | null;
  pdf_url?: string | null;
  priority?: string;
  valid_from?: string;
  valid_until?: string | null;
  organization_ids?: string[];
}

interface UpdateAnnouncementBody {
  title?: string;
  slug?: string;
  announcement_type_id?: string;
  summary?: string | null;
  body_html?: string | null;
  pdf_url?: string | null;
  priority?: string;
  valid_from?: string;
  valid_until?: string | null;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface ListAnnouncementsQuery {
  status?: string;
  announcement_type_id?: string;
  priority?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function adminAnnouncementsRoutes(app: FastifyInstance): Promise<void> {
  const readGuard = requirePermission('REVIEW_CONTENT');
  const writeGuard = requirePermission('REVIEW_CONTENT');
  const createGuard = requirePermission('REVIEW_CONTENT');
  const deleteGuard = requirePermission('REVIEW_CONTENT');
  const publishGuard = requirePermission('APPROVE_CONTENT');
  const statusGuard = requireStatusPermission('REVIEW_CONTENT', 'APPROVE_CONTENT');

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/announcements/types
  // ---------------------------------------------------------------------------
  app.get('/api/v1/admin/announcements/types', { preHandler: [readGuard] }, async (request) => {
    const service = new AnnouncementService(request.server.db);
    return service.listAnnouncementTypes();
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/announcements
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreateAnnouncementBody }>('/api/v1/admin/announcements', { preHandler: [createGuard] }, async (request) => {
    const body = request.body;

    if (!body.title || !body.slug) {
      throw badRequest('title and slug are required');
    }
    if (!body.announcement_type_id) {
      throw badRequest('announcement_type_id is required');
    }

    const service = new AnnouncementService(request.server.db);
    const context = await getActorContext(request);

    return service.createAnnouncement(
      {
        title: body.title,
        slug: body.slug,
        announcementTypeId: body.announcement_type_id,
        summary: body.summary ?? null,
        bodyHtml: body.body_html ? sanitizeInputHtml(body.body_html) : null,
        pdfUrl: body.pdf_url ?? null,
        priority: body.priority,
        validFrom: body.valid_from,
        validUntil: body.valid_until,
        organizationIds: body.organization_ids ?? []
      } satisfies CreateAnnouncementInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/announcements
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListAnnouncementsQuery }>('/api/v1/admin/announcements', { preHandler: [readGuard] }, async (request) => {
    const { status, announcement_type_id, priority, search, limit, offset } = request.query;
    const service = new AnnouncementService(request.server.db);

    return service.listAnnouncements({
      status: status ?? undefined,
      announcementTypeId: announcement_type_id ?? undefined,
      priority: priority ?? undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies AnnouncementListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/announcements/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/announcements/:id', { preHandler: [readGuard] }, async (request) => {
    const service = new AnnouncementService(request.server.db);
    return service.getAnnouncementById(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/announcements/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateAnnouncementBody }>(
    '/api/v1/admin/announcements/:id',
    { preHandler: [writeGuard] },
    async (request) => {
      const service = new AnnouncementService(request.server.db);
      const context = await getActorContext(request);

      return service.updateAnnouncement(
        {
          id: request.params.id,
          title: request.body.title,
          slug: request.body.slug,
          announcementTypeId: request.body.announcement_type_id,
          summary: request.body.summary,
          bodyHtml: request.body.body_html !== undefined ? (request.body.body_html ? sanitizeInputHtml(request.body.body_html) : null) : undefined,
          pdfUrl: request.body.pdf_url,
          priority: request.body.priority,
          validFrom: request.body.valid_from,
          validUntil: request.body.valid_until
        } satisfies UpdateAnnouncementInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/announcements/:id/status
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: StatusBody }>(
    '/api/v1/admin/announcements/:id/status',
    { preHandler: [statusGuard] },
    async (request) => {
      const { status, remarks } = request.body;
      if (!status) {
        throw badRequest('status is required');
      }

      const service = new AnnouncementService(request.server.db);
      const context = await getActorContext(request);

      return service.transitionStatus(request.params.id, status, remarks ? sanitizeInputHtml(remarks) : undefined, context);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/announcements/:id (soft-archive)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/announcements/:id', { preHandler: [deleteGuard] }, async (request) => {
    const service = new AnnouncementService(request.server.db);
    const context = await getActorContext(request);
    await service.archiveAnnouncement(request.params.id, context);
    return { success: true };
  });
}
