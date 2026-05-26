import type { FastifyInstance } from 'fastify';
import { SearchService } from '../search/search-service.js';

interface SearchQuery {
  q?: string;
  content_type?: string;
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  limit?: string;
  offset?: string;
  sort?: 'relevance' | 'date';
}

export async function publicSearchRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/search
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: SearchQuery }>('/api/v1/public/search', async (request) => {
    const { q, content_type, organization_id, category_id, tag_id, limit, offset, sort } = request.query;

    const service = new SearchService(request.server.db);

    // Optional user ID context if logged in
    let userId: string | undefined;
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      userId = payload.sub;
    } catch {
      // Ignored for public queries
    }

    return service.search(
      {
        query: q || '',
        contentTypeSlug: content_type || undefined,
        organizationId: organization_id || undefined,
        categoryId: category_id || undefined,
        tagId: tag_id || undefined,
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
        sortBy: sort || 'relevance'
      },
      userId
    );
  });
}
