import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testSlugBase = 'test-story';
const testEmail = 'story-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
  await app.db('entity_views').del();
  const entities = await app.db('content_entities').select('id').whereILike('slug', `${testSlugBase}%`);
  const entityIds = entities.map(e => e.id);
  if (entityIds.length > 0) {
    await app.db('stories').whereIn('entity_id', entityIds).del();
    await app.db('entity_owners').whereIn('entity_id', entityIds).del();
    await app.db('entity_approval_logs').whereIn('entity_id', entityIds).del();
    await app.db('entity_audit_logs').whereIn('entity_id', entityIds).del();
    await app.db('content_entities').whereIn('id', entityIds).del();
  }

  const userIds = app.db('users').select('id').where({ email: testEmail });
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('users').where({ email: testEmail }).del();
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.DATABASE_URL = 'postgresql://postgres:1234@127.0.0.1:5432/postgres';

  app = await buildApp();
  await app.ready();
});

beforeEach(async () => {
  await cleanup();

  const [createdAdmin] = await app.db('users')
    .insert({
      email: testEmail,
      full_name: 'Story Admin User',
      is_active: true
    })
    .returning(['id']);
  userId = String(createdAdmin.id);

  const role = await app.db('roles').where({ name: 'SUPER_ADMIN' }).first();
  if (role) {
    await app.db('user_roles').insert({
      user_id: userId,
      role_id: role.id
    });
  }

  token = app.jwt.sign({
    sub: userId,
    email: testEmail
  });
});

after(async () => {
  await cleanup();
  await app.close();
});

test('Stories Admin CRUD and lifecycle', async () => {
  // 1. Invalid person role check
  const invalidRoleRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/stories',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Invalid Role Story',
      slug: `${testSlugBase}-invalid-role`,
      story_type: 'alumni_spotlight',
      person_name: 'John Doe',
      person_role: 'superstar' // invalid
    }
  });
  assert.equal(invalidRoleRes.statusCode, 400);

  // 2. Missing fields check
  const missingRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/stories',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Missing Fields',
      slug: `${testSlugBase}-missing`
      // missing story_type, person_name, person_role
    }
  });
  assert.equal(missingRes.statusCode, 400);

  // 3. Successful create
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/stories',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Google Placement Story',
      slug: `${testSlugBase}-google`,
      story_type: 'student_success',
      person_name: 'Jane Doe',
      person_role: 'student',
      company: 'Google',
      graduation_year: 2026,
      linkedin_url: 'https://linkedin.com/in/janedoe',
      is_featured: true
    }
  });
  assert.equal(createRes.statusCode, 200);
  const created = createRes.json().data;
  assert.equal(created.title, 'Google Placement Story');
  assert.equal(created.person_role, 'student');
  assert.equal(created.status, 'draft');

  const storyId = created.id;
  const entityId = created.entity_id;

  // 4. Update
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/stories/${storyId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Google Placement Story (Updated)',
      company: 'Google India'
    }
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.json().data.title, 'Google Placement Story (Updated)');
  assert.equal(updateRes.json().data.company, 'Google India');

  // 5. Submit for review (draft -> review)
  const reviewRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/stories/${storyId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'review', remarks: 'Submitted' }
  });
  assert.equal(reviewRes.statusCode, 200);
  assert.equal(reviewRes.json().data.status, 'review');

  // 6. Publish (review -> published)
  const publishRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/stories/${storyId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'published', remarks: 'Approved' }
  });
  assert.equal(publishRes.statusCode, 200);
  assert.equal(publishRes.json().data.status, 'published');

  // 7. Read public slug
  const publicSlugRes = await app.inject({
    method: 'GET',
    url: `/api/v1/public/stories/${testSlugBase}-google`
  });
  assert.equal(publicSlugRes.statusCode, 200);
  assert.equal(publicSlugRes.json().data.title, 'Google Placement Story (Updated)');

  // Wait for view tracking task
  let views = [];
  for (let i = 0; i < 20; i++) {
    views = await app.db('entity_views').where({ entity_id: entityId });
    if (views.length >= 1) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(views.length, 1);

  // 8. Public listing checks
  const listRes = await app.inject({
    method: 'GET',
    url: '/api/v1/public/stories'
  });
  assert.equal(listRes.statusCode, 200);
  const stories = listRes.json().data.stories;
  const slugs = stories.map((s: any) => s.slug);
  assert.ok(slugs.includes(`${testSlugBase}-google`));

  // 9. Soft-delete
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/stories/${storyId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.statusCode, 200);

  // 10. Public slug fails
  const publicSlugRes2 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/stories/${testSlugBase}-google`
  });
  assert.equal(publicSlugRes2.statusCode, 404);
});
