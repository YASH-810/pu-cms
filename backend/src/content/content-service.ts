import type { Knex } from 'knex';
import { badRequest, conflict, notFound } from '../http/api-error.js';

export type ContentStatus = 'draft' | 'review' | 'published' | 'archived' | 'rejected';

interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ContentTypeRow {
  id: string;
  slug: string;
  table_name: string;
}

interface CreateEntityInput {
  contentTypeSlug: string;
  title: string;
  slug: string;
  payload?: Record<string, unknown>;
  organizationIds?: string[];
}

interface UpdateEntityInput {
  contentTypeSlug: string;
  entityId: string;
  title?: string;
  slug?: string;
  payload?: Record<string, unknown>;
}

interface TransitionStatusInput {
  contentTypeSlug: string;
  entityId: string;
  status: ContentStatus;
  remarks?: string;
}

interface AutosaveDraftInput {
  contentTypeSlug: string;
  entityId?: string | null;
  draftKey?: string | null;
  payload: Record<string, unknown>;
}

const allowedTransitions: Record<ContentStatus, ContentStatus[]> = {
  draft: ['review'],
  review: ['published', 'rejected'],
  published: ['archived'],
  archived: [],
  rejected: ['draft']
};

export class ContentService {
  public constructor(private readonly db: Knex) {}

  public async createEntity(input: CreateEntityInput, context: RequestAuditContext): Promise<Record<string, unknown>> {
    if (!input.title?.trim() || !input.slug?.trim()) {
      throw badRequest('Title and slug are required');
    }

    const contentType = await this.resolveContentType(input.contentTypeSlug);

    return this.db.transaction(async (trx) => {
      const [created] = await trx('content_entities')
        .insert({
          content_type_id: contentType.id,
          title: input.title.trim(),
          slug: input.slug.trim(),
          status: 'draft',
          payload: input.payload ?? {},
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .returning('*');

      await trx('entity_owners')
        .insert({
          content_type_id: contentType.id,
          entity_id: created.id,
          user_id: context.actorId,
          ownership_type: 'creator',
          created_by: context.actorId,
          updated_by: context.actorId
        })
        .onConflict(['content_type_id', 'entity_id', 'user_id', 'ownership_type'])
        .ignore();

      if (input.organizationIds?.length) {
        await trx('entity_organizations')
          .insert(
            input.organizationIds.map((organizationId) => ({
              content_type_id: contentType.id,
              entity_id: created.id,
              organization_id: organizationId,
              relation_type: 'primary',
              created_by: context.actorId,
              updated_by: context.actorId
            }))
          )
          .onConflict(['content_type_id', 'entity_id', 'organization_id', 'relation_type'])
          .ignore();
      }

      await this.writeAuditLog(trx, contentType.id, created.id, 'create', {}, created, context);
      return created;
    });
  }

  public async updateEntity(input: UpdateEntityInput, context: RequestAuditContext): Promise<Record<string, unknown>> {
    const contentType = await this.resolveContentType(input.contentTypeSlug);

    return this.db.transaction(async (trx) => {
      const existing = await trx('content_entities')
        .where({
          id: input.entityId,
          content_type_id: contentType.id
        })
        .whereNull('deleted_at')
        .first();

      if (!existing) {
        throw notFound('Content entity not found');
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: trx.fn.now(),
        updated_by: context.actorId
      };

      if (input.title !== undefined) updatePayload.title = input.title;
      if (input.slug !== undefined) updatePayload.slug = input.slug;
      if (input.payload !== undefined) updatePayload.payload = input.payload;

      const [updated] = await trx('content_entities')
        .where({ id: input.entityId })
        .update(updatePayload)
        .returning('*');

      await this.writeAuditLog(trx, contentType.id, input.entityId, 'update', existing, updated, context);
      return updated;
    });
  }

  public async transitionStatus(input: TransitionStatusInput, context: RequestAuditContext): Promise<Record<string, unknown>> {
    const contentType = await this.resolveContentType(input.contentTypeSlug);

    return this.db.transaction(async (trx) => {
      const existing = await trx('content_entities')
        .where({
          id: input.entityId,
          content_type_id: contentType.id
        })
        .whereNull('deleted_at')
        .first();

      if (!existing) {
        throw notFound('Content entity not found');
      }

      const currentStatus = String(existing.status) as ContentStatus;
      const nextStatus = input.status;

      if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
        throw conflict(`Illegal status transition from ${currentStatus} to ${nextStatus}`);
      }

      const [updated] = await trx('content_entities')
        .where({ id: input.entityId })
        .update({
          status: nextStatus,
          updated_at: trx.fn.now(),
          updated_by: context.actorId
        })
        .returning('*');

      await trx('entity_approval_logs').insert({
        content_type_id: contentType.id,
        entity_id: input.entityId,
        status_from: currentStatus,
        status_to: nextStatus,
        remarks: input.remarks ?? null,
        created_by: context.actorId
      });

      await this.writeAuditLog(trx, contentType.id, input.entityId, 'status_change', existing, updated, context);
      return updated;
    });
  }

  public async autosaveDraft(input: AutosaveDraftInput, context: RequestAuditContext): Promise<Record<string, unknown>> {
    const contentType = await this.resolveContentType(input.contentTypeSlug);
    const draftKey = input.draftKey ?? null;
    const entityId = input.entityId ?? null;

    const existing = await this.db('saved_drafts')
      .where({
        content_type_id: contentType.id,
        entity_id: entityId,
        draft_key: draftKey,
        created_by: context.actorId
      })
      .whereNull('deleted_at')
      .first();

    if (existing) {
      const [updated] = await this.db('saved_drafts')
        .where({ id: existing.id })
        .update({
          payload: input.payload,
          updated_at: this.db.fn.now(),
          updated_by: context.actorId
        })
        .returning('*');

      return updated;
    }

    const [created] = await this.db('saved_drafts')
      .insert({
        content_type_id: contentType.id,
        entity_id: entityId,
        draft_key: draftKey,
        payload: input.payload,
        created_by: context.actorId,
        updated_by: context.actorId
      })
      .returning('*');

    return created;
  }

  private async resolveContentType(slug: string): Promise<ContentTypeRow> {
    const contentType = await this.db('content_types')
      .select('id', 'slug', 'table_name')
      .where({ slug, is_active: true })
      .whereNull('deleted_at')
      .first();

    if (!contentType) {
      throw notFound('Content type not found');
    }

    return contentType;
  }

  private async writeAuditLog(
    trx: Knex.Transaction,
    contentTypeId: string,
    entityId: string,
    action: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    context: RequestAuditContext
  ): Promise<void> {
    await trx('entity_audit_logs').insert({
      content_type_id: contentTypeId,
      entity_id: entityId,
      action,
      performed_by: context.actorId,
      old_value: oldValue,
      new_value: newValue,
      ip_address: context.ipAddress ?? null,
      user_agent: context.userAgent ?? null,
      created_by: context.actorId
    });
  }
}
