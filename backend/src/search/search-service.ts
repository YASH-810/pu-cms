import type { Knex } from 'knex';

export interface SearchResult {
  entity_id: string;
  title: string;
  status: string;
  content_type_slug: string;
  updated_at: Date;
  rank?: number;
}

export interface SearchFilter {
  query: string;
  contentTypeSlug?: string;
  organizationId?: string;
  categoryId?: string;
  tagId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date';
}

export class SearchService {
  public constructor(private readonly db: Knex) {}

  // -------------------------------------------------------------------------
  // Indexing Logic
  // -------------------------------------------------------------------------
  public async indexEntity(entityId: string): Promise<void> {
    const entity = await this.db('content_entities').where({ id: entityId }).first();
    if (!entity) {
      // Entity was hard deleted: delete index record
      await this.db('search_index').where({ entity_id: entityId }).del();
      return;
    }

    const contentType = await this.db('content_types').where({ id: entity.content_type_id }).first();
    if (!contentType) return;

    // Check soft delete status
    const isSoftDeleted = entity.deleted_at !== null;
    const isActive = entity.status === 'published' && !isSoftDeleted;

    // Fetch mappings
    const orgs = await this.db('entity_organizations')
      .where({ entity_id: entityId })
      .whereNull('deleted_at')
      .select('organization_id');
    const organizationIds = orgs.map(o => String(o.organization_id));

    const cats = await this.db('entity_categories')
      .where({ entity_id: entityId })
      .whereNull('deleted_at')
      .select('category_id');
    const categoryIds = cats.map(c => String(c.category_id));

    const tags = await this.db('entity_tags')
      .where({ entity_id: entityId })
      .whereNull('deleted_at')
      .select('tag_id');
    const tagIds = tags.map(t => String(t.tag_id));

    // Fetch content-type specific text body
    let rawBody = '';

    try {
      const typeTable = contentType.table_name;
      const specificRow = await this.db(typeTable).where({ entity_id: entityId }).first();

      if (specificRow) {
        if (contentType.slug === 'page' || contentType.slug === 'blog') {
          rawBody = `${specificRow.summary || ''} ${specificRow.body_html || ''}`;
        } else if (contentType.slug === 'event') {
          rawBody = `${specificRow.venue || ''} ${specificRow.organizer || ''} ${specificRow.event_type || ''}`;
        } else if (contentType.slug === 'announcement') {
          rawBody = `${specificRow.summary || ''} ${specificRow.body_html || ''}`;
        } else if (contentType.slug === 'achievement') {
          rawBody = `${specificRow.achievement_type || ''} ${specificRow.level || ''} ${specificRow.awarded_by || ''}`;
        } else if (contentType.slug === 'story') {
          rawBody = `${specificRow.story_type || ''} ${specificRow.person_name || ''} ${specificRow.person_role || ''} ${specificRow.company || ''}`;
        } else if (contentType.slug === 'club') {
          rawBody = `${specificRow.meeting_schedule || ''} ${specificRow.joining_process || ''}`;
        }
      }
    } catch (err) {
      console.warn(`Could not index specific table fields for entity ${entityId}:`, err);
    }

    // Strip HTML tags and normalize whitespace
    const cleanBody = rawBody
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Prepare upsert fields
    const indexData = {
      content_type_id: entity.content_type_id,
      entity_id: entityId,
      title: entity.title,
      body: cleanBody,
      organization_ids: organizationIds,
      category_ids: categoryIds,
      tag_ids: tagIds,
      is_active: isActive,
      status: entity.status,
      updated_at: this.db.fn.now()
    };

    // Upsert search_index row
    const existing = await this.db('search_index').where({ entity_id: entityId }).first();

    if (existing) {
      await this.db('search_index')
        .where({ entity_id: entityId })
        .update({
          ...indexData,
          tsv: this.db.raw("to_tsvector('english', coalesce(?, '') || ' ' || coalesce(?, ''))", [entity.title, cleanBody])
        });
    } else {
      await this.db('search_index').insert({
        ...indexData,
        tsv: this.db.raw("to_tsvector('english', coalesce(?, '') || ' ' || coalesce(?, ''))", [entity.title, cleanBody])
      });
    }
  }

  // -------------------------------------------------------------------------
  // Search Query
  // -------------------------------------------------------------------------
  public async search(
    filter: SearchFilter,
    userId?: string
  ): Promise<{ results: SearchResult[]; total: number }> {
    const queryStr = filter.query?.trim() || '';


    const selectQuery = this.db('search_index as si')
      .join('content_types as ct', 'ct.id', 'si.content_type_id')
      .where({ 'si.is_active': true, 'si.status': 'published' });

    // 1. Keyword search (tsquery)
    let formattedTsQuery = '';
    if (queryStr) {
      // Split query into words and build hybrid stemming & prefix tsquery string (e.g. '(comp | comp:*) & (science | science:*)')
      const words = queryStr.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        formattedTsQuery = words
          .map(w => {
            const clean = w.replace(/['":*&|!]/g, '');
            return clean ? `(${clean} | ${clean}:*)` : '';
          })
          .filter(Boolean)
          .join(' & ');
        if (formattedTsQuery) {
          selectQuery.whereRaw(`si.tsv @@ to_tsquery('english', ?)`, [formattedTsQuery]);
        }
      }
    }

    // 2. Filters
    if (filter.contentTypeSlug) {
      selectQuery.where('ct.slug', filter.contentTypeSlug);
    }
    if (filter.organizationId) {
      selectQuery.whereRaw('? = ANY(si.organization_ids)', [filter.organizationId]);
    }
    if (filter.categoryId) {
      selectQuery.whereRaw('? = ANY(si.category_ids)', [filter.categoryId]);
    }
    if (filter.tagId) {
      selectQuery.whereRaw('? = ANY(si.tag_ids)', [filter.tagId]);
    }

    // 3. Selection columns
    selectQuery.select(
      'si.entity_id',
      'si.title',
      'si.status',
      'ct.slug as content_type_slug',
      'si.updated_at'
    );

    if (formattedTsQuery) {
      selectQuery.select(
        this.db.raw(`ts_rank(si.tsv, to_tsquery('english', ?)) as rank`, [formattedTsQuery])
      );
    }

    // 4. Count query
    const countQuery = selectQuery.clone().clearSelect().clearOrder().count('si.id as total').first();

    // 5. Sorting
    const sortBy = filter.sortBy || 'relevance';
    if (sortBy === 'relevance' && formattedTsQuery) {
      selectQuery.orderBy('rank', 'desc').orderBy('si.updated_at', 'desc');
    } else {
      selectQuery.orderBy('si.updated_at', 'desc');
    }

    // 6. Pagination & execution
    const limit = filter.limit ? Number(filter.limit) : 20;
    const offset = filter.offset ? Number(filter.offset) : 0;

    const [countRow, rows] = await Promise.all([
      countQuery,
      selectQuery.limit(limit).offset(offset)
    ]);

    const total = Number((countRow as { total: string } | undefined)?.total ?? 0);

    // Log query search event
    if (queryStr) {
      await this.db('search_queries').insert({
        query: queryStr,
        results_count: total,
        user_id: userId ?? null
      });
    }

    return {
      results: rows as SearchResult[],
      total
    };
  }
}
