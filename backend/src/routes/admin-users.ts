import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Knex } from 'knex';
import { requirePermission, resolvePermission } from '../auth/authorization.js';
import { badRequest, conflict, notFound, forbidden, unauthenticated } from '../http/api-error.js';

interface QueryParams {
  search?: string;
  is_active?: string;
  limit?: string;
  page?: string;
}

interface CreateUserBody {
  email: string;
  full_name: string;
  profile_image?: string;
  is_active?: boolean;
  global_roles?: string[]; // Role IDs or Names
  role_id?: string;
  organization_id?: string;
}

interface UpdateUserBody {
  full_name: string;
  profile_image?: string;
  is_active?: boolean;
}

interface StatusBody {
  is_active: boolean;
}

interface RolesBody {
  role_ids: string[];
}

interface OrgRoleBody {
  role_id: string;
  is_active?: boolean;
  assigned_from?: string;
  assigned_to?: string;
}

export async function adminUsersRoutes(app: FastifyInstance): Promise<void> {
  async function getUserHierarchyLevel(db: Knex, userId: string): Promise<number> {
    const globalRoles = await db('user_roles as ur')
      .join('roles as r', 'r.id', 'ur.role_id')
      .where('ur.user_id', userId)
      .whereNull('ur.deleted_at')
      .whereNull('r.deleted_at')
      .select('r.hierarchy_level');

    const orgRoles = await db('user_organization_roles as uor')
      .join('roles as r', 'r.id', 'uor.role_id')
      .where({
        'uor.user_id': userId,
        'uor.is_active': true
      })
      .whereNull('uor.deleted_at')
      .whereNull('r.deleted_at')
      .select('r.hierarchy_level');

    const allLevels = [...globalRoles, ...orgRoles].map(r => Number(r.hierarchy_level));
    if (allLevels.length === 0) return 99;
    return Math.min(...allLevels);
  }

  async function getScopedOrgIds(db: Knex, userId: string): Promise<string[]> {
    const userOrgIds = await db('user_organization_roles as uor')
      .where({
        'uor.user_id': userId,
        'uor.is_active': true
      })
      .whereNull('uor.deleted_at')
      .pluck('uor.organization_id');

    if (userOrgIds.length === 0) return [];

    const descendantsResult = await db.raw(`
      WITH RECURSIVE descendants AS (
        SELECT id, parent_id FROM organizations WHERE id IN (${userOrgIds.map(() => '?').join(',')}) AND deleted_at IS NULL
        UNION ALL
        SELECT o.id, o.parent_id FROM organizations o
        INNER JOIN descendants d ON o.parent_id = d.id
        WHERE o.deleted_at IS NULL
      )
      SELECT id FROM descendants
    `, userOrgIds);
    return descendantsResult.rows.map((row: any) => String(row.id));
  }

  const checkUserReadPermission = async (request: FastifyRequest) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }

    const userId = payload.sub;
    const userLevel = await getUserHierarchyLevel(app.db, userId);
    if (userLevel < 99) return;

    throw forbidden('No explicit permission found for requested context');
  };

  async function verifyTargetUserInScope(db: Knex, requestUserId: string, targetUserId: string) {
    const userLevel = await getUserHierarchyLevel(db, requestUserId);
    if (userLevel <= 2) return; // Global admin can access any scope

    const allScopedOrgIds = await getScopedOrgIds(db, requestUserId);
    if (allScopedOrgIds.length === 0) {
      throw forbidden('No explicit permission found for requested context');
    }

    const targetUserInScope = await db('user_organization_roles')
      .where({ user_id: targetUserId })
      .whereIn('organization_id', allScopedOrgIds)
      .whereNull('deleted_at')
      .where({ is_active: true })
      .first('id');

    if (!targetUserInScope) {
      throw forbidden('No explicit permission found for requested context');
    }
  }

  async function verifyHierarchyEditPermission(db: Knex, requestUserId: string, targetUserId: string) {
    const requestUserLevel = await getUserHierarchyLevel(db, requestUserId);
    if (requestUserLevel === 1) return; // Super Admin has all edit rights

    const targetUserLevel = await getUserHierarchyLevel(db, targetUserId);
    if (targetUserLevel < requestUserLevel) {
      throw forbidden('You cannot modify users with roles higher than your own hierarchy level');
    }
  }

  // List Roles
  app.get('/api/v1/admin/roles', { preHandler: [checkUserReadPermission] }, async () => {
    const roles = await app.db('roles')
      .select('id', 'name', 'description', 'hierarchy_level')
      .whereNull('deleted_at')
      .orderBy('hierarchy_level', 'asc');
    return { roles };
  });

  // List Users
  app.get<{ Querystring: QueryParams }>('/api/v1/admin/users', { preHandler: [checkUserReadPermission] }, async (request) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }
    const requestUserId = payload.sub;
    const { search, is_active, limit = '20', page = '1' } = request.query;

    const parsedLimit = Math.max(1, parseInt(limit, 10));
    const parsedPage = Math.max(1, parseInt(page, 10));
    const offset = (parsedPage - 1) * parsedLimit;

    const userLevel = await getUserHierarchyLevel(app.db, requestUserId);
    let query = app.db('users').whereNull('deleted_at');

    if (userLevel > 2) {
      const allScopedOrgIds = await getScopedOrgIds(app.db, requestUserId);
      if (allScopedOrgIds.length === 0) {
        return {
          users: [],
          pagination: {
            total: 0,
            page: parsedPage,
            limit: parsedLimit,
            pages: 0
          }
        };
      }
      query = query.whereIn('id', function() {
        this.select('user_id')
          .from('user_organization_roles')
          .whereIn('organization_id', allScopedOrgIds)
          .whereNull('deleted_at')
          .where({ is_active: true });
      });
    }

    if (search) {
      query = query.where((builder) => {
        builder.whereILike('email', `%${search}%`).orWhereILike('full_name', `%${search}%`);
      });
    }

    if (is_active !== undefined) {
      query = query.where({ is_active: is_active === 'true' });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count<{ count: string | number }>('id as count').first();
    const rowsQuery = query
      .clone()
      .select('id', 'email', 'full_name', 'profile_image', 'is_active', 'last_login_at', 'created_at', 'updated_at')
      .orderBy('full_name', 'asc')
      .limit(parsedLimit)
      .offset(offset);

    const [countResult, users] = await Promise.all([countQuery, rowsQuery]);
    const totalCount = parseInt(String(countResult?.count ?? '0'), 10);

    return {
      users,
      pagination: {
        total: totalCount,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(totalCount / parsedLimit)
      }
    };
  });

  // Get User Details
  app.get<{ Params: { id: string } }>('/api/v1/admin/users/:id', { preHandler: [checkUserReadPermission] }, async (request) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }
    const requestUserId = payload.sub;
    const { id } = request.params;

    await verifyTargetUserInScope(app.db, requestUserId, id);

    const user = await app.db('users')
      .select('id', 'email', 'full_name', 'profile_image', 'is_active', 'last_login_at', 'created_at', 'updated_at')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (!user) {
      throw notFound('User not found');
    }

    const globalRoles = await app.db('user_roles as ur')
      .join('roles as r', 'r.id', 'ur.role_id')
      .select('r.id', 'r.name', 'r.description', 'r.hierarchy_level')
      .where('ur.user_id', id)
      .whereNull('ur.deleted_at')
      .whereNull('r.deleted_at');

    const organizationRoles = await app.db('user_organization_roles as uor')
      .join('organizations as o', 'o.id', 'uor.organization_id')
      .join('roles as r', 'r.id', 'uor.role_id')
      .select(
        'o.id as organization_id',
        'o.name as organization_name',
        'o.slug as organization_slug',
        'r.id as role_id',
        'r.name as role_name',
        'uor.is_active',
        'uor.assigned_from',
        'uor.assigned_to'
      )
      .where('uor.user_id', id)
      .whereNull('uor.deleted_at')
      .whereNull('o.deleted_at')
      .whereNull('r.deleted_at');

    return {
      ...user,
      global_roles: globalRoles,
      organization_roles: organizationRoles
    };
  });

  // Create User
  app.post<{ Body: CreateUserBody }>('/api/v1/admin/users', { preHandler: [checkUserReadPermission] }, async (request) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }
    const requestUserId = payload.sub;
    const { email, full_name, profile_image = null, is_active = true, global_roles = [], role_id, organization_id } = request.body;

    if (!email || !full_name) {
      throw badRequest('Email and full name are required');
    }

    const requestUserLevel = await getUserHierarchyLevel(app.db, requestUserId);

    if (requestUserLevel > 2) {
      const allScopedOrgIds = await getScopedOrgIds(app.db, requestUserId);
      if (!organization_id) {
        throw badRequest('Organization is required');
      }
      if (!allScopedOrgIds.includes(organization_id)) {
        throw forbidden('Target organization is outside your administrative scope');
      }
    }

    // Role assignment hierarchy verification (for both global and scoped roles)
    if (role_id) {
      const role = await app.db('roles').where({ id: role_id }).whereNull('deleted_at').first();
      if (!role || role.hierarchy_level < requestUserLevel) {
        throw forbidden('You cannot assign roles higher than your own hierarchy level');
      }
    }

    if (global_roles.length > 0) {
      const roles = await app.db('roles')
        .select('hierarchy_level')
        .whereIn('id', global_roles)
        .orWhereIn('name', global_roles)
        .whereNull('deleted_at');
      for (const r of roles) {
        if (r.hierarchy_level < requestUserLevel) {
          throw forbidden('You cannot assign roles higher than your own hierarchy level');
        }
      }
    }

    const existingUser = await app.db('users').whereRaw('lower(email) = lower(?)', [email]).first();

    if (existingUser) {
      if (existingUser.deleted_at === null) {
        throw conflict('User with this email already exists');
      } else {
        // Restore soft-deleted user
        await app.db('users').where({ id: existingUser.id }).update({
          full_name,
          profile_image,
          is_active,
          deleted_at: null,
          updated_at: app.db.fn.now()
        });

        // Delete old role assignments to start fresh
        await app.db('user_roles').where({ user_id: existingUser.id }).del();
        await app.db('user_organization_roles').where({ user_id: existingUser.id }).del();

        // Re-assign global roles
        if (global_roles.length > 0) {
          const roles = await app.db('roles').select('id').whereIn('id', global_roles).orWhereIn('name', global_roles).whereNull('deleted_at');
          if (roles.length > 0) {
            await app.db('user_roles').insert(
              roles.map((r) => ({
                user_id: existingUser.id,
                role_id: r.id
              }))
            );
          }
        }

        // Handle single role and organization
        if (role_id) {
          if (organization_id) {
            await app.db('user_organization_roles').insert({
              user_id: existingUser.id,
              organization_id,
              role_id,
              is_active: true,
              created_at: app.db.fn.now(),
              updated_at: app.db.fn.now()
            });
          } else {
            await app.db('user_roles').insert({
              user_id: existingUser.id,
              role_id
            });
          }
        }

        return { id: existingUser.id, email, full_name, is_active };
      }
    }

    const [createdUser] = await app.db('users')
      .insert({
        email,
        full_name,
        profile_image,
        is_active,
        created_at: app.db.fn.now(),
        updated_at: app.db.fn.now()
      })
      .returning(['id', 'email', 'full_name', 'is_active']);

    if (global_roles.length > 0) {
      const roles = await app.db('roles').select('id').whereIn('id', global_roles).orWhereIn('name', global_roles).whereNull('deleted_at');
      if (roles.length > 0) {
        await app.db('user_roles').insert(
          roles.map((r) => ({
            user_id: createdUser.id,
            role_id: r.id
          }))
        );
      }
    }

    if (role_id) {
      if (organization_id) {
        await app.db('user_organization_roles').insert({
          user_id: createdUser.id,
          organization_id,
          role_id,
          is_active: true,
          created_at: app.db.fn.now(),
          updated_at: app.db.fn.now()
        });
      } else {
        await app.db('user_roles').insert({
          user_id: createdUser.id,
          role_id
        });
      }
    }

    return createdUser;
  });

  // Update User
  app.put<{ Params: { id: string }; Body: UpdateUserBody }>('/api/v1/admin/users/:id', { preHandler: [checkUserReadPermission] }, async (request) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }
    const requestUserId = payload.sub;
    const { id } = request.params;
    const { full_name, profile_image, is_active } = request.body;

    await verifyTargetUserInScope(app.db, requestUserId, id);
    await verifyHierarchyEditPermission(app.db, requestUserId, id);

    const user = await app.db('users').where({ id }).whereNull('deleted_at').first();
    if (!user) {
      throw notFound('User not found');
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: app.db.fn.now()
    };

    if (full_name !== undefined) updatePayload.full_name = full_name;
    if (profile_image !== undefined) updatePayload.profile_image = profile_image;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    await app.db('users').where({ id }).update(updatePayload);

    const updated = await app.db('users')
      .select('id', 'email', 'full_name', 'profile_image', 'is_active', 'last_login_at', 'created_at', 'updated_at')
      .where({ id })
      .first();
    return updated;
  });

  // Toggle Status
  app.patch<{ Params: { id: string }; Body: StatusBody }>('/api/v1/admin/users/:id/status', { preHandler: [checkUserReadPermission] }, async (request) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }
    const requestUserId = payload.sub;
    const { id } = request.params;
    const { is_active } = request.body;

    if (is_active === undefined) {
      throw badRequest('is_active value is required');
    }

    await verifyTargetUserInScope(app.db, requestUserId, id);
    await verifyHierarchyEditPermission(app.db, requestUserId, id);

    const user = await app.db('users').where({ id }).whereNull('deleted_at').first();
    if (!user) {
      throw notFound('User not found');
    }

    await app.db('users').where({ id }).update({
      is_active,
      updated_at: app.db.fn.now()
    });

    const updated = await app.db('users').select('id', 'is_active').where({ id }).first();
    return updated;
  });

  // Manage Global Roles
  app.post<{ Params: { id: string }; Body: RolesBody }>('/api/v1/admin/users/:id/roles', { preHandler: [checkUserReadPermission] }, async (request) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }
    const requestUserId = payload.sub;
    const { id } = request.params;
    const { role_ids } = request.body;

    if (!Array.isArray(role_ids)) {
      throw badRequest('role_ids must be an array');
    }

    await verifyTargetUserInScope(app.db, requestUserId, id);
    await verifyHierarchyEditPermission(app.db, requestUserId, id);

    const requestUserLevel = await getUserHierarchyLevel(app.db, requestUserId);
    if (requestUserLevel > 1) {
      throw forbidden('Only Super Admin can assign global roles');
    }

    const user = await app.db('users').where({ id }).whereNull('deleted_at').first();
    if (!user) {
      throw notFound('User not found');
    }

    // Verify roles exist
    const roles = await app.db('roles').select('id', 'hierarchy_level').whereIn('id', role_ids).whereNull('deleted_at');
    if (roles.length !== role_ids.length) {
      throw badRequest('One or more global roles do not exist');
    }

    for (const r of roles) {
      if (r.hierarchy_level < requestUserLevel) {
        throw forbidden('You cannot assign roles higher than your own hierarchy level');
      }
    }

    // Assign
    await app.db.transaction(async (trx) => {
      await trx('user_roles').where({ user_id: id }).del();

      if (role_ids.length > 0) {
        await trx('user_roles').insert(
          role_ids.map((rId) => ({
            user_id: id,
            role_id: rId
          }))
        );
      }
    });

    return { success: true };
  });

  // Manage Organization Role Scopes
  app.post<{ Params: { id: string; organizationId: string }; Body: OrgRoleBody }>(
    '/api/v1/admin/users/:id/organizations/:organizationId/roles',
    { preHandler: [checkUserReadPermission] },
    async (request) => {
      let payload;
      try {
        payload = await request.jwtVerify<{ sub: string }>();
      } catch {
        throw unauthenticated('Valid authentication token is required');
      }
      const requestUserId = payload.sub;
      const { id, organizationId } = request.params;
      const { role_id, is_active = true, assigned_from, assigned_to } = request.body;

      if (!role_id) {
        throw badRequest('role_id is required');
      }

      await verifyTargetUserInScope(app.db, requestUserId, id);
      await verifyHierarchyEditPermission(app.db, requestUserId, id);

      const requestUserLevel = await getUserHierarchyLevel(app.db, requestUserId);
      if (requestUserLevel > 2) {
        const allScopedOrgIds = await getScopedOrgIds(app.db, requestUserId);
        if (!allScopedOrgIds.includes(organizationId)) {
          throw forbidden('Target organization is outside your administrative scope');
        }
      }

      const role = await app.db('roles').where({ id: role_id }).whereNull('deleted_at').first();
      if (!role || role.hierarchy_level < requestUserLevel) {
        throw forbidden('You cannot assign roles higher than your own hierarchy level');
      }

      const [user, org] = await Promise.all([
        app.db('users').where({ id }).whereNull('deleted_at').first(),
        app.db('organizations').where({ id: organizationId }).whereNull('deleted_at').first()
      ]);

      if (!user) throw notFound('User not found');
      if (!org) throw notFound('Organization not found');

      const existingMapping = await app.db('user_organization_roles')
        .where({
          user_id: id,
          organization_id: organizationId,
          role_id
        })
        .first();

      if (existingMapping) {
        await app.db('user_organization_roles')
          .where({ id: existingMapping.id })
          .update({
            is_active,
            assigned_from: assigned_from ? new Date(assigned_from) : null,
            assigned_to: assigned_to ? new Date(assigned_to) : null,
            deleted_at: null,
            updated_at: app.db.fn.now()
          });
      } else {
        await app.db('user_organization_roles').insert({
          user_id: id,
          organization_id: organizationId,
          role_id,
          is_active,
          assigned_from: assigned_from ? new Date(assigned_from) : null,
          assigned_to: assigned_to ? new Date(assigned_to) : null,
          created_at: app.db.fn.now(),
          updated_at: app.db.fn.now()
        });
      }

      return { success: true };
    }
  );

  // Remove Organization Role Scope
  app.delete<{ Params: { id: string; organizationId: string; roleId: string } }>(
    '/api/v1/admin/users/:id/organizations/:organizationId/roles/:roleId',
    { preHandler: [checkUserReadPermission] },
    async (request) => {
      let payload;
      try {
        payload = await request.jwtVerify<{ sub: string }>();
      } catch {
        throw unauthenticated('Valid authentication token is required');
      }
      const requestUserId = payload.sub;
      const { id, organizationId, roleId } = request.params;

      await verifyTargetUserInScope(app.db, requestUserId, id);
      await verifyHierarchyEditPermission(app.db, requestUserId, id);

      const requestUserLevel = await getUserHierarchyLevel(app.db, requestUserId);
      if (requestUserLevel > 2) {
        const allScopedOrgIds = await getScopedOrgIds(app.db, requestUserId);
        if (!allScopedOrgIds.includes(organizationId)) {
          throw forbidden('Target organization is outside your administrative scope');
        }
      }

      const role = await app.db('roles').where({ id: roleId }).whereNull('deleted_at').first();
      if (!role || role.hierarchy_level < requestUserLevel) {
        throw forbidden('You cannot remove roles higher than your own hierarchy level');
      }

      await app.db('user_organization_roles')
        .where({
          user_id: id,
          organization_id: organizationId,
          role_id: roleId
        })
        .del();

      return { success: true };
    }
  );

  // Soft Delete User
  app.delete<{ Params: { id: string } }>('/api/v1/admin/users/:id', { preHandler: [checkUserReadPermission] }, async (request) => {
    let payload;
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }
    const requestUserId = payload.sub;
    const { id } = request.params;

    await verifyTargetUserInScope(app.db, requestUserId, id);
    await verifyHierarchyEditPermission(app.db, requestUserId, id);

    const user = await app.db('users').where({ id }).whereNull('deleted_at').first();
    if (!user) {
      throw notFound('User not found');
    }

    await app.db('users').where({ id }).update({
      deleted_at: app.db.fn.now(),
      is_active: false,
      updated_at: app.db.fn.now()
    });

    return { success: true };
  });
}
