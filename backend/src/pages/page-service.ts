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

export interface CreatePageInput {
  title: string;
  slug: string;
  summary?: string | null;
  bodyHtml?: string | null;
  template?: string;
  heroImageUrl?: string | null;
  isFeatured?: boolean;
  showInNav?: boolean;
  organizationIds?: string[];
}

export interface UpdatePageInput {
  id: string;
  title?: string;
  slug?: string;
  summary?: string | null;
  bodyHtml?: string | null;
  template?: string;
  heroImageUrl?: string | null;
  isFeatured?: boolean;
  showInNav?: boolean;
}

export interface PageRow {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: string;
  summary: string | null;
  body_html: string | null;
  template: string;
  hero_image_url: string | null;
  is_featured: boolean;
  show_in_nav: boolean;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface PageListFilter {
  status?: string;
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PageService {
  private readonly contentService: ContentService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  public async createPage(input: CreatePageInput, context: RequestAuditContext): Promise<PageRow> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('title and slug are required');
    }

    return this.db.transaction(async (trx) => {
      // Create the shared entity record first
      const entity = await this.contentService.createEntity(
        {
          contentTypeSlug: 'page',
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          payload: {},
          organizationIds: input.organizationIds ?? []
        },
        context
      );

      const entityId = String(entity.id);

      // Insert page-specific record
      const [page] = await trx('pages')
        .insert({
          entity_id: entityId,
          summary: input.summary ?? null,
          body_html: input.bodyHtml ?? null,
          template: input.template ?? 'default',
          hero_image_url: input.heroImageUrl ?? null,
          is_featured: input.isFeatured ?? false,
          show_in_nav: input.showInNav ?? false,
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*')
        .transacting(trx);

      return this.mergeEntityAndPage(entity, page);
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  public async updatePage(input: UpdatePageInput, context: RequestAuditContext): Promise<PageRow> {
    const existing = await this.getPageRow(input.id);

    return this.db.transaction(async (trx) => {
      // Update shared entity fields if provided
      if (input.title !== undefined || input.slug !== undefined) {
        await this.contentService.updateEntity(
          {
            contentTypeSlug: 'page',
            entityId: existing.entity_id,
            title: input.title,
            slug: input.slug !== undefined
              ? input.slug.trim().toLowerCase().replace(/\s+/g, '-')
              : undefined
          },
          context
        );
      }

      // Update page-specific fields
      const pageUpdate: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.summary !== undefined) pageUpdate.summary = input.summary;
      if (input.bodyHtml !== undefined) pageUpdate.body_html = input.bodyHtml;
      if (input.template !== undefined) pageUpdate.template = input.template;
      if (input.heroImageUrl !== undefined) pageUpdate.hero_image_url = input.heroImageUrl;
      if (input.isFeatured !== undefined) pageUpdate.is_featured = input.isFeatured;
      if (input.showInNav !== undefined) pageUpdate.show_in_nav = input.showInNav;

      const [updatedPage] = await trx('pages')
        .where({ id: input.id })
        .whereNull('deleted_at')
        .update(pageUpdate)
        .returning('*');

      // Re-fetch latest entity after update
      const entity = await trx('content_entities')
        .where({ id: existing.entity_id })
        .whereNull('deleted_at')
        .first();

      return this.mergeEntityAndPage(entity, updatedPage);
    });
  }

  // -------------------------------------------------------------------------
  // Archive (soft-delete)
  // -------------------------------------------------------------------------
  public async archivePage(id: string, context: RequestAuditContext): Promise<void> {
    const page = await this.getPageRow(id);

    await this.db.transaction(async (trx) => {
      // Transition entity status to archived
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: 'page',
          entityId: page.entity_id,
          status: 'archived',
          remarks: 'Page archived by admin'
        },
        context
      );

      // Soft-delete page extension row
      await trx('pages')
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
    pageId: string,
    status: ContentStatus,
    remarks: string | undefined,
    context: RequestAuditContext
  ): Promise<PageRow> {
    const page = await this.getPageRow(pageId);

    const entity = await this.contentService.transitionStatus(
      {
        contentTypeSlug: 'page',
        entityId: page.entity_id,
        status,
        remarks
      },
      context
    );

    // Stamp timestamps on the pages row too
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    };

    if (status === 'published') update.published_at = this.db.fn.now();
    if (status === 'archived') {
      update.archived_at = this.db.fn.now();
    }

    const [updatedPage] = await this.db('pages')
      .where({ id: pageId })
      .update(update)
      .returning('*');

    return this.mergeEntityAndPage(entity, updatedPage);
  }

  // -------------------------------------------------------------------------
  // List (admin — all statuses)
  // -------------------------------------------------------------------------
  public async listPages(filter: PageListFilter): Promise<{ pages: PageRow[]; total: number }> {
    const query = this.db('pages as p')
      .join('content_entities as ce', 'ce.id', 'p.entity_id')
      .join('content_types as ct', 'ct.slug', this.db.raw("'page'"))
      .whereNull('p.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'page' }).first())
      .select(
        'p.id',
        'p.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'p.summary',
        'p.body_html',
        'p.template',
        'p.hero_image_url',
        'p.is_featured',
        'p.show_in_nav',
        'p.published_at',
        'p.archived_at',
        'p.created_at',
        'p.updated_at',
        'p.created_by',
        'p.updated_by'
      );

    if (filter.status) {
      query.where('ce.status', filter.status);
    }

    if (filter.isFeatured !== undefined) {
      query.where('p.is_featured', filter.isFeatured);
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('p.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('p.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      pages: rows as PageRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Get single page by pages.id (admin)
  // -------------------------------------------------------------------------
  public async getPageById(id: string): Promise<PageRow> {
    return this.getPageRow(id);
  }

  // -------------------------------------------------------------------------
  // Get published page by slug (public)
  // -------------------------------------------------------------------------
  public async getPublishedPageBySlug(slug: string): Promise<PageRow> {
    const row = await this.db('pages as p')
      .join('content_entities as ce', 'ce.id', 'p.entity_id')
      .whereNull('p.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.slug', slug)
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'page' }).first())
      .select(
        'p.id',
        'p.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'p.summary',
        'p.body_html',
        'p.template',
        'p.hero_image_url',
        'p.is_featured',
        'p.show_in_nav',
        'p.published_at',
        'p.archived_at',
        'p.created_at',
        'p.updated_at',
        'p.created_by',
        'p.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Page not found or not published');
    }

    return row as PageRow;
  }

  // -------------------------------------------------------------------------
  // List published pages (public)
  // -------------------------------------------------------------------------
  public async listPublishedPages(filter: { limit?: number; offset?: number; search?: string }): Promise<{ pages: PageRow[]; total: number }> {
    const query = this.db('pages as p')
      .join('content_entities as ce', 'ce.id', 'p.entity_id')
      .whereNull('p.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'page' }).first())
      .select(
        'p.id',
        'p.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'p.summary',
        'p.template',
        'p.hero_image_url',
        'p.is_featured',
        'p.show_in_nav',
        'p.published_at',
        'p.created_at'
      );

    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('p.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('p.published_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      pages: rows as PageRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Track a page view
  // -------------------------------------------------------------------------
  public async trackView(entityId: string, context: Omit<RequestAuditContext, 'actorId'> & { viewerUserId?: string }): Promise<void> {
    const contentType = await this.db('content_types').select('id').where({ slug: 'page' }).first();
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
  private async getPageRow(id: string): Promise<PageRow> {
    const row = await this.db('pages as p')
      .join('content_entities as ce', 'ce.id', 'p.entity_id')
      .where('p.id', id)
      .whereNull('p.deleted_at')
      .whereNull('ce.deleted_at')
      .select(
        'p.id',
        'p.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'p.summary',
        'p.body_html',
        'p.template',
        'p.hero_image_url',
        'p.is_featured',
        'p.show_in_nav',
        'p.published_at',
        'p.archived_at',
        'p.created_at',
        'p.updated_at',
        'p.created_by',
        'p.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Page not found');
    }

    return row as PageRow;
  }

  private mergeEntityAndPage(
    entity: Record<string, unknown>,
    page: Record<string, unknown>
  ): PageRow {
    return {
      id: String(page.id),
      entity_id: String(entity.id),
      title: String(entity.title),
      slug: String(entity.slug),
      status: String(entity.status),
      summary: (page.summary as string | null) ?? null,
      body_html: (page.body_html as string | null) ?? null,
      template: String(page.template ?? 'default'),
      hero_image_url: (page.hero_image_url as string | null) ?? null,
      is_featured: Boolean(page.is_featured),
      show_in_nav: Boolean(page.show_in_nav),
      published_at: (page.published_at as Date | null) ?? null,
      archived_at: (page.archived_at as Date | null) ?? null,
      created_at: page.created_at as Date,
      updated_at: page.updated_at as Date,
      created_by: (page.created_by as string | null) ?? null,
      updated_by: (page.updated_by as string | null) ?? null
    };
  }
}
