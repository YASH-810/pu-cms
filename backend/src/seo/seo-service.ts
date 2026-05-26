import type { Knex } from 'knex';
import { conflict, notFound } from '../http/api-error.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpsertSeoInput {
  contentTypeId: string;
  entityId: string;
  /** BCP-47 language code, e.g. 'en', 'hi'. Defaults to 'en'. */
  languageCode?: string;

  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;

  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;

  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImageUrl?: string | null;
  twitterCardType?: string | null;

  schemaMarkup?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SeoService {
  public constructor(private readonly db: Knex) {}

  /**
   * Create or update SEO metadata for a content entity.
   * Unique key: (content_type_id, entity_id, language_code).
   */
  public async upsertSeoMetadata(
    input: UpsertSeoInput,
    context: RequestAuditContext
  ): Promise<Record<string, unknown>> {
    const languageCode = input.languageCode ?? 'en';

    const existing = await this.db('seo_metadata')
      .where({
        content_type_id: input.contentTypeId,
        entity_id: input.entityId,
        language_code: languageCode
      })
      .whereNull('deleted_at')
      .first();

    if (existing) {
      // Update existing record
      const updatePayload: Record<string, unknown> = {
        updated_at: this.db.fn.now(),
        updated_by: context.actorId
      };

      if (input.metaTitle !== undefined) updatePayload.meta_title = input.metaTitle;
      if (input.metaDescription !== undefined) updatePayload.meta_description = input.metaDescription;
      if (input.metaKeywords !== undefined) updatePayload.meta_keywords = input.metaKeywords;
      if (input.canonicalUrl !== undefined) updatePayload.canonical_url = input.canonicalUrl;
      if (input.robots !== undefined) updatePayload.robots = input.robots;

      if (input.ogTitle !== undefined) updatePayload.og_title = input.ogTitle;
      if (input.ogDescription !== undefined) updatePayload.og_description = input.ogDescription;
      if (input.ogImageUrl !== undefined) updatePayload.og_image_url = input.ogImageUrl;

      if (input.twitterTitle !== undefined) updatePayload.twitter_title = input.twitterTitle;
      if (input.twitterDescription !== undefined) updatePayload.twitter_description = input.twitterDescription;
      if (input.twitterImageUrl !== undefined) updatePayload.twitter_image_url = input.twitterImageUrl;
      if (input.twitterCardType !== undefined) updatePayload.twitter_card_type = input.twitterCardType;

      if (input.schemaMarkup !== undefined) updatePayload.schema_markup = input.schemaMarkup;

      const [updated] = await this.db('seo_metadata')
        .where({ id: existing.id })
        .update(updatePayload)
        .returning('*');

      return updated;
    }

    // Insert new record
    const [created] = await this.db('seo_metadata')
      .insert({
        content_type_id: input.contentTypeId,
        entity_id: input.entityId,
        language_code: languageCode,
        meta_title: input.metaTitle ?? null,
        meta_description: input.metaDescription ?? null,
        meta_keywords: input.metaKeywords ?? null,
        canonical_url: input.canonicalUrl ?? null,
        robots: input.robots ?? 'index,follow',
        og_title: input.ogTitle ?? null,
        og_description: input.ogDescription ?? null,
        og_image_url: input.ogImageUrl ?? null,
        twitter_title: input.twitterTitle ?? null,
        twitter_description: input.twitterDescription ?? null,
        twitter_image_url: input.twitterImageUrl ?? null,
        twitter_card_type: input.twitterCardType ?? 'summary_large_image',
        schema_markup: input.schemaMarkup ?? null,
        created_by: context.actorId,
        updated_by: context.actorId
      })
      .returning('*');

    return created;
  }

  /**
   * Get SEO metadata for a content entity and language.
   * Returns null if no record exists (not an error — may not be set yet).
   */
  public async getSeoMetadata(
    contentTypeId: string,
    entityId: string,
    languageCode = 'en'
  ): Promise<Record<string, unknown> | null> {
    const row = await this.db('seo_metadata')
      .where({ content_type_id: contentTypeId, entity_id: entityId, language_code: languageCode })
      .whereNull('deleted_at')
      .first();

    return row ?? null;
  }

  /**
   * List all SEO records for a content entity (all languages).
   */
  public async listSeoMetadata(
    contentTypeId: string,
    entityId: string
  ): Promise<Record<string, unknown>[]> {
    return this.db('seo_metadata')
      .where({ content_type_id: contentTypeId, entity_id: entityId })
      .whereNull('deleted_at')
      .orderBy('language_code', 'asc');
  }

  /** Soft-delete a SEO metadata record by ID. */
  public async deleteSeoMetadata(id: string, context: RequestAuditContext): Promise<void> {
    const existing = await this.db('seo_metadata').where({ id }).whereNull('deleted_at').first();
    if (!existing) {
      throw notFound('SEO metadata record not found');
    }

    await this.db('seo_metadata').where({ id }).update({
      deleted_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    });
  }
}
