import type { Knex } from 'knex';
import { badRequest, notFound } from '../http/api-error.js';
import { ContentService, type ContentStatus } from '../content/content-service.js';

export interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateStoryInput {
  title: string;
  slug: string;
  storyType: string;
  personName: string;
  personRole: string;
  company?: string | null;
  graduationYear?: number | null;
  linkedinUrl?: string | null;
  isFeatured?: boolean;
  organizationIds?: string[];
}

export interface UpdateStoryInput {
  id: string;
  title?: string;
  slug?: string;
  storyType?: string;
  personName?: string;
  personRole?: string;
  company?: string | null;
  graduationYear?: number | null;
  linkedinUrl?: string | null;
  isFeatured?: boolean;
}

export interface StoryRow {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: string;
  story_type: string;
  person_name: string;
  person_role: string;
  company: string | null;
  graduation_year: number | null;
  linkedin_url: string | null;
  is_featured: boolean;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface StoryListFilter {
  status?: string;
  storyType?: string;
  personRole?: string;
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublicStoryListFilter {
  organizationId?: string;
  categoryId?: string;
  tagId?: string;
  storyType?: string;
  personRole?: string;
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

const ALLOWED_ROLES = ['student', 'alumnus', 'researcher', 'faculty', 'other'];

export class StoryService {
  private readonly contentService: ContentService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
  }

  private validateFields(personRole?: string) {
    if (personRole && !ALLOWED_ROLES.includes(personRole)) {
      throw badRequest(`personRole must be one of: ${ALLOWED_ROLES.join(', ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  public async createStory(input: CreateStoryInput, context: RequestAuditContext): Promise<StoryRow> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('title and slug are required');
    }
    if (!input.storyType?.trim() || !input.personName?.trim() || !input.personRole?.trim()) {
      throw badRequest('storyType, personName, and personRole are required');
    }

    this.validateFields(input.personRole);

    return this.db.transaction(async (trx) => {
      // Create base entity record
      const entity = await this.contentService.createEntity(
        {
          contentTypeSlug: 'story',
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          payload: {},
          organizationIds: input.organizationIds ?? []
        },
        context
      );

      const entityId = String(entity.id);

      // Insert story-specific record
      const [story] = await trx('stories')
        .insert({
          entity_id: entityId,
          story_type: input.storyType.trim(),
          person_name: input.personName.trim(),
          person_role: input.personRole,
          company: input.company ?? null,
          graduation_year: input.graduationYear ?? null,
          linkedin_url: input.linkedinUrl ?? null,
          is_featured: input.isFeatured ?? false,
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*')
        .transacting(trx);

      return this.mergeEntityAndStory(entity, story);
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  public async updateStory(input: UpdateStoryInput, context: RequestAuditContext): Promise<StoryRow> {
    const existing = await this.getStoryRow(input.id);

    this.validateFields(input.personRole);

    return this.db.transaction(async (trx) => {
      // Update shared entity fields if provided
      if (input.title !== undefined || input.slug !== undefined) {
        await this.contentService.updateEntity(
          {
            contentTypeSlug: 'story',
            entityId: existing.entity_id,
            title: input.title,
            slug: input.slug !== undefined
              ? input.slug.trim().toLowerCase().replace(/\s+/g, '-')
              : undefined
          },
          context
        );
      }

      // Update story-specific fields
      const updateData: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.storyType !== undefined) updateData.story_type = input.storyType.trim();
      if (input.personName !== undefined) updateData.person_name = input.personName.trim();
      if (input.personRole !== undefined) updateData.person_role = input.personRole;
      if (input.company !== undefined) updateData.company = input.company;
      if (input.graduationYear !== undefined) updateData.graduation_year = input.graduationYear;
      if (input.linkedinUrl !== undefined) updateData.linkedin_url = input.linkedinUrl;
      if (input.isFeatured !== undefined) updateData.is_featured = input.isFeatured;

      const [updatedStory] = await trx('stories')
        .where({ id: input.id })
        .whereNull('deleted_at')
        .update(updateData)
        .returning('*');

      // Re-fetch latest entity after update
      const entity = await trx('content_entities')
        .where({ id: existing.entity_id })
        .whereNull('deleted_at')
        .first();

      return this.mergeEntityAndStory(entity, updatedStory);
    });
  }

  // -------------------------------------------------------------------------
  // Archive (soft-delete)
  // -------------------------------------------------------------------------
  public async archiveStory(id: string, context: RequestAuditContext): Promise<void> {
    const existing = await this.getStoryRow(id);

    await this.db.transaction(async (trx) => {
      // Transition status to archived
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: 'story',
          entityId: existing.entity_id,
          status: 'archived',
          remarks: 'Story archived by admin'
        },
        context
      );

      // Soft-delete stories row
      await trx('stories')
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
  ): Promise<StoryRow> {
    const existing = await this.getStoryRow(id);

    const entity = await this.contentService.transitionStatus(
      {
        contentTypeSlug: 'story',
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

    const [updatedStory] = await this.db('stories')
      .where({ id })
      .update(update)
      .returning('*');

    return this.mergeEntityAndStory(entity, updatedStory);
  }

  // -------------------------------------------------------------------------
  // List (admin)
  // -------------------------------------------------------------------------
  public async listStories(filter: StoryListFilter): Promise<{ stories: StoryRow[]; total: number }> {
    const query = this.db('stories as st')
      .join('content_entities as ce', 'ce.id', 'st.entity_id')
      .whereNull('st.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'story' }).first())
      .select(
        'st.id',
        'st.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'st.story_type',
        'st.person_name',
        'st.person_role',
        'st.company',
        'st.graduation_year',
        'st.linkedin_url',
        'st.is_featured',
        'st.published_at',
        'st.archived_at',
        'st.created_at',
        'st.updated_at',
        'st.created_by',
        'st.updated_by'
      );

    if (filter.status) {
      query.where('ce.status', filter.status);
    }
    if (filter.storyType) {
      query.where('st.story_type', filter.storyType);
    }
    if (filter.personRole) {
      query.where('st.person_role', filter.personRole);
    }
    if (filter.isFeatured !== undefined) {
      query.where('st.is_featured', filter.isFeatured);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term).orWhereILike('st.person_name', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('st.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('st.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      stories: rows as StoryRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Get single (admin)
  // -------------------------------------------------------------------------
  public async getStoryById(id: string): Promise<StoryRow> {
    return this.getStoryRow(id);
  }

  // -------------------------------------------------------------------------
  // Get single (public)
  // -------------------------------------------------------------------------
  public async getPublishedStoryBySlug(slug: string): Promise<StoryRow> {
    const row = await this.db('stories as st')
      .join('content_entities as ce', 'ce.id', 'st.entity_id')
      .whereNull('st.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.slug', slug)
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'story' }).first())
      .select(
        'st.id',
        'st.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'st.story_type',
        'st.person_name',
        'st.person_role',
        'st.company',
        'st.graduation_year',
        'st.linkedin_url',
        'st.is_featured',
        'st.published_at',
        'st.archived_at',
        'st.created_at',
        'st.updated_at',
        'st.created_by',
        'st.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Story not found');
    }

    return row as StoryRow;
  }

  // -------------------------------------------------------------------------
  // List published (public)
  // -------------------------------------------------------------------------
  public async listPublishedStories(filter: PublicStoryListFilter): Promise<{ stories: StoryRow[]; total: number }> {
    const query = this.db('stories as st')
      .join('content_entities as ce', 'ce.id', 'st.entity_id')
      .whereNull('st.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'story' }).first())
      .select(
        'st.id',
        'st.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'st.story_type',
        'st.person_name',
        'st.person_role',
        'st.company',
        'st.graduation_year',
        'st.linkedin_url',
        'st.is_featured',
        'st.published_at',
        'st.created_at'
      );

    if (filter.storyType) {
      query.where('st.story_type', filter.storyType);
    }
    if (filter.personRole) {
      query.where('st.person_role', filter.personRole);
    }
    if (filter.isFeatured !== undefined) {
      query.where('st.is_featured', filter.isFeatured);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term).orWhereILike('st.person_name', term);
      });
    }

    if (filter.organizationId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_organizations as eo')
          .whereRaw('eo.entity_id = st.entity_id')
          .where('eo.organization_id', filter.organizationId)
          .whereNull('eo.deleted_at');
      });
    }

    if (filter.categoryId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_categories as ec')
          .whereRaw('ec.entity_id = st.entity_id')
          .where('ec.category_id', filter.categoryId)
          .whereNull('ec.deleted_at');
      });
    }

    if (filter.tagId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_tags as et')
          .whereRaw('et.entity_id = st.entity_id')
          .where('et.tag_id', filter.tagId)
          .whereNull('et.deleted_at');
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('st.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('st.is_featured', 'desc')
        .orderBy('st.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      stories: rows as StoryRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // View tracking
  // -------------------------------------------------------------------------
  public async trackView(entityId: string, context: Omit<RequestAuditContext, 'actorId'> & { viewerUserId?: string }): Promise<void> {
    const contentType = await this.db('content_types').select('id').where({ slug: 'story' }).first();
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
  private async getStoryRow(id: string): Promise<StoryRow> {
    const row = await this.db('stories as st')
      .join('content_entities as ce', 'ce.id', 'st.entity_id')
      .where('st.id', id)
      .whereNull('st.deleted_at')
      .whereNull('ce.deleted_at')
      .select(
        'st.id',
        'st.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'st.story_type',
        'st.person_name',
        'st.person_role',
        'st.company',
        'st.graduation_year',
        'st.linkedin_url',
        'st.is_featured',
        'st.published_at',
        'st.archived_at',
        'st.created_at',
        'st.updated_at',
        'st.created_by',
        'st.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Story not found');
    }

    return row as StoryRow;
  }

  private mergeEntityAndStory(
    entity: Record<string, unknown>,
    story: Record<string, unknown>
  ): StoryRow {
    return {
      id: String(story.id),
      entity_id: String(entity.id),
      title: String(entity.title),
      slug: String(entity.slug),
      status: String(entity.status),
      story_type: String(story.story_type),
      person_name: String(story.person_name),
      person_role: String(story.person_role),
      company: (story.company as string | null) ?? null,
      graduation_year: story.graduation_year ? Number(story.graduation_year) : null,
      linkedin_url: (story.linkedin_url as string | null) ?? null,
      is_featured: Boolean(story.is_featured),
      published_at: (story.published_at as Date | null) ?? null,
      archived_at: (story.archived_at as Date | null) ?? null,
      created_at: story.created_at as Date,
      updated_at: story.updated_at as Date,
      created_by: (story.created_by as string | null) ?? null,
      updated_by: (story.updated_by as string | null) ?? null
    };
  }
}
