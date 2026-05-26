import type { Knex } from 'knex';
import { badRequest, notFound } from '../http/api-error.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ContentTypeRow {
  id: string;
  slug: string;
}

interface SetCategoriesInput {
  contentTypeId: string;
  entityId: string;
  categoryIds: string[];
}

interface RemoveCategoryInput {
  contentTypeId: string;
  entityId: string;
  categoryId: string;
}

interface SetTagsInput {
  contentTypeId: string;
  entityId: string;
  tagIds: string[];
}

interface RemoveTagInput {
  contentTypeId: string;
  entityId: string;
  tagId: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TaxonomyAssignmentService {
  public constructor(private readonly db: Knex) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Resolve a content type slug to its row, throwing 404 if not found. */
  public async resolveContentType(slug: string): Promise<ContentTypeRow> {
    const ct = await this.db('content_types')
      .select('id', 'slug')
      .where({ slug, is_active: true })
      .whereNull('deleted_at')
      .first();

    if (!ct) {
      throw notFound(`Content type '${slug}' not found`);
    }

    return ct;
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  /**
   * Replace the full set of categories assigned to an entity.
   * Soft-deletes any category assignments not in the new list and
   * upserts the incoming ones.
   */
  public async setCategories(
    input: SetCategoriesInput,
    context: RequestAuditContext
  ): Promise<Record<string, unknown>[]> {
    const { contentTypeId, entityId, categoryIds } = input;

    // Validate all provided category IDs exist and are active
    if (categoryIds.length > 0) {
      const existing = await this.db('categories')
        .whereIn('id', categoryIds)
        .where({ is_active: true })
        .whereNull('deleted_at')
        .select('id');

      const foundIds = new Set(existing.map((r: { id: string }) => r.id));
      const invalid = categoryIds.filter((id) => !foundIds.has(id));

      if (invalid.length > 0) {
        throw badRequest(`Category IDs not found or inactive: ${invalid.join(', ')}`);
      }
    }

    return this.db.transaction<Record<string, unknown>[]>(async (trx) => {
      // Soft-delete all existing assignments for this entity
      await trx('entity_categories')
        .where({ content_type_id: contentTypeId, entity_id: entityId })
        .whereNull('deleted_at')
        .update({
          deleted_at: trx.fn.now(),
          updated_at: trx.fn.now(),
          updated_by: context.actorId
        });

      if (categoryIds.length > 0) {
        // Insert the new set, re-activating soft-deleted rows where they existed
        const rows = categoryIds.map((categoryId) => ({
          content_type_id: contentTypeId,
          entity_id: entityId,
          category_id: categoryId,
          created_by: context.actorId,
          updated_by: context.actorId
        }));

        await trx('entity_categories').insert(rows).onConflict(['content_type_id', 'entity_id', 'category_id']).merge({
          deleted_at: null,
          updated_at: trx.fn.now(),
          updated_by: context.actorId
        });
      }

      const result: Record<string, unknown>[] = await trx('entity_categories')
        .join('categories', 'entity_categories.category_id', 'categories.id')
        .where({
          'entity_categories.content_type_id': contentTypeId,
          'entity_categories.entity_id': entityId
        })
        .whereNull('entity_categories.deleted_at')
        .select('entity_categories.*', 'categories.name as category_name', 'categories.slug as category_slug');

      return result;
    });
  }

  /** Remove a single category assignment from an entity. */
  public async removeCategory(
    input: RemoveCategoryInput,
    context: RequestAuditContext
  ): Promise<void> {
    const { contentTypeId, entityId, categoryId } = input;

    const row = await this.db('entity_categories')
      .where({ content_type_id: contentTypeId, entity_id: entityId, category_id: categoryId })
      .whereNull('deleted_at')
      .first();

    if (!row) {
      throw notFound('Category assignment not found');
    }

    await this.db('entity_categories').where({ id: row.id }).update({
      deleted_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    });
  }

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------

  /**
   * Replace the full set of tags assigned to an entity.
   * Soft-deletes any tag assignments not in the new list and
   * upserts the incoming ones.
   */
  public async setTags(
    input: SetTagsInput,
    context: RequestAuditContext
  ): Promise<Record<string, unknown>[]> {
    const { contentTypeId, entityId, tagIds } = input;

    // Validate all provided tag IDs exist and are active
    if (tagIds.length > 0) {
      const existing = await this.db('tags')
        .whereIn('id', tagIds)
        .where({ is_active: true })
        .whereNull('deleted_at')
        .select('id');

      const foundIds = new Set(existing.map((r: { id: string }) => r.id));
      const invalid = tagIds.filter((id) => !foundIds.has(id));

      if (invalid.length > 0) {
        throw badRequest(`Tag IDs not found or inactive: ${invalid.join(', ')}`);
      }
    }

    return this.db.transaction<Record<string, unknown>[]>(async (trx) => {
      // Soft-delete all existing assignments for this entity
      await trx('entity_tags')
        .where({ content_type_id: contentTypeId, entity_id: entityId })
        .whereNull('deleted_at')
        .update({
          deleted_at: trx.fn.now(),
          updated_at: trx.fn.now(),
          updated_by: context.actorId
        });

      if (tagIds.length > 0) {
        const rows = tagIds.map((tagId) => ({
          content_type_id: contentTypeId,
          entity_id: entityId,
          tag_id: tagId,
          created_by: context.actorId,
          updated_by: context.actorId
        }));

        await trx('entity_tags').insert(rows).onConflict(['content_type_id', 'entity_id', 'tag_id']).merge({
          deleted_at: null,
          updated_at: trx.fn.now(),
          updated_by: context.actorId
        });
      }

      const result: Record<string, unknown>[] = await trx('entity_tags')
        .join('tags', 'entity_tags.tag_id', 'tags.id')
        .where({
          'entity_tags.content_type_id': contentTypeId,
          'entity_tags.entity_id': entityId
        })
        .whereNull('entity_tags.deleted_at')
        .select('entity_tags.*', 'tags.name as tag_name', 'tags.slug as tag_slug');

      return result;
    });
  }

  /** Remove a single tag assignment from an entity. */
  public async removeTag(
    input: RemoveTagInput,
    context: RequestAuditContext
  ): Promise<void> {
    const { contentTypeId, entityId, tagId } = input;

    const row = await this.db('entity_tags')
      .where({ content_type_id: contentTypeId, entity_id: entityId, tag_id: tagId })
      .whereNull('deleted_at')
      .first();

    if (!row) {
      throw notFound('Tag assignment not found');
    }

    await this.db('entity_tags').where({ id: row.id }).update({
      deleted_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    });
  }

  // -------------------------------------------------------------------------
  // Combined view
  // -------------------------------------------------------------------------

  /** Return the full taxonomy (categories + tags) currently assigned to an entity. */
  public async getEntityTaxonomy(
    contentTypeId: string,
    entityId: string
  ): Promise<{ categories: Record<string, unknown>[]; tags: Record<string, unknown>[] }> {
    const [categories, tags] = await Promise.all([
      this.db('entity_categories')
        .join('categories', 'entity_categories.category_id', 'categories.id')
        .where({
          'entity_categories.content_type_id': contentTypeId,
          'entity_categories.entity_id': entityId
        })
        .whereNull('entity_categories.deleted_at')
        .select(
          'categories.id',
          'categories.name',
          'categories.slug',
          'categories.description',
          'entity_categories.created_at as assigned_at'
        ),

      this.db('entity_tags')
        .join('tags', 'entity_tags.tag_id', 'tags.id')
        .where({
          'entity_tags.content_type_id': contentTypeId,
          'entity_tags.entity_id': entityId
        })
        .whereNull('entity_tags.deleted_at')
        .select(
          'tags.id',
          'tags.name',
          'tags.slug',
          'entity_tags.created_at as assigned_at'
        )
    ]);

    return { categories, tags };
  }
}
