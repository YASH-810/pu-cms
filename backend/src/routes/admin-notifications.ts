import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { NotificationService } from '../notifications/notification-service.js';

interface JwtPayload {
  sub: string;
  email: string;
}

async function getActorId(request: FastifyRequest): Promise<string> {
  const payload = await request.jwtVerify<JwtPayload>();
  return payload.sub;
}

interface UpdateTemplateBody {
  subject_template?: string;
  body_template?: string;
}

export async function adminNotificationsRoutes(app: FastifyInstance): Promise<void> {
  const templateGuard = requirePermission('MANAGE_USERS'); // Protected system config

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/notification-templates
  // ---------------------------------------------------------------------------
  app.get('/api/v1/admin/notification-templates', { preHandler: [templateGuard] }, async (request) => {
    const service = new NotificationService(request.server.db);
    return service.listTemplates();
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/notification-templates/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateTemplateBody }>(
    '/api/v1/admin/notification-templates/:id',
    { preHandler: [templateGuard] },
    async (request) => {
      const { subject_template, body_template } = request.body;
      if (subject_template === undefined && body_template === undefined) {
        throw badRequest('subject_template or body_template must be provided');
      }

      const service = new NotificationService(request.server.db);
      const actorId = await getActorId(request);

      return service.updateTemplate(request.params.id, { subject_template, body_template }, actorId);
    }
  );
}
