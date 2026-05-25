import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Knex } from 'knex';
import { requirePermission } from '../auth/authorization.js';
import { badRequest, conflict, notFound } from '../http/api-error.js';

interface OrgQueryParams {
  search?: string;
  is_active?: string;
  org_type?: string;
}

interface CreateOrgBody {
  name: string;
  org_type: string;
  parent_id?: string | null;
  slug: string;
  short_name?: string | null;
  code?: string | null;
  description?: string | null;
  logo_url?: string | null;
  banner_image?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  address?: string | null;
  is_active?: boolean;
}

interface OrgTreeNode {
  id: string;
  name: string;
  org_type: string;
  slug: string;
  is_active: boolean;
  parent_id: string | null;
  children: OrgTreeNode[];
}

async function wouldCreateCycle(db: Knex, orgId: string, parentId: string): Promise<boolean> {
  if (!parentId) return false;
  if (orgId === parentId) return true;

  // Recursively fetch all descendants of orgId.
  // If parentId is one of these descendants, a cycle will be created!
  const descendantsResult = await db.raw(`
    WITH RECURSIVE descendants AS (
      SELECT id, parent_id FROM organizations WHERE id = ? AND deleted_at IS NULL
      UNION ALL
      SELECT o.id, o.parent_id FROM organizations o
      INNER JOIN descendants d ON o.parent_id = d.id
      WHERE o.deleted_at IS NULL
    )
    SELECT id FROM descendants WHERE id = ?
  `, [orgId, parentId]);

  return descendantsResult.rows && descendantsResult.rows.length > 0;
}

export async function adminOrganizationsRoutes(app: FastifyInstance): Promise<void> {
  const guard = requirePermission('MANAGE_USERS');

  // List Organizations (flat list)
  app.get<{ Querystring: OrgQueryParams }>('/api/v1/admin/organizations', { preHandler: [guard] }, async (request) => {
    const { search, is_active, org_type } = request.query;

    let query = app.db('organizations').whereNull('deleted_at');

    if (search) {
      query = query.where((builder) => {
        builder.whereILike('name', `%${search}%`)
          .orWhereILike('slug', `%${search}%`)
          .orWhereILike('short_name', `%${search}%`)
          .orWhereILike('code', `%${search}%`);
      });
    }

    if (is_active !== undefined) {
      query = query.where({ is_active: is_active === 'true' });
    }

    if (org_type) {
      query = query.where({ org_type });
    }

    const organizations = await query.orderBy('name', 'asc');
    return { organizations };
  });

  // Get Organization Tree Hierarchy
  app.get('/api/v1/admin/organizations/tree', { preHandler: [guard] }, async () => {
    const organizations = await app.db('organizations')
      .select('id', 'name', 'org_type', 'slug', 'is_active', 'parent_id')
      .whereNull('deleted_at')
      .orderBy('name', 'asc');

    // Build the tree in memory
    const orgMap = new Map<string, OrgTreeNode>();
    const roots: OrgTreeNode[] = [];

    // Initialize all node entries in map
    for (const org of organizations) {
      orgMap.set(String(org.id), {
        id: String(org.id),
        name: String(org.name),
        org_type: String(org.org_type),
        slug: String(org.slug),
        is_active: Boolean(org.is_active),
        parent_id: org.parent_id ? String(org.parent_id) : null,
        children: []
      });
    }

    // Assign children to parents or place in roots
    for (const org of organizations) {
      const node = orgMap.get(String(org.id))!;
      if (org.parent_id) {
        const parentNode = orgMap.get(String(org.parent_id));
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // If parent is deleted or inactive and excluded, treat as root for visibility
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return { tree: roots };
  });

  // Get Organization Details
  app.get<{ Params: { id: string } }>('/api/v1/admin/organizations/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;

    const org = await app.db('organizations').where({ id }).whereNull('deleted_at').first();
    if (!org) {
      throw notFound('Organization not found');
    }

    return org;
  });

  // Create Organization
  app.post<{ Body: CreateOrgBody }>('/api/v1/admin/organizations', { preHandler: [guard] }, async (request) => {
    const data = request.body;

    if (!data.name || !data.org_type || !data.slug) {
      throw badRequest('Name, organization type, and slug are required');
    }

    // Check slug uniqueness
    const existingSlug = await app.db('organizations').where({ slug: data.slug }).whereNull('deleted_at').first();
    if (existingSlug) {
      throw conflict('An organization with this slug already exists');
    }

    // Validate parent exists and is active
    if (data.parent_id) {
      const parent = await app.db('organizations').where({ id: data.parent_id }).whereNull('deleted_at').first();
      if (!parent) {
        throw badRequest('Parent organization does not exist');
      }
      if (!parent.is_active) {
        throw badRequest('Parent organization is inactive');
      }
    }

    const [createdOrg] = await app.db('organizations')
      .insert({
        name: data.name,
        org_type: data.org_type,
        parent_id: data.parent_id || null,
        slug: data.slug,
        short_name: data.short_name || null,
        code: data.code || null,
        description: data.description || null,
        logo_url: data.logo_url || null,
        banner_image: data.banner_image || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        website_url: data.website_url || null,
        address: data.address || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_at: app.db.fn.now(),
        updated_at: app.db.fn.now()
      })
      .returning('*');

    return createdOrg;
  });

  // Update Organization
  app.put<{ Params: { id: string }; Body: CreateOrgBody }>('/api/v1/admin/organizations/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const data = request.body;

    const org = await app.db('organizations').where({ id }).whereNull('deleted_at').first();
    if (!org) {
      throw notFound('Organization not found');
    }

    // Validate slug uniqueness if changed
    if (data.slug && data.slug !== org.slug) {
      const existingSlug = await app.db('organizations').where({ slug: data.slug }).whereNull('deleted_at').first();
      if (existingSlug) {
        throw conflict('An organization with this slug already exists');
      }
    }

    // Validate parent if provided
    if (data.parent_id) {
      const parent = await app.db('organizations').where({ id: data.parent_id }).whereNull('deleted_at').first();
      if (!parent) {
        throw badRequest('Parent organization does not exist');
      }
      if (!parent.is_active) {
        throw badRequest('Parent organization is inactive');
      }

      // Cyclic Check
      const isCyclic = await wouldCreateCycle(app.db, id, data.parent_id);
      if (isCyclic) {
        throw badRequest('Proposed parent organization would create a cyclic hierarchy');
      }
    }

    const updatePayload = {
      name: data.name || org.name,
      org_type: data.org_type || org.org_type,
      parent_id: data.parent_id === undefined ? org.parent_id : data.parent_id,
      slug: data.slug || org.slug,
      short_name: data.short_name === undefined ? org.short_name : data.short_name,
      code: data.code === undefined ? org.code : data.code,
      description: data.description === undefined ? org.description : data.description,
      logo_url: data.logo_url === undefined ? org.logo_url : data.logo_url,
      banner_image: data.banner_image === undefined ? org.banner_image : data.banner_image,
      contact_email: data.contact_email === undefined ? org.contact_email : data.contact_email,
      contact_phone: data.contact_phone === undefined ? org.contact_phone : data.contact_phone,
      website_url: data.website_url === undefined ? org.website_url : data.website_url,
      address: data.address === undefined ? org.address : data.address,
      is_active: data.is_active !== undefined ? data.is_active : org.is_active,
      updated_at: app.db.fn.now()
    };

    await app.db('organizations').where({ id }).update(updatePayload);

    const updated = await app.db('organizations').where({ id }).first();
    return updated;
  });

  // Toggle active status
  app.patch<{ Params: { id: string }; Body: { is_active: boolean } }>('/api/v1/admin/organizations/:id/status', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const { is_active } = request.body;

    if (is_active === undefined) {
      throw badRequest('is_active value is required');
    }

    const org = await app.db('organizations').where({ id }).whereNull('deleted_at').first();
    if (!org) {
      throw notFound('Organization not found');
    }

    await app.db('organizations').where({ id }).update({
      is_active,
      updated_at: app.db.fn.now()
    });

    const updated = await app.db('organizations').select('id', 'is_active').where({ id }).first();
    return updated;
  });

  // Soft Delete Organization
  app.delete<{ Params: { id: string } }>('/api/v1/admin/organizations/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;

    const org = await app.db('organizations').where({ id }).whereNull('deleted_at').first();
    if (!org) {
      throw notFound('Organization not found');
    }

    // Check if active children exist
    const activeChildren = await app.db('organizations')
      .where({ parent_id: id, is_active: true })
      .whereNull('deleted_at')
      .count<{ count: string | number }>('id as count')
      .first();

    const count = parseInt(String(activeChildren?.count ?? '0'), 10);
    if (count > 0) {
      throw conflict('Cannot delete organization with active child organizations');
    }

    await app.db('organizations').where({ id }).update({
      deleted_at: app.db.fn.now(),
      is_active: false,
      updated_at: app.db.fn.now()
    });

    return { success: true };
  });
}
