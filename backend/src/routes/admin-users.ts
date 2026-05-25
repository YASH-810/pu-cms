import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { badRequest, conflict, notFound } from '../http/api-error.js';

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
  const guard = requirePermission('MANAGE_USERS');

  // List Roles
  app.get('/api/v1/admin/roles', { preHandler: [guard] }, async () => {
    const roles = await app.db('roles')
      .select('id', 'name', 'description', 'hierarchy_level')
      .whereNull('deleted_at')
      .orderBy('hierarchy_level', 'asc');
    return { roles };
  });

  // List Users
  app.get<{ Querystring: QueryParams }>('/api/v1/admin/users', { preHandler: [guard] }, async (request) => {
    const { search, is_active, limit = '20', page = '1' } = request.query;

    const parsedLimit = Math.max(1, parseInt(limit, 10));
    const parsedPage = Math.max(1, parseInt(page, 10));
    const offset = (parsedPage - 1) * parsedLimit;

    let query = app.db('users').whereNull('deleted_at');

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
  app.get<{ Params: { id: string } }>('/api/v1/admin/users/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;

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
  app.post<{ Body: CreateUserBody }>('/api/v1/admin/users', { preHandler: [guard] }, async (request) => {
    const { email, full_name, profile_image = null, is_active = true, global_roles = [] } = request.body;

    if (!email || !full_name) {
      throw badRequest('Email and full name are required');
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

    return createdUser;
  });

  // Update User
  app.put<{ Params: { id: string }; Body: UpdateUserBody }>('/api/v1/admin/users/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const { full_name, profile_image, is_active } = request.body;

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
  app.patch<{ Params: { id: string }; Body: StatusBody }>('/api/v1/admin/users/:id/status', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const { is_active } = request.body;

    if (is_active === undefined) {
      throw badRequest('is_active value is required');
    }

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
  app.post<{ Params: { id: string }; Body: RolesBody }>('/api/v1/admin/users/:id/roles', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;
    const { role_ids } = request.body;

    if (!Array.isArray(role_ids)) {
      throw badRequest('role_ids must be an array');
    }

    const user = await app.db('users').where({ id }).whereNull('deleted_at').first();
    if (!user) {
      throw notFound('User not found');
    }

    // Verify roles exist
    const roles = await app.db('roles').select('id').whereIn('id', role_ids).whereNull('deleted_at');
    if (roles.length !== role_ids.length) {
      throw badRequest('One or more global roles do not exist');
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
    { preHandler: [guard] },
    async (request) => {
      const { id, organizationId } = request.params;
      const { role_id, is_active = true, assigned_from, assigned_to } = request.body;

      if (!role_id) {
        throw badRequest('role_id is required');
      }

      const [user, org, role] = await Promise.all([
        app.db('users').where({ id }).whereNull('deleted_at').first(),
        app.db('organizations').where({ id: organizationId }).whereNull('deleted_at').first(),
        app.db('roles').where({ id: role_id }).whereNull('deleted_at').first()
      ]);

      if (!user) throw notFound('User not found');
      if (!org) throw notFound('Organization not found');
      if (!role) throw notFound('Role not found');

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

  // Soft Delete User
  app.delete<{ Params: { id: string } }>('/api/v1/admin/users/:id', { preHandler: [guard] }, async (request) => {
    const { id } = request.params;

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
