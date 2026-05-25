import type { Knex } from 'knex';
import { unauthenticated } from '../http/api-error.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  profileImage: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface UserRole {
  id: string;
  name: string;
  description: string | null;
  hierarchyLevel: number;
}

export interface OrganizationScope {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationType: string;
  roleId: string;
  roleName: string;
  assignedFrom: string | null;
  assignedTo: string | null;
}

export interface UserAuthContext {
  user: AuthenticatedUser;
  globalRoles: UserRole[];
  organizationScope: OrganizationScope[];
}

const mapUser = (row: Record<string, unknown>): AuthenticatedUser => ({
  id: String(row.id),
  email: String(row.email),
  fullName: String(row.full_name),
  profileImage: row.profile_image ? String(row.profile_image) : null,
  isActive: Boolean(row.is_active),
  lastLoginAt: row.last_login_at ? new Date(String(row.last_login_at)).toISOString() : null
});

export async function getActiveUserByEmail(db: Knex, email: string): Promise<AuthenticatedUser | null> {
  const row = await db('users')
    .select('id', 'email', 'full_name', 'profile_image', 'is_active', 'last_login_at')
    .whereRaw('lower(email) = lower(?)', [email])
    .where({ is_active: true })
    .whereNull('deleted_at')
    .first();

  return row ? mapUser(row) : null;
}

export async function getActiveUserById(db: Knex, id: string): Promise<AuthenticatedUser | null> {
  const row = await db('users')
    .select('id', 'email', 'full_name', 'profile_image', 'is_active', 'last_login_at')
    .where({ id, is_active: true })
    .whereNull('deleted_at')
    .first();

  return row ? mapUser(row) : null;
}

export async function getUserAuthContext(db: Knex, userId: string): Promise<UserAuthContext> {
  const user = await getActiveUserById(db, userId);

  if (!user) {
    throw unauthenticated('Authenticated user is no longer active');
  }

  const globalRoles = await db('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .select(
      'r.id',
      'r.name',
      'r.description',
      'r.hierarchy_level as hierarchyLevel'
    )
    .where('ur.user_id', userId)
    .whereNull('ur.deleted_at')
    .whereNull('r.deleted_at')
    .orderBy('r.hierarchy_level', 'asc');

  const organizationScope = await db('user_organization_roles as uor')
    .join('organizations as o', 'o.id', 'uor.organization_id')
    .join('roles as r', 'r.id', 'uor.role_id')
    .select(
      'o.id as organizationId',
      'o.name as organizationName',
      'o.slug as organizationSlug',
      'o.org_type as organizationType',
      'r.id as roleId',
      'r.name as roleName',
      'uor.assigned_from as assignedFrom',
      'uor.assigned_to as assignedTo'
    )
    .where('uor.user_id', userId)
    .where('uor.is_active', true)
    .where('o.is_active', true)
    .whereNull('uor.deleted_at')
    .whereNull('o.deleted_at')
    .whereNull('r.deleted_at')
    .orderBy('o.name', 'asc');

  return {
    user,
    globalRoles: globalRoles.map((role) => ({
      id: String(role.id),
      name: String(role.name),
      description: role.description ? String(role.description) : null,
      hierarchyLevel: Number(role.hierarchyLevel)
    })),
    organizationScope: organizationScope.map((scope) => ({
      organizationId: String(scope.organizationId),
      organizationName: String(scope.organizationName),
      organizationSlug: String(scope.organizationSlug),
      organizationType: String(scope.organizationType),
      roleId: String(scope.roleId),
      roleName: String(scope.roleName),
      assignedFrom: scope.assignedFrom ? new Date(String(scope.assignedFrom)).toISOString() : null,
      assignedTo: scope.assignedTo ? new Date(String(scope.assignedTo)).toISOString() : null
    }))
  };
}
