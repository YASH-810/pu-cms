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

export interface CreateAnnouncementInput {
  title: string;
  slug: string;
  announcementTypeId: string;
  summary?: string | null;
  bodyHtml?: string | null;
  pdfUrl?: string | null;
  priority?: string;
  validFrom?: string | Date;
  validUntil?: string | Date | null;
  organizationIds?: string[];
}

export interface UpdateAnnouncementInput {
  id: string;
  title?: string;
  slug?: string;
  announcementTypeId?: string;
  summary?: string | null;
  bodyHtml?: string | null;
  pdfUrl?: string | null;
  priority?: string;
  validFrom?: string | Date;
  validUntil?: string | Date | null;
}

export interface AnnouncementRow {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: string;
  announcement_type_id: string;
  announcement_type_slug?: string;
  announcement_type_name?: string;
  summary: string | null;
  body_html: string | null;
  pdf_url: string | null;
  priority: string;
  valid_from: Date;
  valid_until: Date | null;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface AnnouncementTypeRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

export interface AnnouncementListFilter {
  status?: string;
  announcementTypeId?: string;
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublicAnnouncementListFilter {
  organizationId?: string;
  categoryId?: string;
  tagId?: string;
  announcementTypeId?: string;
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AnnouncementService {
  private readonly contentService: ContentService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
  }

  // -------------------------------------------------------------------------
  // Fetch active types
  // -------------------------------------------------------------------------
  public async listAnnouncementTypes(): Promise<AnnouncementTypeRow[]> {
    return this.db('announcement_types')
      .where({ is_active: true })
      .whereNull('deleted_at')
      .orderBy('name', 'asc');
  }

  // -------------------------------------------------------------------------
  // Validate type-specific content fields
  // -------------------------------------------------------------------------
  private async validateTypeSpecificFields(
    typeId: string,
    summary: string | null | undefined,
    bodyHtml: string | null | undefined,
    pdfUrl: string | null | undefined,
    trx: Knex | Knex.Transaction
  ) {
    const type = await trx('announcement_types')
      .where({ id: typeId, is_active: true })
      .whereNull('deleted_at')
      .first();

    if (!type) {
      throw badRequest('Invalid or inactive announcement_type_id');
    }

    if (type.slug === 'title_plus_pdf') {
      if (!pdfUrl?.trim()) {
        throw badRequest("PDF announcements require a valid 'pdf_url'");
      }
    } else if (type.slug === 'title_plus_description') {
      if (!summary?.trim()) {
        throw badRequest("Description announcements require a non-empty 'summary'");
      }
    } else if (type.slug === 'full_content') {
      if (!bodyHtml?.trim()) {
        throw badRequest("Full content announcements require a non-empty 'body_html'");
      }
    }
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  public async createAnnouncement(input: CreateAnnouncementInput, context: RequestAuditContext): Promise<AnnouncementRow> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('title and slug are required');
    }
    if (!input.announcementTypeId) {
      throw badRequest('announcementTypeId is required');
    }
    if (input.priority && !['low', 'medium', 'high', 'critical'].includes(input.priority)) {
      throw badRequest("priority must be 'low', 'medium', 'high', or 'critical'");
    }

    return this.db.transaction(async (trx) => {
      await this.validateTypeSpecificFields(
        input.announcementTypeId,
        input.summary,
        input.bodyHtml,
        input.pdfUrl,
        trx
      );

      // Create base entity record
      const entity = await this.contentService.createEntity(
        {
          contentTypeSlug: 'announcement',
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          payload: {},
          organizationIds: input.organizationIds ?? []
        },
        context
      );

      const entityId = String(entity.id);

      // Insert announcement-specific record
      const [announcement] = await trx('announcements')
        .insert({
          entity_id: entityId,
          announcement_type_id: input.announcementTypeId,
          summary: input.summary ?? null,
          body_html: input.bodyHtml ?? null,
          pdf_url: input.pdfUrl ?? null,
          priority: input.priority ?? 'medium',
          valid_from: input.validFrom ? new Date(input.validFrom) : trx.fn.now(),
          valid_until: input.validUntil ? new Date(input.validUntil) : null,
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*')
        .transacting(trx);

      return this.mergeEntityAndAnnouncement(entity, announcement, trx);
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  public async updateAnnouncement(input: UpdateAnnouncementInput, context: RequestAuditContext): Promise<AnnouncementRow> {
    const existing = await this.getAnnouncementRow(input.id);

    const typeId = input.announcementTypeId !== undefined ? input.announcementTypeId : existing.announcement_type_id;
    const summary = input.summary !== undefined ? input.summary : existing.summary;
    const bodyHtml = input.bodyHtml !== undefined ? input.bodyHtml : existing.body_html;
    const pdfUrl = input.pdfUrl !== undefined ? input.pdfUrl : existing.pdf_url;

    if (input.priority && !['low', 'medium', 'high', 'critical'].includes(input.priority)) {
      throw badRequest("priority must be 'low', 'medium', 'high', or 'critical'");
    }

    return this.db.transaction(async (trx) => {
      await this.validateTypeSpecificFields(typeId, summary, bodyHtml, pdfUrl, trx);

      // Update shared entity fields if provided
      if (input.title !== undefined || input.slug !== undefined) {
        await this.contentService.updateEntity(
          {
            contentTypeSlug: 'announcement',
            entityId: existing.entity_id,
            title: input.title,
            slug: input.slug !== undefined
              ? input.slug.trim().toLowerCase().replace(/\s+/g, '-')
              : undefined
          },
          context
        );
      }

      // Update announcement-specific fields
      const updateData: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.announcementTypeId !== undefined) updateData.announcement_type_id = input.announcementTypeId;
      if (input.summary !== undefined) updateData.summary = input.summary;
      if (input.bodyHtml !== undefined) updateData.body_html = input.bodyHtml;
      if (input.pdfUrl !== undefined) updateData.pdf_url = input.pdfUrl;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.validFrom !== undefined) updateData.valid_from = new Date(input.validFrom);
      if (input.validUntil !== undefined) {
        updateData.valid_until = input.validUntil ? new Date(input.validUntil) : null;
      }

      const [updatedAnnouncement] = await trx('announcements')
        .where({ id: input.id })
        .whereNull('deleted_at')
        .update(updateData)
        .returning('*');

      // Re-fetch latest entity after update
      const entity = await trx('content_entities')
        .where({ id: existing.entity_id })
        .whereNull('deleted_at')
        .first();

      return this.mergeEntityAndAnnouncement(entity, updatedAnnouncement, trx);
    });
  }

  // -------------------------------------------------------------------------
  // Archive (soft-delete)
  // -------------------------------------------------------------------------
  public async archiveAnnouncement(id: string, context: RequestAuditContext): Promise<void> {
    const existing = await this.getAnnouncementRow(id);

    await this.db.transaction(async (trx) => {
      // Transition status to archived
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: 'announcement',
          entityId: existing.entity_id,
          status: 'archived',
          remarks: 'Announcement archived by admin'
        },
        context
      );

      // Soft-delete announcements row
      await trx('announcements')
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
  ): Promise<AnnouncementRow> {
    const existing = await this.getAnnouncementRow(id);

    // Validate type-specific required fields before transitioning
    await this.validateTypeSpecificFields(
      existing.announcement_type_id,
      existing.summary,
      existing.body_html,
      existing.pdf_url,
      this.db
    );

    const entity = await this.contentService.transitionStatus(
      {
        contentTypeSlug: 'announcement',
        entityId: existing.entity_id,
        status,
        remarks
      },
      context
    );

    // Stamp timestamps on the announcements row too
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    };

    if (status === 'published') update.published_at = this.db.fn.now();
    if (status === 'archived') {
      update.archived_at = this.db.fn.now();
    }

    const [updatedAnnouncement] = await this.db('announcements')
      .where({ id })
      .update(update)
      .returning('*');

    return this.mergeEntityAndAnnouncement(entity, updatedAnnouncement, this.db);
  }

  // -------------------------------------------------------------------------
  // List (admin — all statuses)
  // -------------------------------------------------------------------------
  public async listAnnouncements(filter: AnnouncementListFilter): Promise<{ announcements: AnnouncementRow[]; total: number }> {
    const query = this.db('announcements as an')
      .join('content_entities as ce', 'ce.id', 'an.entity_id')
      .join('announcement_types as ant', 'ant.id', 'an.announcement_type_id')
      .whereNull('an.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'announcement' }).first())
      .select(
        'an.id',
        'an.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'an.announcement_type_id',
        'ant.slug as announcement_type_slug',
        'ant.name as announcement_type_name',
        'an.summary',
        'an.body_html',
        'an.pdf_url',
        'an.priority',
        'an.valid_from',
        'an.valid_until',
        'an.published_at',
        'an.archived_at',
        'an.created_at',
        'an.updated_at',
        'an.created_by',
        'an.updated_by'
      );

    if (filter.status) {
      query.where('ce.status', filter.status);
    }

    if (filter.announcementTypeId) {
      query.where('an.announcement_type_id', filter.announcementTypeId);
    }

    if (filter.priority) {
      query.where('an.priority', filter.priority);
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('an.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('an.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      announcements: rows as AnnouncementRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Get single announcement (admin)
  // -------------------------------------------------------------------------
  public async getAnnouncementById(id: string): Promise<AnnouncementRow> {
    return this.getAnnouncementRow(id);
  }

  // -------------------------------------------------------------------------
  // Get single published announcement by slug (public)
  // -------------------------------------------------------------------------
  public async getPublishedAnnouncementBySlug(slug: string): Promise<AnnouncementRow> {
    const row = await this.db('announcements as an')
      .join('content_entities as ce', 'ce.id', 'an.entity_id')
      .join('announcement_types as ant', 'ant.id', 'an.announcement_type_id')
      .whereNull('an.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.slug', slug)
      .where('ce.status', 'published')
      .where('an.valid_from', '<=', this.db.fn.now())
      .andWhere((q) => {
        q.whereNull('an.valid_until').orWhere('an.valid_until', '>=', this.db.fn.now());
      })
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'announcement' }).first())
      .select(
        'an.id',
        'an.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'an.announcement_type_id',
        'ant.slug as announcement_type_slug',
        'ant.name as announcement_type_name',
        'an.summary',
        'an.body_html',
        'an.pdf_url',
        'an.priority',
        'an.valid_from',
        'an.valid_until',
        'an.published_at',
        'an.archived_at',
        'an.created_at',
        'an.updated_at',
        'an.created_by',
        'an.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Announcement not found or expired');
    }

    return row as AnnouncementRow;
  }

  // -------------------------------------------------------------------------
  // List published active announcements (public)
  // -------------------------------------------------------------------------
  public async listPublishedAnnouncements(filter: PublicAnnouncementListFilter): Promise<{ announcements: AnnouncementRow[]; total: number }> {
    const query = this.db('announcements as an')
      .join('content_entities as ce', 'ce.id', 'an.entity_id')
      .join('announcement_types as ant', 'ant.id', 'an.announcement_type_id')
      .whereNull('an.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.status', 'published')
      .where('an.valid_from', '<=', this.db.fn.now())
      .andWhere((q) => {
        q.whereNull('an.valid_until').orWhere('an.valid_until', '>=', this.db.fn.now());
      })
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'announcement' }).first())
      .select(
        'an.id',
        'an.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'an.announcement_type_id',
        'ant.slug as announcement_type_slug',
        'ant.name as announcement_type_name',
        'an.summary',
        'an.pdf_url',
        'an.priority',
        'an.valid_from',
        'an.valid_until',
        'an.published_at',
        'an.created_at'
      );

    if (filter.announcementTypeId) {
      query.where('an.announcement_type_id', filter.announcementTypeId);
    }

    if (filter.priority) {
      query.where('an.priority', filter.priority);
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
          .whereRaw('eo.entity_id = an.entity_id')
          .where('eo.organization_id', filter.organizationId)
          .whereNull('eo.deleted_at');
      });
    }

    if (filter.categoryId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_categories as ec')
          .whereRaw('ec.entity_id = an.entity_id')
          .where('ec.category_id', filter.categoryId)
          .whereNull('ec.deleted_at');
      });
    }

    if (filter.tagId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_tags as et')
          .whereRaw('et.entity_id = an.entity_id')
          .where('et.tag_id', filter.tagId)
          .whereNull('et.deleted_at');
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('an.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        // Critical / High priority announcements pinned to top, then valid_from date
        .orderByRaw(`
          CASE an.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END ASC
        `)
        .orderBy('an.valid_from', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      announcements: rows as AnnouncementRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Track an announcement view
  // -------------------------------------------------------------------------
  public async trackView(entityId: string, context: Omit<RequestAuditContext, 'actorId'> & { viewerUserId?: string }): Promise<void> {
    const contentType = await this.db('content_types').select('id').where({ slug: 'announcement' }).first();
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
  private async getAnnouncementRow(id: string): Promise<AnnouncementRow> {
    const row = await this.db('announcements as an')
      .join('content_entities as ce', 'ce.id', 'an.entity_id')
      .join('announcement_types as ant', 'ant.id', 'an.announcement_type_id')
      .where('an.id', id)
      .whereNull('an.deleted_at')
      .whereNull('ce.deleted_at')
      .select(
        'an.id',
        'an.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'an.announcement_type_id',
        'ant.slug as announcement_type_slug',
        'ant.name as announcement_type_name',
        'an.summary',
        'an.body_html',
        'an.pdf_url',
        'an.priority',
        'an.valid_from',
        'an.valid_until',
        'an.published_at',
        'an.archived_at',
        'an.created_at',
        'an.updated_at',
        'an.created_by',
        'an.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Announcement not found');
    }

    return row as AnnouncementRow;
  }

  private async mergeEntityAndAnnouncement(
    entity: Record<string, unknown>,
    announcement: Record<string, unknown>,
    trx: Knex | Knex.Transaction
  ): Promise<AnnouncementRow> {
    const type = await trx('announcement_types').where({ id: announcement.announcement_type_id }).first();

    return {
      id: String(announcement.id),
      entity_id: String(entity.id),
      title: String(entity.title),
      slug: String(entity.slug),
      status: String(entity.status),
      announcement_type_id: String(announcement.announcement_type_id),
      announcement_type_slug: type?.slug,
      announcement_type_name: type?.name,
      summary: (announcement.summary as string | null) ?? null,
      body_html: (announcement.body_html as string | null) ?? null,
      pdf_url: (announcement.pdf_url as string | null) ?? null,
      priority: String(announcement.priority ?? 'medium'),
      valid_from: announcement.valid_from as Date,
      valid_until: (announcement.valid_until as Date | null) ?? null,
      published_at: (announcement.published_at as Date | null) ?? null,
      archived_at: (announcement.archived_at as Date | null) ?? null,
      created_at: announcement.created_at as Date,
      updated_at: announcement.updated_at as Date,
      created_by: (announcement.created_by as string | null) ?? null,
      updated_by: (announcement.updated_by as string | null) ?? null
    };
  }
}
