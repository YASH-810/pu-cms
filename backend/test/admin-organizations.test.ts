import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const superAdminEmail = 'super-admin-orgs@example.edu';
const orgASlug = 'test-school-org-a';
const orgBSlug = 'test-department-org-b';
const orgCSlug = 'test-program-org-c';

let app: FastifyInstance;
let superAdminId: string;
let token: string;
let orgAId: string;
let orgBId: string;
let orgCId: string;

async function cleanup(): Promise<void> {
  const userIds = app.db('users').select('id').where({ email: superAdminEmail });
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('users').where({ email: superAdminEmail }).del();

  const orgIds = app.db('organizations').select('id').whereIn('slug', [orgASlug, orgBSlug, orgCSlug]);
  await app.db('user_organization_roles').whereIn('organization_id', orgIds).del();
  await app.db('organizations').whereIn('slug', [orgASlug, orgBSlug, orgCSlug]).del();
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

  const [createdAdmin] = await app.db('users')
    .insert({
      email: superAdminEmail,
      full_name: 'Super Admin',
      is_active: true
    })
    .returning(['id']);
  superAdminId = String(createdAdmin.id);

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

  // Seed flat organization hierarchy
  const [orgA] = await app.db('organizations')
    .insert({
      name: 'Test School A',
      org_type: 'school',
      slug: orgASlug,
      is_active: true
    })
    .returning(['id']);
  orgAId = String(orgA.id);

  const [orgB] = await app.db('organizations')
    .insert({
      name: 'Test Department B',
      org_type: 'department',
      slug: orgBSlug,
      parent_id: orgAId,
      is_active: true
    })
    .returning(['id']);
  orgBId = String(orgB.id);

  const [orgC] = await app.db('organizations')
    .insert({
      name: 'Test Program C',
      org_type: 'program',
      slug: orgCSlug,
      parent_id: orgBId,
      is_active: true
    })
    .returning(['id']);
  orgCId = String(orgC.id);
});

after(async () => {
  await cleanup();
  await app.close();
});

test('Super Admin can fetch organization tree structure', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/organizations/tree',
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.tree));

  // Find root node School A
  const schoolNode = body.data.tree.find((node: any) => node.id === orgAId);
  assert.ok(schoolNode);
  assert.equal(schoolNode.children.length, 1);
  assert.equal(schoolNode.children[0].id, orgBId);
  assert.equal(schoolNode.children[0].children.length, 1);
  assert.equal(schoolNode.children[0].children[0].id, orgCId);
});

test('Super Admin cannot update an organization to have itself as parent', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/organizations/${orgAId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'Test School A Modified',
      org_type: 'school',
      slug: orgASlug,
      parent_id: orgAId
    }
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.success, false);
  assert.match(body.errors[0].message, /cyclic/i);
});

test('Super Admin cannot introduce a cyclic organization hierarchy (indirect loop)', async () => {
  // Attempting to set Org A's parent to Org C (since A is parent of B, and B is parent of C)
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/organizations/${orgAId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'Test School A Modified',
      org_type: 'school',
      slug: orgASlug,
      parent_id: orgCId
    }
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.success, false);
  assert.match(body.errors[0].message, /cyclic/i);
});

test('Super Admin cannot soft delete an organization with active child organizations', async () => {
  // Attempt to delete Org A which has active child Org B
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/organizations/${orgAId}`,
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(response.statusCode, 409);
  const body = response.json();
  assert.equal(body.success, false);
  assert.match(body.errors[0].message, /active child/i);
});
