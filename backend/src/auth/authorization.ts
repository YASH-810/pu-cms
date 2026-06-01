import type { FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { Knex } from 'knex';
import { forbidden, unauthenticated } from '../http/api-error.js';

export interface PermissionContext {
  organizationId?: string;
  contentTypeId?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  layer?: 'user_scope_permissions' | 'user_organization_roles' | 'user_roles';
  reason: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

export type PermissionContextResolver = (request: FastifyRequest) => PermissionContext | Promise<PermissionContext>;

function nullableMatches(value: string | null | undefined, requested: string | undefined): boolean {
  return value === null || value === undefined || value === requested;
}

export async function resolvePermission(
  db: Knex,
  userId: string,
  permissionCode: string,
  context: PermissionContext = {}
): Promise<PermissionDecision> {
  const permission = await db('permissions')
    .select('id')
    .where({ code: permissionCode })
    .whereNull('deleted_at')
    .first();

  if (!permission) {
    return {
      allowed: false,
      reason: `Permission ${permissionCode} does not exist`
    };
  }

  const permissionId = String(permission.id);

  const scopedPermissions = await db('user_scope_permissions')
    .select('organization_id', 'content_type_id')
    .where({
      user_id: userId,
      permission_id: permissionId
    })
    .whereNull('deleted_at');

  if (scopedPermissions.length > 0) {
    const matchingScope = scopedPermissions.find((scope) => {
      const organizationMatches = nullableMatches(scope.organization_id ? String(scope.organization_id) : null, context.organizationId);
      const contentTypeMatches = nullableMatches(scope.content_type_id ? String(scope.content_type_id) : null, context.contentTypeId);
      return organizationMatches && contentTypeMatches;
    });

    return matchingScope
      ? {
          allowed: true,
          layer: 'user_scope_permissions',
          reason: 'Matched fine-grained user scope permission'
        }
      : {
          allowed: false,
          reason: 'Fine-grained user scope permission exists but does not match requested context'
        };
  }

  if (context.organizationId) {
    const organizationRolePermission = await db('user_organization_roles as uor')
      .join('role_permissions as rp', 'rp.role_id', 'uor.role_id')
      .join('roles as r', 'r.id', 'uor.role_id')
      .where({
        'uor.user_id': userId,
        'uor.organization_id': context.organizationId,
        'uor.is_active': true,
        'rp.permission_id': permissionId
      })
      .whereNull('uor.deleted_at')
      .whereNull('rp.deleted_at')
      .whereNull('r.deleted_at')
      .first('uor.id');

    if (organizationRolePermission) {
      return {
        allowed: true,
        layer: 'user_organization_roles',
        reason: 'Matched organization-scoped role permission'
      };
    }
  }

  const globalRolePermission = await db('user_roles as ur')
    .join('role_permissions as rp', 'rp.role_id', 'ur.role_id')
    .join('roles as r', 'r.id', 'ur.role_id')
    .where({
      'ur.user_id': userId,
      'rp.permission_id': permissionId
    })
    .whereNull('ur.deleted_at')
    .whereNull('rp.deleted_at')
    .whereNull('r.deleted_at')
    .first('ur.id');

  if (globalRolePermission) {
    return {
      allowed: true,
      layer: 'user_roles',
      reason: 'Matched global role permission'
    };
  }

  return {
    allowed: false,
    reason: 'No explicit permission found for requested context'
  };
}

export function requirePermission(
  permissionCode: string,
  resolveContext: PermissionContextResolver = () => ({})
): preHandlerHookHandler {
  return async function permissionGuard(request) {
    let payload: JwtPayload;

    try {
      payload = await request.jwtVerify<JwtPayload>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }

    const decision = await resolvePermission(request.server.db, payload.sub, permissionCode, await resolveContext(request));

    if (!decision.allowed) {
      throw forbidden(decision.reason);
    }
  };
}

export function requireStatusPermission(
  writePermissionCode: string,
  publishPermissionCode: string,
  resolveContext: PermissionContextResolver = () => ({})
): preHandlerHookHandler {
  return async function statusPermissionGuard(request) {
    let payload: JwtPayload;

    try {
      payload = await request.jwtVerify<JwtPayload>();
    } catch {
      throw unauthenticated('Valid authentication token is required');
    }

    const body = request.body as { status?: string };
    const targetStatus = body?.status;
    const requiredPermissionCode = targetStatus === 'review'
      ? writePermissionCode 
      : publishPermissionCode;

    const decision = await resolvePermission(
      request.server.db, 
      payload.sub, 
      requiredPermissionCode, 
      await resolveContext(request)
    );

    if (!decision.allowed) {
      throw forbidden(decision.reason);
    }
  };
}

