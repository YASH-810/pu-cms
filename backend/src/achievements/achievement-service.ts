import type { Knex } from 'knex';
import { badRequest, notFound } from '../http/api-error.js';
import { ContentService, type ContentStatus } from '../content/content-service.js';

export interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateAchievementInput {
  title: string;
  slug: string;
  achievementType: string;
  level: string;
  awardedAt: string | Date;
  awardedBy: string;
  prizeAmount?: number | null;
  isFeatured?: boolean;
  organizationIds?: string[];
}

export interface UpdateAchievementInput {
  id: string;
  title?: string;
  slug?: string;
  achievementType?: string;
  level?: string;
  awardedAt?: string | Date;
  awardedBy?: string;
  prizeAmount?: number | null;
  isFeatured?: boolean;
}

export interface AchievementRow {
  id: string;
  entity_id: string;
  title: string;
  slug: string;
  status: string;
  achievement_type: string;
  level: string;
  awarded_at: Date;
  awarded_by: string;
  prize_amount: number | null;
  is_featured: boolean;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface AchievementListFilter {
  status?: string;
  achievementType?: string;
  level?: string;
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublicAchievementListFilter {
  organizationId?: string;
  categoryId?: string;
  tagId?: string;
  achievementType?: string;
  level?: string;
  isFeatured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

const ALLOWED_LEVELS = ['international', 'national', 'state', 'university', 'school'];

export class AchievementService {
  private readonly contentService: ContentService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
  }

  private validateFields(level?: string) {
    if (level && !ALLOWED_LEVELS.includes(level)) {
      throw badRequest(`level must be one of: ${ALLOWED_LEVELS.join(', ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------
  public async createAchievement(input: CreateAchievementInput, context: RequestAuditContext): Promise<AchievementRow> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('title and slug are required');
    }
    if (!input.achievementType?.trim() || !input.level?.trim() || !input.awardedBy?.trim()) {
      throw badRequest('achievementType, level, and awardedBy are required');
    }
    if (!input.awardedAt) {
      throw badRequest('awardedAt is required');
    }

    this.validateFields(input.level);

    return this.db.transaction(async (trx) => {
      // Create base entity record
      const entity = await this.contentService.createEntity(
        {
          contentTypeSlug: 'achievement',
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
          payload: {},
          organizationIds: input.organizationIds ?? []
        },
        context
      );

      const entityId = String(entity.id);

      // Insert achievement-specific record
      const [achievement] = await trx('achievements')
        .insert({
          entity_id: entityId,
          achievement_type: input.achievementType.trim(),
          level: input.level,
          awarded_at: new Date(input.awardedAt),
          awarded_by: input.awardedBy.trim(),
          prize_amount: input.prizeAmount ?? null,
          is_featured: input.isFeatured ?? false,
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*')
        .transacting(trx);

      return this.mergeEntityAndAchievement(entity, achievement);
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  public async updateAchievement(input: UpdateAchievementInput, context: RequestAuditContext): Promise<AchievementRow> {
    const existing = await this.getAchievementRow(input.id);

    this.validateFields(input.level);

    return this.db.transaction(async (trx) => {
      // Update shared entity fields if provided
      if (input.title !== undefined || input.slug !== undefined) {
        await this.contentService.updateEntity(
          {
            contentTypeSlug: 'achievement',
            entityId: existing.entity_id,
            title: input.title,
            slug: input.slug !== undefined
              ? input.slug.trim().toLowerCase().replace(/\s+/g, '-')
              : undefined
          },
          context
        );
      }

      // Update achievement-specific fields
      const updateData: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.achievementType !== undefined) updateData.achievement_type = input.achievementType.trim();
      if (input.level !== undefined) updateData.level = input.level;
      if (input.awardedAt !== undefined) updateData.awarded_at = new Date(input.awardedAt);
      if (input.awardedBy !== undefined) updateData.awarded_by = input.awardedBy.trim();
      if (input.prizeAmount !== undefined) updateData.prize_amount = input.prizeAmount;
      if (input.isFeatured !== undefined) updateData.is_featured = input.isFeatured;

      const [updatedAchievement] = await trx('achievements')
        .where({ id: input.id })
        .whereNull('deleted_at')
        .update(updateData)
        .returning('*');

      // Re-fetch latest entity after update
      const entity = await trx('content_entities')
        .where({ id: existing.entity_id })
        .whereNull('deleted_at')
        .first();

      return this.mergeEntityAndAchievement(entity, updatedAchievement);
    });
  }

  // -------------------------------------------------------------------------
  // Archive (soft-delete)
  // -------------------------------------------------------------------------
  public async archiveAchievement(id: string, context: RequestAuditContext): Promise<void> {
    const existing = await this.getAchievementRow(id);

    await this.db.transaction(async (trx) => {
      // Transition status to archived
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: 'achievement',
          entityId: existing.entity_id,
          status: 'archived',
          remarks: 'Achievement archived by admin'
        },
        context
      );

      // Soft-delete achievements row
      await trx('achievements')
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
  ): Promise<AchievementRow> {
    const existing = await this.getAchievementRow(id);

    const entity = await this.contentService.transitionStatus(
      {
        contentTypeSlug: 'achievement',
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

    const [updatedAchievement] = await this.db('achievements')
      .where({ id })
      .update(update)
      .returning('*');

    return this.mergeEntityAndAchievement(entity, updatedAchievement);
  }

  // -------------------------------------------------------------------------
  // List (admin)
  // -------------------------------------------------------------------------
  public async listAchievements(filter: AchievementListFilter): Promise<{ achievements: AchievementRow[]; total: number }> {
    const query = this.db('achievements as ac')
      .join('content_entities as ce', 'ce.id', 'ac.entity_id')
      .whereNull('ac.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'achievement' }).first())
      .select(
        'ac.id',
        'ac.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'ac.achievement_type',
        'ac.level',
        'ac.awarded_at',
        'ac.awarded_by',
        'ac.prize_amount',
        'ac.is_featured',
        'ac.published_at',
        'ac.archived_at',
        'ac.created_at',
        'ac.updated_at',
        'ac.created_by',
        'ac.updated_by'
      );

    if (filter.status) {
      query.where('ce.status', filter.status);
    }
    if (filter.achievementType) {
      query.where('ac.achievement_type', filter.achievementType);
    }
    if (filter.level) {
      query.where('ac.level', filter.level);
    }
    if (filter.isFeatured !== undefined) {
      query.where('ac.is_featured', filter.isFeatured);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term).orWhereILike('ac.awarded_by', term);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('ac.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('ac.created_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      achievements: rows as AchievementRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // Get single (admin)
  // -------------------------------------------------------------------------
  public async getAchievementById(id: string): Promise<AchievementRow> {
    return this.getAchievementRow(id);
  }

  // -------------------------------------------------------------------------
  // Get single (public)
  // -------------------------------------------------------------------------
  public async getPublishedAchievementBySlug(slug: string): Promise<AchievementRow> {
    const row = await this.db('achievements as ac')
      .join('content_entities as ce', 'ce.id', 'ac.entity_id')
      .whereNull('ac.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.slug', slug)
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'achievement' }).first())
      .select(
        'ac.id',
        'ac.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'ac.achievement_type',
        'ac.level',
        'ac.awarded_at',
        'ac.awarded_by',
        'ac.prize_amount',
        'ac.is_featured',
        'ac.published_at',
        'ac.archived_at',
        'ac.created_at',
        'ac.updated_at',
        'ac.created_by',
        'ac.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Achievement not found');
    }

    return row as AchievementRow;
  }

  // -------------------------------------------------------------------------
  // List published (public)
  // -------------------------------------------------------------------------
  public async listPublishedAchievements(filter: PublicAchievementListFilter): Promise<{ achievements: AchievementRow[]; total: number }> {
    const query = this.db('achievements as ac')
      .join('content_entities as ce', 'ce.id', 'ac.entity_id')
      .whereNull('ac.deleted_at')
      .whereNull('ce.deleted_at')
      .where('ce.status', 'published')
      .where('ce.content_type_id', this.db('content_types').select('id').where({ slug: 'achievement' }).first())
      .select(
        'ac.id',
        'ac.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'ac.achievement_type',
        'ac.level',
        'ac.awarded_at',
        'ac.awarded_by',
        'ac.prize_amount',
        'ac.is_featured',
        'ac.published_at',
        'ac.created_at'
      );

    if (filter.achievementType) {
      query.where('ac.achievement_type', filter.achievementType);
    }
    if (filter.level) {
      query.where('ac.level', filter.level);
    }
    if (filter.isFeatured !== undefined) {
      query.where('ac.is_featured', filter.isFeatured);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      query.where((q) => {
        q.whereILike('ce.title', term).orWhereILike('ce.slug', term).orWhereILike('ac.awarded_by', term);
      });
    }

    if (filter.organizationId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_organizations as eo')
          .whereRaw('eo.entity_id = ac.entity_id')
          .where('eo.organization_id', filter.organizationId)
          .whereNull('eo.deleted_at');
      });
    }

    if (filter.categoryId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_categories as ec')
          .whereRaw('ec.entity_id = ac.entity_id')
          .where('ec.category_id', filter.categoryId)
          .whereNull('ec.deleted_at');
      });
    }

    if (filter.tagId) {
      query.whereExists(function () {
        this.select('*')
          .from('entity_tags as et')
          .whereRaw('et.entity_id = ac.entity_id')
          .where('et.tag_id', filter.tagId)
          .whereNull('et.deleted_at');
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('ac.id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('ac.is_featured', 'desc')
        .orderBy('ac.awarded_at', 'desc')
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
    ]);

    return {
      achievements: rows as AchievementRow[],
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  }

  // -------------------------------------------------------------------------
  // View impressions tracking
  // -------------------------------------------------------------------------
  public async trackView(entityId: string, context: Omit<RequestAuditContext, 'actorId'> & { viewerUserId?: string }): Promise<void> {
    const contentType = await this.db('content_types').select('id').where({ slug: 'achievement' }).first();
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
  private async getAchievementRow(id: string): Promise<AchievementRow> {
    const row = await this.db('achievements as ac')
      .join('content_entities as ce', 'ce.id', 'ac.entity_id')
      .where('ac.id', id)
      .whereNull('ac.deleted_at')
      .whereNull('ce.deleted_at')
      .select(
        'ac.id',
        'ac.entity_id',
        'ce.title',
        'ce.slug',
        'ce.status',
        'ac.achievement_type',
        'ac.level',
        'ac.awarded_at',
        'ac.awarded_by',
        'ac.prize_amount',
        'ac.is_featured',
        'ac.published_at',
        'ac.archived_at',
        'ac.created_at',
        'ac.updated_at',
        'ac.created_by',
        'ac.updated_by'
      )
      .first();

    if (!row) {
      throw notFound('Achievement not found');
    }

    return row as AchievementRow;
  }

  private mergeEntityAndAchievement(
    entity: Record<string, unknown>,
    achievement: Record<string, unknown>
  ): AchievementRow {
    return {
      id: String(achievement.id),
      entity_id: String(entity.id),
      title: String(entity.title),
      slug: String(entity.slug),
      status: String(entity.status),
      achievement_type: String(achievement.achievement_type),
      level: String(achievement.level),
      awarded_at: achievement.awarded_at as Date,
      awarded_by: String(achievement.awarded_by),
      prize_amount: achievement.prize_amount ? Number(achievement.prize_amount) : null,
      is_featured: Boolean(achievement.is_featured),
      published_at: (achievement.published_at as Date | null) ?? null,
      archived_at: (achievement.archived_at as Date | null) ?? null,
      created_at: achievement.created_at as Date,
      updated_at: achievement.updated_at as Date,
      created_by: (achievement.created_by as string | null) ?? null,
      updated_by: (achievement.updated_by as string | null) ?? null
    };
  }
}
