import type { FastifyInstance } from 'fastify';
import { StoryService } from '../stories/story-service.js';
import type { PublicStoryListFilter } from '../stories/story-service.js';

interface ListPublicStoriesQuery {
  organization_id?: string;
  category_id?: string;
  tag_id?: string;
  story_type?: string;
  person_role?: string;
  is_featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function publicStoriesRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /api/v1/public/stories
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListPublicStoriesQuery }>('/api/v1/public/stories', async (request) => {
    const {
      organization_id,
      category_id,
      tag_id,
      story_type,
      person_role,
      is_featured,
      search,
      limit,
      offset
    } = request.query;

    const service = new StoryService(request.server.db);

    return service.listPublishedStories({
      organizationId: organization_id ?? undefined,
      categoryId: category_id ?? undefined,
      tagId: tag_id ?? undefined,
      storyType: story_type ?? undefined,
      personRole: person_role ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies PublicStoryListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/public/stories/:slug
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>('/api/v1/public/stories/:slug', async (request) => {
    const service = new StoryService(request.server.db);
    const story = await service.getPublishedStoryBySlug(request.params.slug);

    // Fire-and-forget view tracking
    service.trackView(story.entity_id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    }).catch((err) => { console.error('TRACK VIEW ERROR STORIES:', err); });

    return story;
  });
}
