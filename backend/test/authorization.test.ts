import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { buildApp } from '../src/app.js';
import { requirePermission } from '../src/auth/authorization.js';

const testEmail = 'authz-user@example.edu';
const schoolASlug = 'phase3-school-a';
const schoolBSlug = 'phase3-school-b';
const testRoleName = 'PHASE3_EVENT_CREATOR';

let app: FastifyInstance;
let userId: string;
let schoolAId: string;
let schoolBId: string;
let roleId: string;
let permissionId: string;
let token: string;

function organizationIdFromParams(request: FastifyRequest): { organizationId: string } {
  return {
    organizationId: String((request.params as { organizationId: string }).organizationId)
  };
}

async function cleanup(): Promise<void> {
  const userIds = app.db('users').select('id').where({ email: testEmail });
  const organizationIds = app.db('organizations').select('id').whereIn('slug', [schoolASlug, schoolBSlug]);
  const roleIds = app.db('roles').select('id').where({ name: testRoleName });

  await app.db('user_scope_permissions').whereIn('user_id', userIds).del();
  await app.db('user_organization_roles').whereIn('user_id', userIds).del();
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('role_permissions').whereIn('role_id', roleIds).del();
  await app.db('users').where({ email: testEmail }).del();
  await app.db('organizations').whereIn('id', organizationIds).del();
  await app.db('roles').where({ name: testRoleName }).del();
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.HOST = '127.0.0.1';
  process.env.PORT = '0';
  process.env.LOG_LEVEL = 'silent';
  process.env.DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/postgres';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost/api/v1/admin/auth/google/callback';
  process.env.SESSION_SECRET = 'test-session-secret-value';

  app = await buildApp();
  await app.register(async (testRoutes) => {
    testRoutes.post(
      '/test/organizations/:organizationId/events',
      {
        preHandler: requirePermission('CREATE_EVENT', organizationIdFromParams)
      },
      async () => ({ authorized: true })
    );

    testRoutes.post(
      '/test/global/events',
      {
        preHandler: requirePermission('CREATE_EVENT')
      },
      async () => ({ authorized: true })
    );
  });
  await app.ready();
});

beforeEach(async () => {
  await cleanup();

  const [createdUser] = await app.db('users')
    .insert({
      email: testEmail,
      full_name: 'Authorization User',
      is_active: true
    })
    .returning(['id']);
  userId = String(createdUser.id);

  const [schoolA] = await app.db('organizations')
    .insert({
      name: 'Phase 3 School A',
      org_type: 'school',
      slug: schoolASlug,
      is_active: true
    })
    .returning(['id']);
  schoolAId = String(schoolA.id);

  const [schoolB] = await app.db('organizations')
    .insert({
      name: 'Phase 3 School B',
      org_type: 'school',
      slug: schoolBSlug,
      is_active: true
    })
    .returning(['id']);
  schoolBId = String(schoolB.id);

  const [createdRole] = await app.db('roles')
    .insert({
      name: testRoleName,
      description: 'Phase 3 test role',
      hierarchy_level: 900
    })
    .returning(['id']);
  roleId = String(createdRole.id);

  const permission = await app.db('permissions').select('id').where({ code: 'CREATE_EVENT' }).first();
  assert.ok(permission, 'Expected CREATE_EVENT permission seed');
  permissionId = String(permission.id);

  await app.db('role_permissions').insert({
    role_id: roleId,
    permission_id: permissionId
  });

  token = app.jwt.sign({
    sub: userId,
    email: testEmail
  });
});

after(async () => {
  await cleanup();
  await app.close();
});

test('permission guard denies by default when no explicit permission exists', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/test/organizations/${schoolAId}/events`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.success, false);
  assert.equal(body.errors[0].code, 'FORBIDDEN');
});

test('permission guard allows a global role permission', async () => {
  await app.db('user_roles').insert({
    user_id: userId,
    role_id: roleId
  });

  const response = await app.inject({
    method: 'POST',
    url: '/test/global/events',
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.authorized, true);
});

test('permission guard allows matching organization role permission', async () => {
  await app.db('user_organization_roles').insert({
    user_id: userId,
    organization_id: schoolAId,
    role_id: roleId,
    is_active: true
  });

  const response = await app.inject({
    method: 'POST',
    url: `/test/organizations/${schoolAId}/events`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.authorized, true);
});

test('permission guard rejects School B when user has explicit scope only for School A', async () => {
  await app.db('user_scope_permissions').insert({
    user_id: userId,
    permission_id: permissionId,
    organization_id: schoolAId
  });

  const allowedResponse = await app.inject({
    method: 'POST',
    url: `/test/organizations/${schoolAId}/events`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(allowedResponse.statusCode, 200);

  const rejectedResponse = await app.inject({
    method: 'POST',
    url: `/test/organizations/${schoolBId}/events`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(rejectedResponse.statusCode, 403);
  const body = rejectedResponse.json();
  assert.equal(body.success, false);
  assert.equal(body.errors[0].code, 'FORBIDDEN');
});
