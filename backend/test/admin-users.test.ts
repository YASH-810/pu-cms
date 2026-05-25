import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testEmail = 'user-admin-test@example.edu';
const superAdminEmail = 'super-admin-users@example.edu';

let app: FastifyInstance;
let userId: string;
let superAdminId: string;
let token: string;
let managerRoleId: string;

async function cleanup(): Promise<void> {
  const userIds = app.db('users').select('id').whereIn('email', [testEmail, superAdminEmail]);
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('user_organization_roles').whereIn('user_id', userIds).del();
  await app.db('users').whereIn('email', [testEmail, superAdminEmail]).del();
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/postgres';

  app = await buildApp();
  await app.ready();
});

beforeEach(async () => {
  await cleanup();

  // Create super admin with MANAGE_USERS permission
  const [createdAdmin] = await app.db('users')
    .insert({
      email: superAdminEmail,
      full_name: 'Super Admin',
      is_active: true
    })
    .returning(['id']);
  superAdminId = String(createdAdmin.id);

  // Link to SUPER_ADMIN role which has all permissions
  const role = await app.db('roles').where({ name: 'SUPER_ADMIN' }).first();
  if (role) {
    await app.db('user_roles').insert({
      user_id: superAdminId,
      role_id: role.id
    });
  }

  token = app.jwt.sign({
    sub: superAdminId,
    email: superAdminEmail
  });

  const contentCreatorRole = await app.db('roles').where({ name: 'CONTENT_CREATOR' }).first();
  managerRoleId = contentCreatorRole ? String(contentCreatorRole.id) : '';
});

after(async () => {
  await cleanup();
  await app.close();
});

test('Super Admin can list users', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/users',
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.users));
  assert.ok(body.data.users.length >= 1);
});

test('Super Admin can create a new user', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/users',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      email: testEmail,
      full_name: 'Test Administrator User',
      is_active: true,
      global_roles: [managerRoleId]
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.email, testEmail);
  userId = String(body.data.id);

  // Verify role was assigned
  const roleAssignments = await app.db('user_roles').where({ user_id: userId });
  assert.equal(roleAssignments.length, 1);
});

test('Super Admin can update, toggle status, and soft delete a user', async () => {
  // Create first
  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/users',
    headers: { authorization: `Bearer ${token}` },
    payload: { email: testEmail, full_name: 'Toggle Test User' }
  });
  const uId = createResponse.json().data.id;

  // 1. Update Details
  const updateResponse = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/users/${uId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { full_name: 'Updated Name' }
  });
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().data.full_name, 'Updated Name');

  // 2. Toggle status to inactive
  const statusResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/users/${uId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { is_active: false }
  });
  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().data.is_active, false);

  // 3. Soft Delete
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/users/${uId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteResponse.statusCode, 200);

  // Verify deleted user is excluded from normal lookups
  const dbUser = await app.db('users').where({ id: uId }).whereNull('deleted_at').first();
  assert.equal(dbUser, undefined);
});
