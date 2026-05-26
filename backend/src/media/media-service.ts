import type { Knex } from 'knex';
import { badRequest, notFound } from '../http/api-error.js';

// ---------------------------------------------------------------------------
// Allowed MIME types
// ---------------------------------------------------------------------------

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]);

const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);

const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const ALL_ALLOWED_MIMES = new Set([
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_VIDEO_MIMES,
  ...ALLOWED_DOCUMENT_MIMES
]);

/** 50 MB in bytes */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestAuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateMediaInput {
  /** ID of the content type this media belongs to (nullable for standalone/library media) */
  contentTypeId?: string | null;
  /** ID of the entity this media belongs to (nullable for standalone/library media) */
  entityId?: string | null;
  /** 'image' | 'video' | 'document' | 'audio' */
  mediaType: string;
  /** Optional sub-category label, e.g. 'gallery', 'cover', 'attachment' */
  mediaCategory?: string | null;
  /** CDN-ready or storage URL of the media asset */
  mediaUrl: string;
  /** Pre-generated thumbnail URL, if available */
  thumbnailUrl?: string | null;
  /** Accessibility alt text (required for images) */
  altText?: string | null;
  /** Optional caption */
  caption?: string | null;
  /** MIME type sent by the client / detected server-side */
  mimeType: string;
  /** File size in bytes */
  fileSize?: number | null;
  /** Width in pixels (images/video) */
  width?: number | null;
  /** Height in pixels (images/video) */
  height?: number | null;
  /** Duration in seconds (video/audio) */
  duration?: number | null;
  /** Display order within the entity's media list */
  displayOrder?: number;
  /** Whether this is the featured/hero media for the entity */
  isFeatured?: boolean;
}

export interface UpdateMediaInput {
  id: string;
  altText?: string | null;
  caption?: string | null;
  thumbnailUrl?: string | null;
  displayOrder?: number;
  isFeatured?: boolean;
}

export interface ListMediaFilter {
  contentTypeId?: string | null;
  entityId?: string | null;
  mediaType?: string | null;
  isFeatured?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MediaService {
  public constructor(private readonly db: Knex) {}

  /** Create a new media record after validating MIME type, file size, and alt text rules. */
  public async createMedia(
    input: CreateMediaInput,
    context: RequestAuditContext
  ): Promise<Record<string, unknown>> {
    // --- MIME validation ---
    if (!ALL_ALLOWED_MIMES.has(input.mimeType)) {
      throw badRequest(
        `MIME type '${input.mimeType}' is not allowed. Accepted types: ${[...ALL_ALLOWED_MIMES].join(', ')}`
      );
    }

    // --- File size validation ---
    if (input.fileSize != null && input.fileSize > MAX_FILE_SIZE_BYTES) {
      throw badRequest(
        `File size ${input.fileSize} bytes exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes (50 MB)`
      );
    }

    // --- Alt text requirement for images ---
    if (ALLOWED_IMAGE_MIMES.has(input.mimeType) && !input.altText?.trim()) {
      throw badRequest('Alt text is required for image media to meet accessibility standards');
    }

    const [created] = await this.db('media')
      .insert({
        content_type_id: input.contentTypeId ?? null,
        entity_id: input.entityId ?? null,
        media_type: input.mediaType,
        media_category: input.mediaCategory ?? null,
        media_url: input.mediaUrl,
        thumbnail_url: input.thumbnailUrl ?? null,
        alt_text: input.altText ?? null,
        caption: input.caption ?? null,
        mime_type: input.mimeType,
        file_size: input.fileSize ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        duration: input.duration ?? null,
        display_order: input.displayOrder ?? 1,
        is_featured: input.isFeatured ?? false,
        uploaded_by: context.actorId,
        created_by: context.actorId,
        updated_by: context.actorId
      })
      .returning('*');

    return created;
  }

  /** List media records, optionally filtered by entity, type, or featured flag. */
  public async listMedia(filter: ListMediaFilter): Promise<Record<string, unknown>[]> {
    let query = this.db('media').whereNull('deleted_at');

    if (filter.contentTypeId) {
      query = query.where('content_type_id', filter.contentTypeId);
    }

    if (filter.entityId) {
      query = query.where('entity_id', filter.entityId);
    }

    if (filter.mediaType) {
      query = query.where('media_type', filter.mediaType);
    }

    if (filter.isFeatured !== undefined) {
      query = query.where('is_featured', filter.isFeatured);
    }

    return query.orderBy([
      { column: 'is_featured', order: 'desc' },
      { column: 'display_order', order: 'asc' },
      { column: 'created_at', order: 'desc' }
    ]);
  }

  /** Get a single media record by ID. */
  public async getMedia(id: string): Promise<Record<string, unknown>> {
    const media = await this.db('media').where({ id }).whereNull('deleted_at').first();
    if (!media) {
      throw notFound('Media record not found');
    }
    return media;
  }

  /**
   * Update mutable fields on a media record.
   * If `isFeatured` is set to true, all other media records for the same entity are
   * demoted to non-featured (only one featured per entity).
   */
  public async updateMedia(
    input: UpdateMediaInput,
    context: RequestAuditContext
  ): Promise<Record<string, unknown>> {
    const existing = await this.db('media').where({ id: input.id }).whereNull('deleted_at').first();
    if (!existing) {
      throw notFound('Media record not found');
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    };

    if (input.altText !== undefined) updatePayload.alt_text = input.altText;
    if (input.caption !== undefined) updatePayload.caption = input.caption;
    if (input.thumbnailUrl !== undefined) updatePayload.thumbnail_url = input.thumbnailUrl;
    if (input.displayOrder !== undefined) updatePayload.display_order = input.displayOrder;
    if (input.isFeatured !== undefined) updatePayload.is_featured = input.isFeatured;

    return this.db.transaction(async (trx) => {
      // Demote other featured media for the same entity when promoting this one
      if (input.isFeatured === true && existing.entity_id && existing.content_type_id) {
        await trx('media')
          .where({
            content_type_id: existing.content_type_id,
            entity_id: existing.entity_id,
            is_featured: true
          })
          .whereNot({ id: input.id })
          .whereNull('deleted_at')
          .update({
            is_featured: false,
            updated_at: trx.fn.now(),
            updated_by: context.actorId
          });
      }

      const [updated] = await trx('media').where({ id: input.id }).update(updatePayload).returning('*');
      return updated;
    });
  }

  /** Soft-delete a media record. */
  public async archiveMedia(id: string, context: RequestAuditContext): Promise<void> {
    const existing = await this.db('media').where({ id }).whereNull('deleted_at').first();
    if (!existing) {
      throw notFound('Media record not found');
    }

    await this.db('media').where({ id }).update({
      deleted_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
      updated_by: context.actorId
    });
  }
}
