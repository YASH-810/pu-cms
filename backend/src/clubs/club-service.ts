import type { Knex } from 'knex';
import { badRequest, notFound } from '../http/api-error.js';
import { ContentService, type ContentStatus } from '../content/content-service.js';

export interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateClubInput {
  title: string;
  slug: string;
  organizationId: string;
  leadership?: Record<string, unknown> | null;
  socialLinks?: Record<string, unknown> | null;
  meetingSchedule?: string | null;
  joiningProcess?: string | null;
}

export interface UpdateClubInput {
  id: string;
  title?: string;
  slug?: string;
  organizationId?: string;
  leadership?: Record<string, unknown> | null;
  socialLinks?: Record<string, unknown> | null;
  meetingSchedule?: string | null;
  joiningProcess?: string | null;
}

export interface ClubRow {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: string;
  organization_id: string;
  organization_name?: string;
  organization_slug?: string;
  leadership: Record<string, unknown> | null;
  social_links: Record<string, unknown> | null;
  meeting_schedule: string | null;
  joining_process: string | null;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface ClubListFilter {
  status?: string;
  organizationId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublicClubListFilter {
  organizationId?: string;
  categoryId?: string;
  tagId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class ClubService {
  private readonly contentService: ContentService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  public async createClub(input: CreateClubInput, context: RequestAuditContext): Promise<ClubRow> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('title and slug are required');
    }
    if (!input.organizationId) {
      throw badRequest('organizationId is required');
    }

    return this.db.transaction(async (trx) => {
      // Validate organization exists
      const org = await trx('organizations').where({ id: input.organizationId, is_active: true }).first();
      if (!org) {
        throw badRequest('Invalid or inactive organizationId');
      }

      // Create base entity record
      const entity = await this.contentService.createEntity(
        {
          contentTypeSlug: 'club',
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          payload: {},
          organizationIds: [input.organizationId]
        },
        context
      );

      const entityId = String(entity.id);

      // Insert club-specific record
      const [club] = await trx('club_details')
        .insert({
          entity_id: entityId,
          organization_id: input.organizationId,
          leadership: input.leadership ? JSON.stringify(input.leadership) : null,
          social_links: input.socialLinks ? JSON.stringify(input.socialLinks) : null,
          meeting_schedule: input.meetingSchedule ?? null,
          joining_process: input.joiningProcess ?? null,
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*')
        .transacting(trx);

      return this.mergeEntityAndClub(entity, club, trx);
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  public async updateClub(input: UpdateClubInput, context: RequestAuditContext): Promise<ClubRow> {
    const existing = await this.getClubRow(input.id);

    return this.db.transaction(async (trx) => {
      if (input.organizationId) {
        const org = await trx('organizations').where({ id: input.organizationId, is_active: true }).first();
        if (!org) {
          throw badRequest('Invalid or inactive organizationId');
        }
      }

      // Update shared entity fields if provided
      if (input.title !== undefined || input.slug !== undefined) {
        await this.contentService.updateEntity(
          {
            contentTypeSlug: 'club',
            entityId: existing.entity_id,
            title: input.title,
            slug: input.slug !== undefined
              ? input.slug.trim().toLowerCase().replace(/\s+/g, '-')
              : undefined
          },
          context
        );
      }

      // Update club-specific fields
      const updateData: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.organizationId !== undefined) updateData.organization_id = input.organizationId;
      if (input.leadership !== undefined) updateData.leadership = input.leadership ? JSON.stringify(input.leadership) : null;
      if (input.socialLinks !== undefined) updateData.social_links = input.socialLinks ? JSON.stringify(input.socialLinks) : null;
      if (input.meetingSchedule !== undefined) updateData.meeting_schedule = input.meetingSchedule;
      if (input.joiningProcess !== undefined) updateData.joining_process = input.joiningProcess;

      const [updatedClub] = await trx('club_details')
        .where({ id: input.id })
        .whereNull('deleted_at')
        .update(updateData)
        .returning('*');

      // Re-fetch latest entity after update
      const entity = await trx('content_entities')
        .where({ id: existing.entity_id })
        .whereNull('deleted_at')
        .first();

      return this.mergeEntityAndClub(entity, updatedClub, trx);
    });
  }

  // -------------------------------------------------------------------------
  // Archive (soft-delete)
  // -------------------------------------------------------------------------
  public async archiveClub(id: string, context: RequestAuditContext): Promise<void> {
    const existing = await this.getClubRow(id);

    await this.db.transaction(async (trx) => {
      // Transition status to archived
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: 'club',
          entityId: existing.entity_id,
          status: 'archived',
          remarks: 'Club archived by admin'
        },
        context
      );

      // Soft-delete club row
      await trx('club_details')
        .where({ id })
        .update({
          archived_at: trx.fn.now(),
          updated_at: trx.fn.now(),
          updated_by: context.actorId
        });
    });
  }

  // -------------------------------------------------------------------------
  // Workflow status transition
  // -------------------------------------------------------------------------
  public async transitionStatus(
    id: string,
    status: ContentStatus,
    remarks: string | undefined,
    context: RequestAuditContext
  ): Promise<ClubRow> {
    const existing = await this.getClubRow(id);

    const entity = await this.contentService.transitionStatus(
      {
        contentTypeSlug: 'club',
        entityId: existing.entity_id,
        status,
        remarks
      },
      context
    );

    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    };

    if (status === 'published') update.published_at = this.db.fn.now();
    if (status === 'archived') {
      update.archived_at = this.db.fn.now();
    }

    const [updatedClub] = await this.db('club_details')
      .where({ id })
      .update(update)
      .returning('*');

    return this.mergeEntityAndClub(entity, updatedClub, this.db);
  }

  // -------------------------------------------------------------------------
  // List (admin)
  // -------------------------------------------------------------------------
  public async listClubs(filter: ClubListFilter): Promise<{ clubs: ClubRow[]; total: number }> {
    const query = this.db('club_details as cd')
      .join('content_entities as ce', 'ce.id', 'cd.entity_id')
      .join('organizations as org', 'org.id', 'cd.organization_id')
      .whereNull('cd.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'club' }).first())
      .select(
        'cd.id',
        'cd.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'cd.organization_id',
        'org.name as organization_name',
        'org.slug as organization_slug',
        'cd.leadership',
        'cd.social_links',
        'cd.meeting_schedule',
        'cd.joining_process',
        'cd.published_at',
        'cd.archived_at',
        'cd.created_at',
        'cd.updated_at',
        'cd.created_by',
        'cd.updated_by'
      );

    if (filter.status) {
      query.where('ce.status', filter.status);
    }
    if (filter.organizationId) {
      query.where('cd.organization_id', filter.organizationId);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term).orWhereILike('org.name', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('cd.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('cd.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      clubs: rows as ClubRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Get single (admin)
  // -------------------------------------------------------------------------
  public async getClubById(id: string): Promise<ClubRow> {
    return this.getClubRow(id);
  }

  // -------------------------------------------------------------------------
  // Get single (public)
  // -------------------------------------------------------------------------
  public async getPublishedClubBySlug(slug: string): Promise<ClubRow> {
    const row = await this.db('club_details as cd')
      .join('content_entities as ce', 'ce.id', 'cd.entity_id')
      .join('organizations as org', 'org.id', 'cd.organization_id')
      .whereNull('cd.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.slug', slug)
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'club' }).first())
      .select(
        'cd.id',
        'cd.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'cd.organization_id',
        'org.name as organization_name',
        'org.slug as organization_slug',
        'cd.leadership',
        'cd.social_links',
        'cd.meeting_schedule',
        'cd.joining_process',
        'cd.published_at',
        'cd.archived_at',
        'cd.created_at',
        'cd.updated_at',
        'cd.created_by',
        'cd.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Club not found');
    }

    return row as ClubRow;
  }

  // -------------------------------------------------------------------------
  // List published (public)
  // -------------------------------------------------------------------------
  public async listPublishedClubs(filter: PublicClubListFilter): Promise<{ clubs: ClubRow[]; total: number }> {
    const query = this.db('club_details as cd')
      .join('content_entities as ce', 'ce.id', 'cd.entity_id')
      .join('organizations as org', 'org.id', 'cd.organization_id')
      .whereNull('cd.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'club' }).first())
      .select(
        'cd.id',
        'cd.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'cd.organization_id',
        'org.name as organization_name',
        'org.slug as organization_slug',
        'cd.leadership',
        'cd.social_links',
        'cd.meeting_schedule',
        'cd.joining_process',
        'cd.published_at',
        'cd.created_at'
      );

    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term).orWhereILike('org.name', term);
      });
    }

    if (filter.organizationId) {
      query.where('cd.organization_id', filter.organizationId);
    }

    if (filter.categoryId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_categories as ec')
          .whereRaw('ec.entity_id = cd.entity_id')
          .where('ec.category_id', filter.categoryId)
          .whereNull('ec.deleted_at');
      });
    }

    if (filter.tagId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_tags as et')
          .whereRaw('et.entity_id = cd.entity_id')
          .where('et.tag_id', filter.tagId)
          .whereNull('et.deleted_at');
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('cd.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('cd.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      clubs: rows as ClubRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // View tracking
  // -------------------------------------------------------------------------
  public async trackView(entityId: string, context: Omit<RequestAuditContext, 'actorId'> & { viewerUserId?: string }): Promise<void> {
    const contentType = await this.db('content_types').select('id').where({ slug: 'club' }).first();
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
  private async getClubRow(id: string): Promise<ClubRow> {
    const row = await this.db('club_details as cd')
      .join('content_entities as ce', 'ce.id', 'cd.entity_id')
      .join('organizations as org', 'org.id', 'cd.organization_id')
      .where('cd.id', id)
      .whereNull('cd.deleted_at')
      .whereNull('ce.deleted_at')
      .select(
        'cd.id',
        'cd.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'cd.organization_id',
        'org.name as organization_name',
        'org.slug as organization_slug',
        'cd.leadership',
        'cd.social_links',
        'cd.meeting_schedule',
        'cd.joining_process',
        'cd.published_at',
        'cd.archived_at',
        'cd.created_at',
        'cd.updated_at',
        'cd.created_by',
        'cd.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Club not found');
    }

    return row as ClubRow;
  }

  private async mergeEntityAndClub(
    entity: Record<string, unknown>,
    club: Record<string, unknown>,
    trx: Knex | Knex.Transaction
  ): Promise<ClubRow> {
    const org = await trx('organizations').where({ id: club.organization_id }).first();

    return {
      id: String(club.id),
      entity_id: String(entity.id),
      title: String(entity.title),
      slug: String(entity.slug),
      status: String(entity.status),
      organization_id: String(club.organization_id),
      organization_name: org?.name,
      organization_slug: org?.slug,
      leadership: typeof club.leadership === 'string' ? JSON.parse(club.leadership) : (club.leadership ?? null),
      social_links: typeof club.social_links === 'string' ? JSON.parse(club.social_links) : (club.social_links ?? null),
      meeting_schedule: (club.meeting_schedule as string | null) ?? null,
      joining_process: (club.joining_process as string | null) ?? null,
      published_at: (club.published_at as Date | null) ?? null,
      archived_at: (club.archived_at as Date | null) ?? null,
      created_at: club.created_at as Date,
      updated_at: club.updated_at as Date,
      created_by: (club.created_by as string | null) ?? null,
      updated_by: (club.updated_by as string | null) ?? null
    };
  }
}
