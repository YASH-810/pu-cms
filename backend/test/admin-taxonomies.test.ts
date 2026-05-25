import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const superAdminEmail = 'super-admin-tax@example.edu';
const testCatSlug = 'test-category-slug';
const testTagSlug = 'test-tag-slug';
const testTagName = 'Test Tag Name';
const canonicalContentTypes: Record<string, string> = {
  achievement: 'Achievement',
  announcement: 'Announcement',
  blog: 'Blog',
  club: 'Club',
  event: 'Event',
  page: 'Page',
  story: 'Story'
};

let app: FastifyInstance;
let superAdminId: string;
let token: string;
let categoryId: string;
let tagId: string;

async function cleanup(): Promise<void> {
  const userIds = app.db('users').select('id').where({ email: superAdminEmail });
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('users').where({ email: superAdminEmail }).del();

  await app.db('categories').where({ slug: testCatSlug }).del();
  await app.db('tags').where({ slug: testTagSlug }).del();

  for (const [slug, name] of Object.entries(canonicalContentTypes)) {
    await app.db('content_types').where({ slug }).update({
      name,
      description: `${name} content`,
      updated_at: app.db.fn.now()
    });
  }
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
});

after(async () => {
  await cleanup();
  await app.close();
});

test('Super Admin can manage Categories', async () => {
  // 1. Create Category
  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/categories',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'Test Category',
      slug: testCatSlug,
      description: 'Initial description'
    }
  });

  assert.equal(createResponse.statusCode, 200);
  const createBody = createResponse.json();
  assert.equal(createBody.success, true);
  assert.equal(createBody.data.slug, testCatSlug);
  categoryId = String(createBody.data.id);

  // 2. List Categories
  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/categories',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(listResponse.statusCode, 200);
  assert.ok(listResponse.json().data.categories.length >= 1);

  // 3. Update Category
  const updateResponse = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/categories/${categoryId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'Updated Category Name',
      slug: testCatSlug,
      description: 'Updated description'
    }
  });
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().data.name, 'Updated Category Name');

  // 4. Soft Delete
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/categories/${categoryId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteResponse.statusCode, 200);
});

test('Super Admin can manage Tags', async () => {
  // 1. Create Tag
  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/tags',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: testTagName,
      slug: testTagSlug,
      description: 'Tag desc'
    }
  });

  assert.equal(createResponse.statusCode, 200);
  const createBody = createResponse.json();
  assert.equal(createBody.data.slug, testTagSlug);
  tagId = String(createBody.data.id);

  // 2. List Tags
  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/tags',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(listResponse.statusCode, 200);
  assert.ok(listResponse.json().data.tags.length >= 1);

  // 3. Soft Delete
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/tags/${tagId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteResponse.statusCode, 200);
});

test('Super Admin can list and update Content Types but cannot edit system-critical fields', async () => {
  // 1. List Content Types
  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/content-types',
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(listResponse.statusCode, 200);
  const contentTypes = listResponse.json().data.contentTypes;
  assert.ok(contentTypes.length >= 1);
  const targetCT = contentTypes.find((contentType: { slug: string }) => contentType.slug === 'event') ?? contentTypes[0];

  // 2. Attempt to update system critical field slug
  const failSlugResponse = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/content-types/${targetCT.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: targetCT.name,
      slug: 'mutated-slug-value-should-fail'
    }
  });
  assert.equal(failSlugResponse.statusCode, 400);
  assert.match(failSlugResponse.json().errors[0].message, /critical/i);

  // 3. Attempt to update system critical field table_name
  const failTableResponse = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/content-types/${targetCT.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: targetCT.name,
      table_name: 'mutated_table_name_should_fail'
    }
  });
  assert.equal(failTableResponse.statusCode, 400);
  assert.match(failTableResponse.json().errors[0].message, /critical/i);

  // 4. Update allowed fields (name, description, is_active)
  const successResponse = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/content-types/${targetCT.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'Event Calendar',
      description: 'Modified desc'
    }
  });
  assert.equal(successResponse.statusCode, 200);
  assert.equal(successResponse.json().data.name, 'Event Calendar');
});
