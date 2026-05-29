import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission, requireStatusPermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { BlogService, type CreateBlogInput, type UpdateBlogInput } from '../blogs/blog-service.js';
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

interface CreateBlogBody {
  title: string;
  slug: string;
  summary?: string | null;
  body_html?: string | null;
  hero_image_url?: string | null;
  author_id?: string | null;
  is_featured?: boolean;
  is_pinned?: boolean;
  organization_ids?: string[];
}

interface UpdateBlogBody {
  title?: string;
  slug?: string;
  summary?: string | null;
  body_html?: string | null;
  hero_image_url?: string | null;
  author_id?: string | null;
  is_featured?: boolean;
  is_pinned?: boolean;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface ListBlogsQuery {
  status?: string;
  is_featured?: string;
  is_pinned?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function adminBlogsRoutes(app: FastifyInstance): Promise<void> {
  const readGuard = requirePermission('UPDATE_BLOG');
  const writeGuard = requirePermission('UPDATE_BLOG');
  const createGuard = requirePermission('CREATE_BLOG');
  const deleteGuard = requirePermission('DELETE_BLOG');
  const publishGuard = requirePermission('PUBLISH_BLOG');
  const statusGuard = requireStatusPermission('UPDATE_BLOG', 'PUBLISH_BLOG');

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/blogs
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreateBlogBody }>('/api/v1/admin/blogs', { preHandler: [createGuard] }, async (request) => {
    const body = request.body;

    if (!body.title || !body.slug) {
      throw badRequest('title and slug are required');
    }

    const service = new BlogService(request.server.db);
    const context = await getActorContext(request);

    return service.createBlog(
      {
        title: body.title,
        slug: body.slug,
        summary: body.summary ?? null,
        bodyHtml: body.body_html ? sanitizeInputHtml(body.body_html) : null,
        heroImageUrl: body.hero_image_url ?? null,
        authorId: body.author_id ?? null,
        isFeatured: body.is_featured ?? false,
        isPinned: body.is_pinned ?? false,
        organizationIds: body.organization_ids ?? []
      } satisfies CreateBlogInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/blogs
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListBlogsQuery }>('/api/v1/admin/blogs', { preHandler: [readGuard] }, async (request) => {
    const { status, is_featured, is_pinned, search, limit, offset } = request.query;
    const service = new BlogService(request.server.db);

    return service.listBlogs({
      status: status ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      isPinned: is_pinned !== undefined ? is_pinned === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/blogs/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/blogs/:id', { preHandler: [readGuard] }, async (request) => {
    const service = new BlogService(request.server.db);
    return service.getBlogById(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/blogs/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateBlogBody }>(
    '/api/v1/admin/blogs/:id',
    { preHandler: [writeGuard] },
    async (request) => {
      const service = new BlogService(request.server.db);
      const context = await getActorContext(request);

      return service.updateBlog(
        {
          id: request.params.id,
          title: request.body.title,
          slug: request.body.slug,
          summary: request.body.summary,
          bodyHtml: request.body.body_html !== undefined ? (request.body.body_html ? sanitizeInputHtml(request.body.body_html) : null) : undefined,
          heroImageUrl: request.body.hero_image_url,
          authorId: request.body.author_id,
          isFeatured: request.body.is_featured,
          isPinned: request.body.is_pinned
        } satisfies UpdateBlogInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/blogs/:id/status
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: StatusBody }>(
    '/api/v1/admin/blogs/:id/status',
    { preHandler: [statusGuard] },
    async (request) => {
      const { status, remarks } = request.body;
      if (!status) {
        throw badRequest('status is required');
      }

      const service = new BlogService(request.server.db);
      const context = await getActorContext(request);

      return service.transitionStatus(request.params.id, status, remarks ? sanitizeInputHtml(remarks) : undefined, context);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/blogs/:id (soft-archive)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/blogs/:id', { preHandler: [deleteGuard] }, async (request) => {
    const service = new BlogService(request.server.db);
    const context = await getActorContext(request);
    await service.archiveBlog(request.params.id, context);
    return { success: true };
  });
}
