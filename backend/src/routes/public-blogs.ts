import type { FastifyInstance } from 'fastify';
import { BlogService } from '../blogs/blog-service.js';

interface ListPublicBlogsQuery {
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  is_featured?: string;
  is_pinned?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function publicBlogsRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/blogs
  // Returns published blogs only. No auth required.
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPublicBlogsQuery }>('/api/v1/public/blogs', async (request) => {
    const { organization_id, category_id, tag_id, is_featured, is_pinned, search, limit, offset } = request.query;
    const service = new BlogService(request.server.db);

    return service.listPublishedBlogs({
      organizationId: organization_id ?? undefined,
      categoryId: category_id ?? undefined,
      tagId: tag_id ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      isPinned: is_pinned !== undefined ? is_pinned === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/blogs/:slug
  // Returns a single published blog by slug and records a view impression.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>('/api/v1/public/blogs/:slug', async (request) => {
    const service = new BlogService(request.server.db);
    const blog = await service.getPublishedBlogBySlug(request.params.slug);

    // Fire-and-forget view tracking — do not block the response
    service.trackView(blog.entity_id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    }).catch(() => { /* non-critical */ });

    return blog;
  });
}
