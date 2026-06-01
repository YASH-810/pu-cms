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

export interface CreateBlogInput {
  title: string;
  slug: string;
  summary?: string | null;
  bodyHtml?: string | null;
  heroImageUrl?: string | null;
  authorId?: string | null;
  isFeatured?: boolean;
  isPinned?: boolean;
  organizationIds?: string[];
}

export interface UpdateBlogInput {
  id: string;
  title?: string;
  slug?: string;
  summary?: string | null;
  bodyHtml?: string | null;
  heroImageUrl?: string | null;
  authorId?: string | null;
  isFeatured?: boolean;
  isPinned?: boolean;
}

export interface BlogRow {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: string;
  summary: string | null;
  body_html: string | null;
  hero_image_url: string | null;
  author_id: string | null;
  author_name?: string | null;
  reading_time: number;
  is_featured: boolean;
  is_pinned: boolean;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface BlogListFilter {
  status?: string;
  isFeatured?: boolean;
  isPinned?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublicBlogListFilter {
  organizationId?: string;
  categoryId?: string;
  tagId?: string;
  isFeatured?: boolean;
  isPinned?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export function calculateReadingTime(html: string | null): number {
  if (!html?.trim()) return 0;
  // Strip HTML tags
  const text = html.replace(/<[^>]*>/g, ' ');
  // Count words
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  // Compute at 200 WPM
  return Math.max(1, Math.ceil(words.length / 200));
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BlogService {
  private readonly contentService: ContentService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  public async createBlog(input: CreateBlogInput, context: RequestAuditContext): Promise<BlogRow> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('title and slug are required');
    }

    return this.db.transaction(async (trx) => {
      // Create the shared entity record first
      const entity = await this.contentService.createEntity(
        {
          contentTypeSlug: 'blog',
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          payload: {},
          organizationIds: input.organizationIds ?? []
        },
        context
      );

      const entityId = String(entity.id);
      const readingTime = calculateReadingTime(input.bodyHtml ?? null);

      // Insert blog-specific record
      const [blog] = await trx('blogs')
        .insert({
          entity_id: entityId,
          summary: input.summary ?? null,
          body_html: input.bodyHtml ?? null,
          hero_image_url: input.heroImageUrl ?? null,
          author_id: input.authorId ?? null,
          reading_time: readingTime,
          is_featured: input.isFeatured ?? false,
          is_pinned: input.isPinned ?? false,
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*')
        .transacting(trx);

      const merged = await this.mergeEntityAndBlog(entity, blog, trx);
      return merged;
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  public async updateBlog(input: UpdateBlogInput, context: RequestAuditContext): Promise<BlogRow> {
    const existing = await this.getBlogRow(input.id);

    return this.db.transaction(async (trx) => {
      // Update shared entity fields if provided
      if (input.title !== undefined || input.slug !== undefined) {
        await this.contentService.updateEntity(
          {
            contentTypeSlug: 'blog',
            entityId: existing.entity_id,
            title: input.title,
            slug: input.slug !== undefined
              ? input.slug.trim().toLowerCase().replace(/\s+/g, '-')
              : undefined
          },
          context
        );
      }

      // Update blog-specific fields
      const blogUpdate: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.summary !== undefined) blogUpdate.summary = input.summary;
      if (input.bodyHtml !== undefined) {
        blogUpdate.body_html = input.bodyHtml;
        blogUpdate.reading_time = calculateReadingTime(input.bodyHtml);
      }
      if (input.heroImageUrl !== undefined) blogUpdate.hero_image_url = input.heroImageUrl;
      if (input.authorId !== undefined) blogUpdate.author_id = input.authorId;
      if (input.isFeatured !== undefined) blogUpdate.is_featured = input.isFeatured;
      if (input.isPinned !== undefined) blogUpdate.is_pinned = input.isPinned;

      const [updatedBlog] = await trx('blogs')
        .where({ id: input.id })
        .whereNull('deleted_at')
        .update(blogUpdate)
        .returning('*');

      // Re-fetch latest entity after update
      const entity = await trx('content_entities')
        .where({ id: existing.entity_id })
        .whereNull('deleted_at')
        .first();

      const merged = await this.mergeEntityAndBlog(entity, updatedBlog, trx);
      return merged;
    });
  }

  // -------------------------------------------------------------------------
  // Archive (soft-delete)
  // -------------------------------------------------------------------------
  public async archiveBlog(id: string, context: RequestAuditContext): Promise<void> {
    const blog = await this.getBlogRow(id);

    await this.db.transaction(async (trx) => {
      // Transition entity status to archived
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: 'blog',
          entityId: blog.entity_id,
          status: 'archived',
          remarks: 'Blog archived by admin'
        },
        context
      );

      // Soft-delete blog extension row
      await trx('blogs')
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
    blogId: string,
    status: ContentStatus,
    remarks: string | undefined,
    context: RequestAuditContext
  ): Promise<BlogRow> {
    const blog = await this.getBlogRow(blogId);

    const entity = await this.contentService.transitionStatus(
      {
        contentTypeSlug: 'blog',
        entityId: blog.entity_id,
        status,
        remarks
      },
      context
    );

    // Stamp timestamps on the blogs row too
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    };

    if (status === 'published') update.published_at = this.db.fn.now();
    if (status === 'archived') {
      update.archived_at = this.db.fn.now();
    }

    const [updatedBlog] = await this.db('blogs')
      .where({ id: blogId })
      .update(update)
      .returning('*');

    const merged = await this.mergeEntityAndBlog(entity, updatedBlog, this.db);
    return merged;
  }

  // -------------------------------------------------------------------------
  // List (admin — all statuses)
  // -------------------------------------------------------------------------
  public async listBlogs(filter: BlogListFilter): Promise<{ blogs: BlogRow[]; total: number }> {
    const query = this.db('blogs as b')
      .join('content_entities as ce', 'ce.id', 'b.entity_id')
      .leftJoin('users as u', 'u.id', 'b.author_id')
      .whereNull('b.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'blog' }).first())
      .select(
        'b.id',
        'b.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'b.summary',
        'b.body_html',
        'b.hero_image_url',
        'b.author_id',
        'u.full_name as author_name',
        'b.reading_time',
        'b.is_featured',
        'b.is_pinned',
        'b.published_at',
        'b.archived_at',
        'b.created_at',
        'b.updated_at',
        'b.created_by',
        'b.updated_by'
      );

    if (filter.status) {
      query.where('ce.status', filter.status);
    }

    if (filter.isFeatured !== undefined) {
      query.where('b.is_featured', filter.isFeatured);
    }

    if (filter.isPinned !== undefined) {
      query.where('b.is_pinned', filter.isPinned);
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('b.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('b.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      blogs: rows as BlogRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Get single blog by blogs.id (admin)
  // -------------------------------------------------------------------------
  public async getBlogById(id: string): Promise<BlogRow> {
    return this.getBlogRow(id);
  }

  // -------------------------------------------------------------------------
  // Get published blog by slug (public)
  // -------------------------------------------------------------------------
  public async getPublishedBlogBySlug(slug: string): Promise<BlogRow> {
    const row = await this.db('blogs as b')
      .join('content_entities as ce', 'ce.id', 'b.entity_id')
      .leftJoin('users as u', 'u.id', 'b.author_id')
      .whereNull('b.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.slug', slug)
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'blog' }).first())
      .select(
        'b.id',
        'b.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'b.summary',
        'b.body_html',
        'b.hero_image_url',
        'b.author_id',
        'u.full_name as author_name',
        'b.reading_time',
        'b.is_featured',
        'b.is_pinned',
        'b.published_at',
        'b.archived_at',
        'b.created_at',
        'b.updated_at',
        'b.created_by',
        'b.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Blog not found or not published');
    }

    return row as BlogRow;
  }

  // -------------------------------------------------------------------------
  // List published blogs (public)
  // -------------------------------------------------------------------------
  public async listPublishedBlogs(filter: PublicBlogListFilter): Promise<{ blogs: BlogRow[]; total: number }> {
    const query = this.db('blogs as b')
      .join('content_entities as ce', 'ce.id', 'b.entity_id')
      .leftJoin('users as u', 'u.id', 'b.author_id')
      .whereNull('b.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'blog' }).first())
      .select(
        'b.id',
        'b.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'b.summary',
        'b.hero_image_url',
        'b.author_id',
        'u.full_name as author_name',
        'b.reading_time',
        'b.is_featured',
        'b.is_pinned',
        'b.published_at',
        'b.created_at'
      );

    if (filter.isFeatured !== undefined) {
      query.where('b.is_featured', filter.isFeatured);
    }

    if (filter.isPinned !== undefined) {
      query.where('b.is_pinned', filter.isPinned);
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
          .whereRaw('eo.entity_id = b.entity_id')
          .where('eo.organization_id', filter.organizationId)
          .whereNull('eo.deleted_at');
      });
    }

    if (filter.categoryId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_categories as ec')
          .whereRaw('ec.entity_id = b.entity_id')
          .where('ec.category_id', filter.categoryId)
          .whereNull('ec.deleted_at');
      });
    }

    if (filter.tagId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_tags as et')
          .whereRaw('et.entity_id = b.entity_id')
          .where('et.tag_id', filter.tagId)
          .whereNull('et.deleted_at');
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('b.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('b.is_pinned', 'desc')
        .orderBy('b.published_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      blogs: rows as BlogRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Track a blog view
  // -------------------------------------------------------------------------
  public async trackView(
    entityId: string,
    context: Omit<RequestAuditContext, 'actorId'> & { viewerUserId?: string }
  ): Promise<void> {
    const contentType = await this.db('content_types').select('id').where({ slug: 'blog' }).first();
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
  private async getBlogRow(id: string): Promise<BlogRow> {
    const row = await this.db('blogs as b')
      .join('content_entities as ce', 'ce.id', 'b.entity_id')
      .leftJoin('users as u', 'u.id', 'b.author_id')
      .where('b.id', id)
      .whereNull('b.deleted_at')
      .whereNull('ce.deleted_at')
      .select(
        'b.id',
        'b.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'b.summary',
        'b.body_html',
        'b.hero_image_url',
        'b.author_id',
        'u.full_name as author_name',
        'b.reading_time',
        'b.is_featured',
        'b.is_pinned',
        'b.published_at',
        'b.archived_at',
        'b.created_at',
        'b.updated_at',
        'b.created_by',
        'b.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Blog not found');
    }

    return row as BlogRow;
  }

  private async mergeEntityAndBlog(
    entity: Record<string, unknown>,
    blog: Record<string, unknown>,
    db: Knex | Knex.Transaction
  ): Promise<BlogRow> {
    let authorName: string | null = null;
    if (blog.author_id) {
      const user = await db('users').select('full_name').where({ id: blog.author_id }).first();
      if (user) authorName = String(user.full_name);
    }

    return {
      id: String(blog.id),
      entity_id: String(entity.id),
      title: String(entity.title),
      slug: String(entity.slug),
      status: String(entity.status),
      summary: (blog.summary as string | null) ?? null,
      body_html: (blog.body_html as string | null) ?? null,
      hero_image_url: (blog.hero_image_url as string | null) ?? null,
      author_id: (blog.author_id as string | null) ?? null,
      author_name: authorName,
      reading_time: Number(blog.reading_time ?? 0),
      is_featured: Boolean(blog.is_featured),
      is_pinned: Boolean(blog.is_pinned),
      published_at: (blog.published_at as Date | null) ?? null,
      archived_at: (blog.archived_at as Date | null) ?? null,
      created_at: blog.created_at as Date,
      updated_at: blog.updated_at as Date,
      created_by: (blog.created_by as string | null) ?? null,
      updated_by: (blog.updated_by as string | null) ?? null
    };
  }
}
