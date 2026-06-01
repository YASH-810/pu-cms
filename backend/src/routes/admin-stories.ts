import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission, requireStatusPermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { StoryService } from '../stories/story-service.js';
import type { CreateStoryInput, UpdateStoryInput, StoryListFilter } from '../stories/story-service.js';
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

interface CreateStoryBody {
  title: string;
  slug: string;
  story_type: string;
  person_name: string;
  person_role: string;
  company?: string | null;
  graduation_year?: number | null;
  linkedin_url?: string | null;
  is_featured?: boolean;
  organization_ids?: string[];
}

interface UpdateStoryBody {
  title?: string;
  slug?: string;
  story_type?: string;
  person_name?: string;
  person_role?: string;
  company?: string | null;
  graduation_year?: number | null;
  linkedin_url?: string | null;
  is_featured?: boolean;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface ListStoriesQuery {
  status?: string;
  story_type?: string;
  person_role?: string;
  is_featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function adminStoriesRoutes(app: FastifyInstance): Promise<void> {
  const readGuard = requirePermission('UPDATE_STORY');
  const writeGuard = requirePermission('UPDATE_STORY');
  const createGuard = requirePermission('CREATE_STORY');
  const deleteGuard = requirePermission('DELETE_STORY');
  const publishGuard = requirePermission('APPROVE_STORY');
  const statusGuard = requireStatusPermission('UPDATE_STORY', 'APPROVE_STORY');

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/stories
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreateStoryBody }>('/api/v1/admin/stories', { preHandler: [createGuard] }, async (request) => {
    const body = request.body;

    if (!body.title || !body.slug) {
      throw badRequest('title and slug are required');
    }
    if (!body.story_type || !body.person_name || !body.person_role) {
      throw badRequest('story_type, person_name, and person_role are required');
    }

    const service = new StoryService(request.server.db);
    const context = await getActorContext(request);

    return service.createStory(
      {
        title: body.title,
        slug: body.slug,
        storyType: body.story_type,
        personName: body.person_name,
        personRole: body.person_role,
        company: body.company ?? null,
        graduationYear: body.graduation_year ?? null,
        linkedinUrl: body.linkedin_url ?? null,
        isFeatured: body.is_featured ?? false,
        organizationIds: body.organization_ids ?? []
      } satisfies CreateStoryInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/stories
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListStoriesQuery }>('/api/v1/admin/stories', { preHandler: [readGuard] }, async (request) => {
    const { status, story_type, person_role, is_featured, search, limit, offset } = request.query;
    const service = new StoryService(request.server.db);

    return service.listStories({
      status: status ?? undefined,
      storyType: story_type ?? undefined,
      personRole: person_role ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    } satisfies StoryListFilter);
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/stories/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/stories/:id', { preHandler: [readGuard] }, async (request) => {
    const service = new StoryService(request.server.db);
    return service.getStoryById(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/stories/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateStoryBody }>(
    '/api/v1/admin/stories/:id',
    { preHandler: [writeGuard] },
    async (request) => {
      const service = new StoryService(request.server.db);
      const context = await getActorContext(request);

      return service.updateStory(
        {
          id: request.params.id,
          title: request.body.title,
          slug: request.body.slug,
          storyType: request.body.story_type,
          personName: request.body.person_name,
          personRole: request.body.person_role,
          company: request.body.company,
          graduationYear: request.body.graduation_year,
          linkedinUrl: request.body.linkedin_url,
          isFeatured: request.body.is_featured
        } satisfies UpdateStoryInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/stories/:id/status
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: StatusBody }>(
    '/api/v1/admin/stories/:id/status',
    { preHandler: [statusGuard] },
    async (request) => {
      const { status, remarks } = request.body;
      if (!status) {
        throw badRequest('status is required');
      }

      const service = new StoryService(request.server.db);
      const context = await getActorContext(request);

      return service.transitionStatus(request.params.id, status, remarks ? sanitizeInputHtml(remarks) : undefined, context);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/stories/:id (soft-archive)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/stories/:id', { preHandler: [deleteGuard] }, async (request) => {
    const service = new StoryService(request.server.db);
    const context = await getActorContext(request);
    await service.archiveStory(request.params.id, context);
    return { success: true };
  });
}
