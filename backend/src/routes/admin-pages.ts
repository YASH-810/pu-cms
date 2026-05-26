import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { PageService, type CreatePageInput, type UpdatePageInput } from '../pages/page-service.js';
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

interface CreatePageBody {
  title: string;
  slug: string;
  summary?: string | null;
  body_html?: string | null;
  template?: string;
  hero_image_url?: string | null;
  is_featured?: boolean;
  show_in_nav?: boolean;
  organization_ids?: string[];
}

interface UpdatePageBody {
  title?: string;
  slug?: string;
  summary?: string | null;
  body_html?: string | null;
  template?: string;
  hero_image_url?: string | null;
  is_featured?: boolean;
  show_in_nav?: boolean;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface ListPagesQuery {
  status?: string;
  is_featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function adminPagesRoutes(app: FastifyInstance): Promise<void> {
  const readGuard  = requirePermission('UPDATE_PAGE');
  const writeGuard = requirePermission('UPDATE_PAGE');
  const createGuard = requirePermission('CREATE_PAGE');
  const deleteGuard = requirePermission('DELETE_PAGE');
  const publishGuard = requirePermission('PUBLISH_PAGE');

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/pages
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreatePageBody }>('/api/v1/admin/pages', { preHandler: [createGuard] }, async (request) => {
    const body = request.body;

    if (!body.title || !body.slug) {
      throw badRequest('title and slug are required');
    }

    const service = new PageService(request.server.db);
    const context = await getActorContext(request);

    return service.createPage(
      {
        title: body.title,
        slug: body.slug,
        summary: body.summary ?? null,
        bodyHtml: body.body_html ? sanitizeInputHtml(body.body_html) : null,
        template: body.template ?? 'default',
        heroImageUrl: body.hero_image_url ?? null,
        isFeatured: body.is_featured ?? false,
        showInNav: body.show_in_nav ?? false,
        organizationIds: body.organization_ids ?? []
      } satisfies CreatePageInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/pages
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPagesQuery }>('/api/v1/admin/pages', { preHandler: [readGuard] }, async (request) => {
    const { status, is_featured, search, limit, offset } = request.query;
    const service = new PageService(request.server.db);

    return service.listPages({
      status: status ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/pages/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/pages/:id', { preHandler: [readGuard] }, async (request) => {
    const service = new PageService(request.server.db);
    return service.getPageById(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/pages/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdatePageBody }>(
    '/api/v1/admin/pages/:id',
    { preHandler: [writeGuard] },
    async (request) => {
      const service = new PageService(request.server.db);
      const context = await getActorContext(request);

      return service.updatePage(
        {
          id: request.params.id,
          title: request.body.title,
          slug: request.body.slug,
          summary: request.body.summary,
          bodyHtml: request.body.body_html !== undefined ? (request.body.body_html ? sanitizeInputHtml(request.body.body_html) : null) : undefined,
          template: request.body.template,
          heroImageUrl: request.body.hero_image_url,
          isFeatured: request.body.is_featured,
          showInNav: request.body.show_in_nav
        } satisfies UpdatePageInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/pages/:id/status
  // Use PUBLISH_PAGE guard for publish/archive; REVIEW_CONTENT for submit/review.
  // For simplicity we check PUBLISH_PAGE here — the content-service enforces
  // the legal transition state machine regardless.
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: StatusBody }>(
    '/api/v1/admin/pages/:id/status',
    { preHandler: [publishGuard] },
    async (request) => {
      const { status, remarks } = request.body;
      if (!status) {
        throw badRequest('status is required');
      }

      const service = new PageService(request.server.db);
      const context = await getActorContext(request);

      return service.transitionStatus(request.params.id, status, remarks ? sanitizeInputHtml(remarks) : undefined, context);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/pages/:id  (soft-archive)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/pages/:id', { preHandler: [deleteGuard] }, async (request) => {
    const service = new PageService(request.server.db);
    const context = await getActorContext(request);
    await service.archivePage(request.params.id, context);
    return { success: true };
  });
}
