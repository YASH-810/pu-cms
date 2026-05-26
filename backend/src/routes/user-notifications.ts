import type { FastifyInstance, FastifyRequest } from 'fastify';
import { NotificationService } from '../notifications/notification-service.js';

interface JwtPayload {
  sub: string;
  email: string;
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const payload = await request.jwtVerify<JwtPayload>();
  return payload.sub;
}

interface ListNotificationsQuery {
  is_read?: string;
  limit?: string;
  offset?: string;
}

interface MarkReadBody {
  notification_ids?: string[] | string;
}

export async function userNotificationsRoutes(app: FastifyInstance): Promise<void> {
  // Pre-handler hook to ensure authentication for all endpoints in this router
  app.addHook('preHandler', async (request) => {
    await request.jwtVerify();
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/notifications
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListNotificationsQuery }>('/api/v1/notifications', async (request) => {
    const userId = await getUserId(request);
    const { is_read, limit, offset } = request.query;
    const service = new NotificationService(request.server.db);

    const isReadVal = is_read !== undefined ? is_read === 'true' : undefined;

    return service.listNotifications(userId, {
      isRead: isReadVal,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/notifications/unread-count
  // ---------------------------------------------------------------------------
  app.get('/api/v1/notifications/unread-count', async (request) => {
    const userId = await getUserId(request);
    const service = new NotificationService(request.server.db);
    const count = await service.getUnreadCount(userId);
    return { count };
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/notifications/read
  // Marks notifications as read (either specific IDs or all if empty)
  // ---------------------------------------------------------------------------
  app.patch<{ Body: MarkReadBody }>('/api/v1/notifications/read', async (request) => {
    const userId = await getUserId(request);
    const service = new NotificationService(request.server.db);
    await service.markAsRead(userId, request.body.notification_ids);
    return { success: true };
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/notifications/:id/read
  // Marks a specific notification as read
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string } }>('/api/v1/notifications/:id/read', async (request) => {
    const userId = await getUserId(request);
    const service = new NotificationService(request.server.db);
    await service.markAsRead(userId, request.params.id);
    return { success: true };
  });
}
