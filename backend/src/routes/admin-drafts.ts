import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { DraftService } from '../drafts/draft-service.js';

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

export async function adminDraftsRoutes(app: FastifyInstance): Promise<void> {
  const guard = requirePermission('REVIEW_CONTENT');

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/drafts
  // List the calling user's saved drafts.
  // Optional ?content_type_slug= filter.
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: { content_type_slug?: string } }>(
    '/api/v1/admin/drafts',
    { preHandler: [guard] },
    async (request) => {
      const context = await getActorContext(request);
      const service = new DraftService(request.server.db);

      const drafts = await service.listDrafts(context.actorId, request.query.content_type_slug ?? null);
      return { drafts, total: drafts.length };
    }
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/drafts/:id
  // Get a single draft with its full payload.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/admin/drafts/:id',
    { preHandler: [guard] },
    async (request) => {
      const context = await getActorContext(request);
      const service = new DraftService(request.server.db);
      return service.getDraft(request.params.id, context.actorId);
    }
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/drafts/:id/restore
  // Return the draft payload structured for client-side form hydration.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/admin/drafts/:id/restore',
    { preHandler: [guard] },
    async (request) => {
      const context = await getActorContext(request);
      const service = new DraftService(request.server.db);
      return service.restoreDraft(request.params.id, context.actorId);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/drafts/:id
  // Soft-delete a saved draft (owner only).
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    '/api/v1/admin/drafts/:id',
    { preHandler: [guard] },
    async (request) => {
      const context = await getActorContext(request);
      const service = new DraftService(request.server.db);
      await service.deleteDraft(request.params.id, context);
      return { success: true };
    }
  );
}
