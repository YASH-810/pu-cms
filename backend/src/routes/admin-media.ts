import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { MediaService, type CreateMediaInput, type UpdateMediaInput } from '../media/media-service.js';

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

interface CreateMediaBody {
  content_type_id?: string | null;
  entity_id?: string | null;
  media_type: string;
  media_category?: string | null;
  media_url: string;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  mime_type: string;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  display_order?: number;
  is_featured?: boolean;
}

interface UpdateMediaBody {
  alt_text?: string | null;
  caption?: string | null;
  thumbnail_url?: string | null;
  display_order?: number;
  is_featured?: boolean;
}

interface ListMediaQuery {
  content_type_id?: string;
  entity_id?: string;
  media_type?: string;
  is_featured?: string;
}

export async function adminMediaRoutes(app: FastifyInstance): Promise<void> {
  const guard = requirePermission('MANAGE_MEDIA');

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/media
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreateMediaBody }>('/api/v1/admin/media', { preHandler: [guard] }, async (request) => {
    const body = request.body;

    if (!body.media_type || !body.media_url || !body.mime_type) {
      throw badRequest('media_type, media_url, and mime_type are required');
    }

    const service = new MediaService(request.server.db);
    const context = await getActorContext(request);

    return service.createMedia(
      {
        contentTypeId: body.content_type_id ?? null,
        entityId: body.entity_id ?? null,
        mediaType: body.media_type,
        mediaCategory: body.media_category ?? null,
        mediaUrl: body.media_url,
        thumbnailUrl: body.thumbnail_url ?? null,
        altText: body.alt_text ?? null,
        caption: body.caption ?? null,
        mimeType: body.mime_type,
        fileSize: body.file_size ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        duration: body.duration ?? null,
        displayOrder: body.display_order ?? 1,
        isFeatured: body.is_featured ?? false
      } satisfies CreateMediaInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/media
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListMediaQuery }>('/api/v1/admin/media', { preHandler: [guard] }, async (request) => {
    const { content_type_id, entity_id, media_type, is_featured } = request.query;

    const service = new MediaService(request.server.db);
    const items = await service.listMedia({
      contentTypeId: content_type_id ?? null,
      entityId: entity_id ?? null,
      mediaType: media_type ?? null,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined
    });

    return { media: items, total: items.length };
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/media/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/media/:id', { preHandler: [guard] }, async (request) => {
    const service = new MediaService(request.server.db);
    return service.getMedia(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/media/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateMediaBody }>(
    '/api/v1/admin/media/:id',
    { preHandler: [guard] },
    async (request) => {
      const service = new MediaService(request.server.db);
      const context = await getActorContext(request);

      return service.updateMedia(
        {
          id: request.params.id,
          altText: request.body.alt_text,
          caption: request.body.caption,
          thumbnailUrl: request.body.thumbnail_url,
          displayOrder: request.body.display_order,
          isFeatured: request.body.is_featured
        } satisfies UpdateMediaInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/media/:id
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/media/:id', { preHandler: [guard] }, async (request) => {
    const service = new MediaService(request.server.db);
    const context = await getActorContext(request);
    await service.archiveMedia(request.params.id, context);
    return { success: true };
  });
}
