import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { badRequest, conflict, notFound } from '../http/api-error.js';

interface CategoryBody {
  name: string;
  slug: string;
  description?: string | null;
  content_type_id?: string | null;
  is_active?: boolean;
}

interface TagBody {
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean;
}

interface ContentTypeBody {
  name: string;
  description?: string | null;
  is_active?: boolean;
  slug?: string;
  table_name?: string;
}

export async function adminTaxonomiesRoutes(app: FastifyInstance): Promise<void> {
  const guard = requirePermission('MANAGE_ROLES');

  // ==========================================
  // CATEGORY ENDPOINTS
  // ==========================================

  // List categories
  app.get<{ Querystring: { search?: string; content_type_id?: string } }>('/api/v1/admin/categories', { preHandler: [guard] }, async (request) => {
    const { search, content_type_id } = request.query;

    let query = app.db('categories').whereNull('deleted_at');

    if (search) {
      query = query.where((builder) => {
        builder.whereILike('name', `%${search}%`).orWhereILike('slug', `%${search}%`);
      });
    }

    if (content_type_id) {
      query = query.where({ content_type_id });
    }

    const categories = await query.orderBy('name', 'asc');
    return { categories };
  });

  // Create category
  app.post<{ Body: CategoryBody }>('/api/v1/admin/categories', { preHandler: [guard] }, async (request) => {
    const data = request.body;

    if (!data.name || !data.slug) {
      throw badRequest('Name and slug are required');
    }

    const existingSlug = await app.db('categories').where({ slug: data.slug }).whereNull('deleted_at').first();
    if (existingSlug) {
      throw conflict('A category with this slug already exists');
    }

    if (data.content_type_id) {
      const ctExists = await app.db('content_types').where({ id: data.content_type_id }).whereNull('deleted_at').first();
      if (!ctExists) {
        throw badRequest('Invalid content type ID');
      }
    }

    const [createdCat] = await app.db('categories')
      .insert({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        content_type_id: data.content_type_id || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_at: app.db.fn.now(),
        updated_at: app.db.fn.now()
      })
      .returning('*');

    return createdCat;
  });

  // Update category
  app.put<{ Params: { id: string }; Body: CategoryBody }>('/api/v1/admin/categories/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const data = request.body;

    const cat = await app.db('categories').where({ id }).whereNull('deleted_at').first();
    if (!cat) {
      throw notFound('Category not found');
    }

    if (data.slug && data.slug !== cat.slug) {
      const existingSlug = await app.db('categories').where({ slug: data.slug }).whereNull('deleted_at').first();
      if (existingSlug) {
        throw conflict('A category with this slug already exists');
      }
    }

    if (data.content_type_id) {
      const ctExists = await app.db('content_types').where({ id: data.content_type_id }).whereNull('deleted_at').first();
      if (!ctExists) {
        throw badRequest('Invalid content type ID');
      }
    }

    const updatePayload = {
      name: data.name || cat.name,
      slug: data.slug || cat.slug,
      description: data.description === undefined ? cat.description : data.description,
      content_type_id: data.content_type_id === undefined ? cat.content_type_id : data.content_type_id,
      is_active: data.is_active !== undefined ? data.is_active : cat.is_active,
      updated_at: app.db.fn.now()
    };

    await app.db('categories').where({ id }).update(updatePayload);

    const updated = await app.db('categories').where({ id }).first();
    return updated;
  });

  // Soft Delete category
  app.delete<{ Params: { id: string } }>('/api/v1/admin/categories/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;

    const cat = await app.db('categories').where({ id }).whereNull('deleted_at').first();
    if (!cat) {
      throw notFound('Category not found');
    }

    await app.db('categories').where({ id }).update({
      deleted_at: app.db.fn.now(),
      is_active: false,
      updated_at: app.db.fn.now()
    });

    return { success: true };
  });

  // ==========================================
  // TAG ENDPOINTS
  // ==========================================

  // List tags
  app.get<{ Querystring: { search?: string } }>('/api/v1/admin/tags', { preHandler: [guard] }, async (request) => {
    const { search } = request.query;

    let query = app.db('tags').whereNull('deleted_at');

    if (search) {
      query = query.where((builder) => {
        builder.whereILike('name', `%${search}%`).orWhereILike('slug', `%${search}%`);
      });
    }

    const tags = await query.orderBy('name', 'asc');
    return { tags };
  });

  // Create tag
  app.post<{ Body: TagBody }>('/api/v1/admin/tags', { preHandler: [guard] }, async (request) => {
    const data = request.body;

    if (!data.name || !data.slug) {
      throw badRequest('Name and slug are required');
    }

    const existingSlug = await app.db('tags').where({ slug: data.slug }).whereNull('deleted_at').first();
    if (existingSlug) {
      throw conflict('A tag with this slug already exists');
    }

    const existingName = await app.db('tags').where({ name: data.name }).whereNull('deleted_at').first();
    if (existingName) {
      throw conflict('A tag with this name already exists');
    }

    const [createdTag] = await app.db('tags')
      .insert({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_at: app.db.fn.now(),
        updated_at: app.db.fn.now()
      })
      .returning('*');

    return createdTag;
  });

  // Update tag
  app.put<{ Params: { id: string }; Body: TagBody }>('/api/v1/admin/tags/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const data = request.body;

    const tag = await app.db('tags').where({ id }).whereNull('deleted_at').first();
    if (!tag) {
      throw notFound('Tag not found');
    }

    if (data.slug && data.slug !== tag.slug) {
      const existingSlug = await app.db('tags').where({ slug: data.slug }).whereNull('deleted_at').first();
      if (existingSlug) {
        throw conflict('A tag with this slug already exists');
      }
    }

    if (data.name && data.name !== tag.name) {
      const existingName = await app.db('tags').where({ name: data.name }).whereNull('deleted_at').first();
      if (existingName) {
        throw conflict('A tag with this name already exists');
      }
    }

    const updatePayload = {
      name: data.name || tag.name,
      slug: data.slug || tag.slug,
      description: data.description === undefined ? tag.description : data.description,
      is_active: data.is_active !== undefined ? data.is_active : tag.is_active,
      updated_at: app.db.fn.now()
    };

    await app.db('tags').where({ id }).update(updatePayload);

    const updated = await app.db('tags').where({ id }).first();
    return updated;
  });

  // Soft Delete tag
  app.delete<{ Params: { id: string } }>('/api/v1/admin/tags/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;

    const tag = await app.db('tags').where({ id }).whereNull('deleted_at').first();
    if (!tag) {
      throw notFound('Tag not found');
    }

    await app.db('tags').where({ id }).update({
      deleted_at: app.db.fn.now(),
      is_active: false,
      updated_at: app.db.fn.now()
    });

    return { success: true };
  });

  // ==========================================
  // CONTENT TYPE ENDPOINTS
  // ==========================================

  // List content types
  app.get('/api/v1/admin/content-types', { preHandler: [guard] }, async () => {
    const contentTypes = await app.db('content_types').whereNull('deleted_at').orderBy('name', 'asc');
    return { contentTypes };
  });

  // Get single content type
  app.get<{ Params: { id: string } }>('/api/v1/admin/content-types/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;

    const contentType = await app.db('content_types').where({ id }).whereNull('deleted_at').first();
    if (!contentType) {
      throw notFound('Content type not found');
    }

    return contentType;
  });

  // Update content type (locking system critical fields)
  app.put<{ Params: { id: string }; Body: ContentTypeBody }>('/api/v1/admin/content-types/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const data = request.body;

    const contentType = await app.db('content_types').where({ id }).whereNull('deleted_at').first();
    if (!contentType) {
      throw notFound('Content type not found');
    }

    if (data.name && data.name.length > 100) {
      throw badRequest('Content type display name must be 100 characters or fewer');
    }

    // Lock structural system-critical mutations on critical fields
    if (data.slug && data.slug !== contentType.slug) {
      throw badRequest("Edits to system-critical field 'slug' are blocked to maintain polymorphic system integrity");
    }

    if (data.table_name && data.table_name !== contentType.table_name) {
      throw badRequest("Edits to system-critical field 'table_name' are blocked to maintain polymorphic system integrity");
    }

    const updatePayload = {
      name: data.name || contentType.name,
      description: data.description === undefined ? contentType.description : data.description,
      is_active: data.is_active !== undefined ? data.is_active : contentType.is_active,
      updated_at: app.db.fn.now()
    };

    await app.db('content_types').where({ id }).update(updatePayload);

    const updated = await app.db('content_types').where({ id }).first();
    return updated;
  });
}
