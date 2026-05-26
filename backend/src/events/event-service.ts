import type { Knex } from 'knex';
import { badRequest, notFound } from '../http/api-error.js';
import { ContentService, type ContentStatus } from '../content/content-service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateEventInput {
  title: string;
  slug: string;
  eventType: string;
  eventMode: string;
  venue?: string | null;
  organizer?: string | null;
  registrationLink?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  startAt: string | Date;
  endAt: string | Date;
  timezone?: string;
  registrationDeadlineAt?: string | Date | null;
  maxParticipants?: number | null;
  isFeatured?: boolean;
  organizationIds?: string[];
}

export interface UpdateEventInput {
  id: string;
  title?: string;
  slug?: string;
  eventType?: string;
  eventMode?: string;
  venue?: string | null;
  organizer?: string | null;
  registrationLink?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  startAt?: string | Date;
  endAt?: string | Date;
  timezone?: string;
  registrationDeadlineAt?: string | Date | null;
  maxParticipants?: number | null;
  isFeatured?: boolean;
}

export interface EventRow {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: string;
  event_type: string;
  event_mode: string;
  venue: string | null;
  organizer: string | null;
  registration_link: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  start_at: Date;
  end_at: Date;
  timezone: string;
  registration_deadline_at: Date | null;
  max_participants: number | null;
  is_featured: boolean;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface EventListFilter {
  status?: string;
  eventType?: string;
  eventMode?: string;
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublicEventListFilter {
  organizationId?: string;
  categoryId?: string;
  tagId?: string;
  eventType?: string;
  eventMode?: string;
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateEventDates(start: string | Date, end: string | Date, deadline?: string | Date | null) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate >= endDate) {
    throw badRequest('start_at must be strictly before end_at');
  }

  if (deadline) {
    const deadlineDate = new Date(deadline);
    if (deadlineDate >= startDate) {
      throw badRequest('registration_deadline_at must be before start_at');
    }
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EventService {
  private readonly contentService: ContentService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  public async createEvent(input: CreateEventInput, context: RequestAuditContext): Promise<EventRow> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('title and slug are required');
    }
    if (!input.eventType?.trim()) {
      throw badRequest('eventType is required');
    }
    if (!input.eventMode || !['online', 'offline', 'hybrid'].includes(input.eventMode)) {
      throw badRequest("eventMode must be 'online', 'offline', or 'hybrid'");
    }
    if (!input.startAt || !input.endAt) {
      throw badRequest('startAt and endAt are required');
    }

    validateEventDates(input.startAt, input.endAt, input.registrationDeadlineAt);

    return this.db.transaction(async (trx) => {
      // Create the shared entity record first
      const entity = await this.contentService.createEntity(
        {
          contentTypeSlug: 'event',
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          payload: {},
          organizationIds: input.organizationIds ?? []
        },
        context
      );

      const entityId = String(entity.id);

      // Insert event-specific record
      const [event] = await trx('events')
        .insert({
          entity_id: entityId,
          event_type: input.eventType.trim(),
          event_mode: input.eventMode,
          venue: input.venue ?? null,
          organizer: input.organizer ?? null,
          registration_link: input.registrationLink ?? null,
          contact_email: input.contactEmail ?? null,
          contact_phone: input.contactPhone ?? null,
          start_at: new Date(input.startAt),
          end_at: new Date(input.endAt),
          timezone: input.timezone ?? 'UTC',
          registration_deadline_at: input.registrationDeadlineAt ? new Date(input.registrationDeadlineAt) : null,
          max_participants: input.maxParticipants ?? null,
          is_featured: input.isFeatured ?? false,
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*')
        .transacting(trx);

      return this.mergeEntityAndEvent(entity, event);
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  public async updateEvent(input: UpdateEventInput, context: RequestAuditContext): Promise<EventRow> {
    const existing = await this.getEventRow(input.id);

    // Validate dates if changing either
    const newStart = input.startAt !== undefined ? input.startAt : existing.start_at;
    const newEnd = input.endAt !== undefined ? input.endAt : existing.end_at;
    const newDeadline = input.registrationDeadlineAt !== undefined ? input.registrationDeadlineAt : existing.registration_deadline_at;

    if (input.startAt !== undefined || input.endAt !== undefined || input.registrationDeadlineAt !== undefined) {
      validateEventDates(newStart, newEnd, newDeadline);
    }

    if (input.eventMode && !['online', 'offline', 'hybrid'].includes(input.eventMode)) {
      throw badRequest("eventMode must be 'online', 'offline', or 'hybrid'");
    }

    return this.db.transaction(async (trx) => {
      // Update shared entity fields if provided
      if (input.title !== undefined || input.slug !== undefined) {
        await this.contentService.updateEntity(
          {
            contentTypeSlug: 'event',
            entityId: existing.entity_id,
            title: input.title,
            slug: input.slug !== undefined
              ? input.slug.trim().toLowerCase().replace(/\s+/g, '-')
              : undefined
          },
          context
        );
      }

      // Update event-specific fields
      const eventUpdate: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.eventType !== undefined) eventUpdate.event_type = input.eventType.trim();
      if (input.eventMode !== undefined) eventUpdate.event_mode = input.eventMode;
      if (input.venue !== undefined) eventUpdate.venue = input.venue;
      if (input.organizer !== undefined) eventUpdate.organizer = input.organizer;
      if (input.registrationLink !== undefined) eventUpdate.registration_link = input.registrationLink;
      if (input.contactEmail !== undefined) eventUpdate.contact_email = input.contactEmail;
      if (input.contactPhone !== undefined) eventUpdate.contact_phone = input.contactPhone;
      if (input.startAt !== undefined) eventUpdate.start_at = new Date(input.startAt);
      if (input.endAt !== undefined) eventUpdate.end_at = new Date(input.endAt);
      if (input.timezone !== undefined) eventUpdate.timezone = input.timezone;
      if (input.registrationDeadlineAt !== undefined) {
        eventUpdate.registration_deadline_at = input.registrationDeadlineAt ? new Date(input.registrationDeadlineAt) : null;
      }
      if (input.maxParticipants !== undefined) eventUpdate.max_participants = input.maxParticipants;
      if (input.isFeatured !== undefined) eventUpdate.is_featured = input.isFeatured;

      const [updatedEvent] = await trx('events')
        .where({ id: input.id })
        .whereNull('deleted_at')
        .update(eventUpdate)
        .returning('*');

      // Re-fetch latest entity after update
      const entity = await trx('content_entities')
        .where({ id: existing.entity_id })
        .whereNull('deleted_at')
        .first();

      return this.mergeEntityAndEvent(entity, updatedEvent);
    });
  }

  // -------------------------------------------------------------------------
  // Archive (soft-delete)
  // -------------------------------------------------------------------------
  public async archiveEvent(id: string, context: RequestAuditContext): Promise<void> {
    const event = await this.getEventRow(id);

    await this.db.transaction(async (trx) => {
      // Transition entity status to archived
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: 'event',
          entityId: event.entity_id,
          status: 'archived',
          remarks: 'Event archived by admin'
        },
        context
      );

      // Soft-delete event extension row
      await trx('events')
        .where({ id })
        .update({
          archived_at: trx.fn.now(),
          deleted_at: trx.fn.now(),
          updated_at: trx.fn.now(),
          updated_by: context.actorId
        });
    });
  }

  // -------------------------------------------------------------------------
  // Workflow status transition
  // -------------------------------------------------------------------------
  public async transitionStatus(
    eventId: string,
    status: ContentStatus,
    remarks: string | undefined,
    context: RequestAuditContext
  ): Promise<EventRow> {
    const event = await this.getEventRow(eventId);

    const entity = await this.contentService.transitionStatus(
      {
        contentTypeSlug: 'event',
        entityId: event.entity_id,
        status,
        remarks
      },
      context
    );

    // Stamp timestamps on the events row too
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    };

    if (status === 'published') update.published_at = this.db.fn.now();
    if (status === 'archived') {
      update.archived_at = this.db.fn.now();
      update.deleted_at = this.db.fn.now();
    }

    const [updatedEvent] = await this.db('events')
      .where({ id: eventId })
      .update(update)
      .returning('*');

    return this.mergeEntityAndEvent(entity, updatedEvent);
  }

  // -------------------------------------------------------------------------
  // List (admin — all statuses)
  // -------------------------------------------------------------------------
  public async listEvents(filter: EventListFilter): Promise<{ events: EventRow[]; total: number }> {
    const query = this.db('events as e')
      .join('content_entities as ce', 'ce.id', 'e.entity_id')
      .whereNull('e.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'event' }).first())
      .select(
        'e.id',
        'e.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'e.event_type',
        'e.event_mode',
        'e.venue',
        'e.organizer',
        'e.registration_link',
        'e.contact_email',
        'e.contact_phone',
        'e.start_at',
        'e.end_at',
        'e.timezone',
        'e.registration_deadline_at',
        'e.max_participants',
        'e.is_featured',
        'e.published_at',
        'e.archived_at',
        'e.created_at',
        'e.updated_at',
        'e.created_by',
        'e.updated_by'
      );

    if (filter.status) {
      query.where('ce.status', filter.status);
    }

    if (filter.eventType) {
      query.where('e.event_type', filter.eventType);
    }

    if (filter.eventMode) {
      query.where('e.event_mode', filter.eventMode);
    }

    if (filter.isFeatured !== undefined) {
      query.where('e.is_featured', filter.isFeatured);
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('e.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('e.start_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      events: rows as EventRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Get single event by events.id (admin)
  // -------------------------------------------------------------------------
  public async getEventById(id: string): Promise<EventRow> {
    return this.getEventRow(id);
  }

  // -------------------------------------------------------------------------
  // Get published event by slug (public)
  // -------------------------------------------------------------------------
  public async getPublishedEventBySlug(slug: string): Promise<EventRow> {
    const row = await this.db('events as e')
      .join('content_entities as ce', 'ce.id', 'e.entity_id')
      .whereNull('e.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.slug', slug)
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'event' }).first())
      .select(
        'e.id',
        'e.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'e.event_type',
        'e.event_mode',
        'e.venue',
        'e.organizer',
        'e.registration_link',
        'e.contact_email',
        'e.contact_phone',
        'e.start_at',
        'e.end_at',
        'e.timezone',
        'e.registration_deadline_at',
        'e.max_participants',
        'e.is_featured',
        'e.published_at',
        'e.archived_at',
        'e.created_at',
        'e.updated_at',
        'e.created_by',
        'e.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Event not found or not published');
    }

    return row as EventRow;
  }

  // -------------------------------------------------------------------------
  // List published events (public)
  // -------------------------------------------------------------------------
  public async listPublishedEvents(filter: PublicEventListFilter): Promise<{ events: EventRow[]; total: number }> {
    const query = this.db('events as e')
      .join('content_entities as ce', 'ce.id', 'e.entity_id')
      .whereNull('e.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'event' }).first())
      .select(
        'e.id',
        'e.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'e.event_type',
        'e.event_mode',
        'e.venue',
        'e.organizer',
        'e.registration_link',
        'e.start_at',
        'e.end_at',
        'e.timezone',
        'e.is_featured',
        'e.published_at',
        'e.created_at'
      );

    if (filter.eventType) {
      query.where('e.event_type', filter.eventType);
    }

    if (filter.eventMode) {
      query.where('e.event_mode', filter.eventMode);
    }

    if (filter.isFeatured !== undefined) {
      query.where('e.is_featured', filter.isFeatured);
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term);
      });
    }

    if (filter.organizationId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_organizations as eo')
          .whereRaw('eo.entity_id = e.entity_id')
          .where('eo.organization_id', filter.organizationId)
          .whereNull('eo.deleted_at');
      });
    }

    if (filter.categoryId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_categories as ec')
          .whereRaw('ec.entity_id = e.entity_id')
          .where('ec.category_id', filter.categoryId)
          .whereNull('ec.deleted_at');
      });
    }

    if (filter.tagId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_tags as et')
          .whereRaw('et.entity_id = e.entity_id')
          .where('et.tag_id', filter.tagId)
          .whereNull('et.deleted_at');
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('e.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('e.start_at', 'asc') // future events first chronologically
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      events: rows as EventRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Track an event view
  // -------------------------------------------------------------------------
  public async trackView(
    entityId: string,
    context: Omit<RequestAuditContext, 'actorId'> & { viewerUserId?: string }
  ): Promise<void> {
    const contentType = await this.db('content_types').select('id').where({ slug: 'event' }).first();
    if (!contentType) return;

    await this.db('entity_views').insert({
      content_type_id: contentType.id,
      entity_id: entityId,
      viewer_ip: context.ipAddress ?? null,
      viewer_agent: context.userAgent ?? null,
      viewer_user_id: context.viewerUserId ?? null
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------
  private async getEventRow(id: string): Promise<EventRow> {
    const row = await this.db('events as e')
      .join('content_entities as ce', 'ce.id', 'e.entity_id')
      .where('e.id', id)
      .whereNull('e.deleted_at')
      .whereNull('ce.deleted_at')
      .select(
        'e.id',
        'e.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'e.event_type',
        'e.event_mode',
        'e.venue',
        'e.organizer',
        'e.registration_link',
        'e.contact_email',
        'e.contact_phone',
        'e.start_at',
        'e.end_at',
        'e.timezone',
        'e.registration_deadline_at',
        'e.max_participants',
        'e.is_featured',
        'e.published_at',
        'e.archived_at',
        'e.created_at',
        'e.updated_at',
        'e.created_by',
        'e.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Event not found');
    }

    return row as EventRow;
  }

  private mergeEntityAndEvent(entity: Record<string, unknown>, event: Record<string, unknown>): EventRow {
    return {
      id: String(event.id),
      entity_id: String(entity.id),
      title: String(entity.title),
      slug: String(entity.slug),
      status: String(entity.status),
      event_type: String(event.event_type),
      event_mode: String(event.event_mode),
      venue: (event.venue as string | null) ?? null,
      organizer: (event.organizer as string | null) ?? null,
      registration_link: (event.registration_link as string | null) ?? null,
      contact_email: (event.contact_email as string | null) ?? null,
      contact_phone: (event.contact_phone as string | null) ?? null,
      start_at: event.start_at as Date,
      end_at: event.end_at as Date,
      timezone: String(event.timezone ?? 'UTC'),
      registration_deadline_at: (event.registration_deadline_at as Date | null) ?? null,
      max_participants: event.max_participants !== null ? Number(event.max_participants) : null,
      is_featured: Boolean(event.is_featured),
      published_at: (event.published_at as Date | null) ?? null,
      archived_at: (event.archived_at as Date | null) ?? null,
      created_at: event.created_at as Date,
      updated_at: event.updated_at as Date,
      created_by: (event.created_by as string | null) ?? null,
      updated_by: (event.updated_by as string | null) ?? null
    };
  }
}
