import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
import { EventService, type CreateEventInput, type UpdateEventInput } from '../events/event-service.js';
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

interface CreateEventBody {
  title: string;
  slug: string;
  event_type: string;
  event_mode: string;
  venue?: string | null;
  organizer?: string | null;
  registration_link?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  start_at: string;
  end_at: string;
  timezone?: string;
  registration_deadline_at?: string | null;
  max_participants?: number | null;
  is_featured?: boolean;
  organization_ids?: string[];
}

interface UpdateEventBody {
  title?: string;
  slug?: string;
  event_type?: string;
  event_mode?: string;
  venue?: string | null;
  organizer?: string | null;
  registration_link?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  start_at?: string;
  end_at?: string;
  timezone?: string;
  registration_deadline_at?: string | null;
  max_participants?: number | null;
  is_featured?: boolean;
}

interface StatusBody {
  status: ContentStatus;
  remarks?: string;
}

interface ListEventsQuery {
  status?: string;
  event_type?: string;
  event_mode?: string;
  is_featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export async function adminEventsRoutes(app: FastifyInstance): Promise<void> {
  const readGuard = requirePermission('UPDATE_EVENT');
  const writeGuard = requirePermission('UPDATE_EVENT');
  const createGuard = requirePermission('CREATE_EVENT');
  const deleteGuard = requirePermission('DELETE_EVENT');
  const publishGuard = requirePermission('PUBLISH_EVENT');

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/events
  // ---------------------------------------------------------------------------
  app.post<{ Body: CreateEventBody }>('/api/v1/admin/events', { preHandler: [createGuard] }, async (request) => {
    const body = request.body;

    if (!body.title || !body.slug) {
      throw badRequest('title and slug are required');
    }

    const service = new EventService(request.server.db);
    const context = await getActorContext(request);

    return service.createEvent(
      {
        title: body.title,
        slug: body.slug,
        eventType: body.event_type,
        eventMode: body.event_mode,
        venue: body.venue ?? null,
        organizer: body.organizer ?? null,
        registrationLink: body.registration_link ?? null,
        contactEmail: body.contact_email ?? null,
        contactPhone: body.contact_phone ?? null,
        startAt: body.start_at,
        endAt: body.end_at,
        timezone: body.timezone ?? 'UTC',
        registrationDeadlineAt: body.registration_deadline_at ?? null,
        maxParticipants: body.max_participants ?? null,
        isFeatured: body.is_featured ?? false,
        organizationIds: body.organization_ids ?? []
      } satisfies CreateEventInput,
      context
    );
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/events
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListEventsQuery }>('/api/v1/admin/events', { preHandler: [readGuard] }, async (request) => {
    const { status, event_type, event_mode, is_featured, search, limit, offset } = request.query;
    const service = new EventService(request.server.db);

    return service.listEvents({
      status: status ?? undefined,
      eventType: event_type ?? undefined,
      eventMode: event_mode ?? undefined,
      isFeatured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search: search ?? undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/events/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/admin/events/:id', { preHandler: [readGuard] }, async (request) => {
    const service = new EventService(request.server.db);
    return service.getEventById(request.params.id);
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/admin/events/:id
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string }; Body: UpdateEventBody }>(
    '/api/v1/admin/events/:id',
    { preHandler: [writeGuard] },
    async (request) => {
      const service = new EventService(request.server.db);
      const context = await getActorContext(request);

      return service.updateEvent(
        {
          id: request.params.id,
          title: request.body.title,
          slug: request.body.slug,
          eventType: request.body.event_type,
          eventMode: request.body.event_mode,
          venue: request.body.venue,
          organizer: request.body.organizer,
          registrationLink: request.body.registration_link,
          contactEmail: request.body.contact_email,
          contactPhone: request.body.contact_phone,
          startAt: request.body.start_at,
          endAt: request.body.end_at,
          timezone: request.body.timezone,
          registrationDeadlineAt: request.body.registration_deadline_at,
          maxParticipants: request.body.max_participants,
          isFeatured: request.body.is_featured
        } satisfies UpdateEventInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/events/:id/status
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: StatusBody }>(
    '/api/v1/admin/events/:id/status',
    { preHandler: [publishGuard] },
    async (request) => {
      const { status, remarks } = request.body;
      if (!status) {
        throw badRequest('status is required');
      }

      const service = new EventService(request.server.db);
      const context = await getActorContext(request);

      return service.transitionStatus(request.params.id, status, remarks ? sanitizeInputHtml(remarks) : undefined, context);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/events/:id (soft-archive)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>('/api/v1/admin/events/:id', { preHandler: [deleteGuard] }, async (request) => {
    const service = new EventService(request.server.db);
    const context = await getActorContext(request);
    await service.archiveEvent(request.params.id, context);
    return { success: true };
  });
}
