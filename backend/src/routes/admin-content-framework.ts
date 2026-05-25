import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { ContentService, type ContentStatus } from '../content/content-service.js';
import { badRequest } from '../http/api-error.js';

interface JwtPayload {
  sub: string;
  email: string;
}

interface CreateEntityBody {
  content_type_slug: string;
  title: string;
  slug: string;
  payload?: Record<string, unknown>;
  organization_ids?: string[];
}

interface UpdateEntityBody {
  title?: string;
  slug?: string;
  payload?: Record<string, unknown>;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface AutosaveDraftBody {
  content_type_slug: string;
  entity_id?: string | null;
  draft_key?: string | null;
  payload: Record<string, unknown>;
}

async function getActorContext(request: FastifyRequest): Promise<{ actorId: string; ipAddress?: string; userAgent?: string }> {
  const payload = await request.jwtVerify<JwtPayload>();

  return {
    actorId: payload.sub,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  };
}

export async function adminContentFrameworkRoutes(app: FastifyInstance): Promise<void> {
  const guard = requirePermission('REVIEW_CONTENT');

  app.post<{ Body: CreateEntityBody }>('/api/v1/admin/entities', { preHandler: [guard] }, async (request) => {
    const body = request.body;

    if (!body.content_type_slug || !body.title || !body.slug) {
      throw badRequest('content_type_slug, title, and slug are required');
    }

    const service = new ContentService(request.server.db);
    return service.createEntity(
      {
        contentTypeSlug: body.content_type_slug,
        title: body.title,
        slug: body.slug,
        payload: body.payload ?? {},
        organizationIds: body.organization_ids ?? []
      },
      await getActorContext(request)
    );
  });

  app.patch<{ Params: { contentTypeSlug: string; entityId: string }; Body: UpdateEntityBody }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId',
    { preHandler: [guard] },
    async (request) => {
      const service = new ContentService(request.server.db);
      return service.updateEntity(
        {
          contentTypeSlug: request.params.contentTypeSlug,
          entityId: request.params.entityId,
          title: request.body.title,
          slug: request.body.slug,
          payload: request.body.payload
        },
        await getActorContext(request)
      );
    }
  );

  app.post<{ Params: { contentTypeSlug: string; entityId: string }; Body: StatusBody }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/status',
    { preHandler: [guard] },
    async (request) => {
      if (!request.body.status) {
        throw badRequest('status is required');
      }

      const service = new ContentService(request.server.db);
      return service.transitionStatus(
        {
          contentTypeSlug: request.params.contentTypeSlug,
          entityId: request.params.entityId,
          status: request.body.status,
          remarks: request.body.remarks
        },
        await getActorContext(request)
      );
    }
  );

  app.put<{ Body: AutosaveDraftBody }>('/api/v1/admin/entities/drafts/autosave', { preHandler: [guard] }, async (request) => {
    if (!request.body.content_type_slug || !request.body.payload || typeof request.body.payload !== 'object') {
      throw badRequest('content_type_slug and payload are required');
    }

    const service = new ContentService(request.server.db);
    return service.autosaveDraft(
      {
        contentTypeSlug: request.body.content_type_slug,
        entityId: request.body.entity_id ?? null,
        draftKey: request.body.draft_key ?? null,
        payload: request.body.payload
      },
      await getActorContext(request)
    );
  });
}
