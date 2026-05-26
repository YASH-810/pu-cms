import type { Knex } from 'knex';
import { forbidden, notFound } from '../http/api-error.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * DraftService provides list/get/delete operations on top of the autosave
 * pattern already implemented in ContentService.
 *
 * Drafts are user-scoped: a user can only see and manage their own drafts.
 */
export class DraftService {
  public constructor(private readonly db: Knex) {}

  /**
   * List saved drafts for the calling user.
   * Optionally filter by content type slug.
   */
  public async listDrafts(
    userId: string,
    contentTypeSlug?: string | null
  ): Promise<Record<string, unknown>[]> {
    let query = this.db('saved_drafts as sd')
      .join('content_types as ct', 'sd.content_type_id', 'ct.id')
      .where('sd.created_by', userId)
      .whereNull('sd.deleted_at')
      .select(
        'sd.id',
        'sd.content_type_id',
        'sd.entity_id',
        'sd.draft_key',
        'sd.created_at',
        'sd.updated_at',
        'ct.slug as content_type_slug',
        'ct.name as content_type_name'
      );

    if (contentTypeSlug) {
      query = query.where('ct.slug', contentTypeSlug);
    }

    return query.orderBy('sd.updated_at', 'desc');
  }

  /**
   * Get a single draft by ID including its full payload.
   * Enforces ownership: only the draft's creator can access it.
   */
  public async getDraft(
    id: string,
    userId: string
  ): Promise<Record<string, unknown>> {
    const draft = await this.db('saved_drafts as sd')
      .join('content_types as ct', 'sd.content_type_id', 'ct.id')
      .where('sd.id', id)
      .whereNull('sd.deleted_at')
      .select(
        'sd.*',
        'ct.slug as content_type_slug',
        'ct.name as content_type_name'
      )
      .first();

    if (!draft) {
      throw notFound('Draft not found');
    }

    if (String(draft.created_by) !== userId) {
      throw forbidden('You do not have access to this draft');
    }

    return draft;
  }

  /**
   * Restore a draft: returns its payload for the client to pre-populate a form.
   * Enforces ownership.
   */
  public async restoreDraft(
    id: string,
    userId: string
  ): Promise<{ payload: Record<string, unknown>; meta: Record<string, unknown> }> {
    const draft = await this.getDraft(id, userId);

    return {
      payload: draft.payload as Record<string, unknown>,
      meta: {
        id: draft.id,
        contentTypeSlug: draft.content_type_slug,
        entityId: draft.entity_id,
        draftKey: draft.draft_key,
        savedAt: draft.updated_at
      }
    };
  }

  /**
   * Soft-delete a saved draft. Only the owner can delete their draft.
   */
  public async deleteDraft(id: string, context: RequestAuditContext): Promise<void> {
    const draft = await this.db('saved_drafts').where({ id }).whereNull('deleted_at').first();

    if (!draft) {
      throw notFound('Draft not found');
    }

    if (String(draft.created_by) !== context.actorId) {
      throw forbidden('You do not have permission to delete this draft');
    }

    await this.db('saved_drafts').where({ id }).update({
      deleted_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    });
  }
}
