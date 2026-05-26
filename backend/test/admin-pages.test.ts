import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testPageSlug = 'test-page-slug';
const testEmail = 'page-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
  // Clean up views
  await app.db('entity_views').del();
  // Clean up pages and content entities
  const entity = await app.db('content_entities').select('id').where({ slug: testPageSlug }).first();
  if (entity) {
    const entityId = entity.id;
    await app.db('pages').where({ entity_id: entityId }).del();
    await app.db('entity_owners').where({ entity_id: entityId }).del();
    await app.db('entity_approval_logs').where({ entity_id: entityId }).del();
    await app.db('entity_audit_logs').where({ entity_id: entityId }).del();
    await app.db('content_entities').where({ id: entityId }).del();
  }

  // Clean up user
  const userIds = app.db('users').select('id').where({ email: testEmail });
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('users').where({ email: testEmail }).del();
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/postgres';

  app = await buildApp();
  await app.ready();
});

beforeEach(async () => {
  await cleanup();

  // Create super admin user
  const [createdAdmin] = await app.db('users')
    .insert({
      email: testEmail,
      full_name: 'Page Admin User',
      is_active: true
    })
    .returning(['id']);
  userId = String(createdAdmin.id);

  // Link to SUPER_ADMIN role which has all permissions
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

test('Admin can create, read, update, transition status, and delete a page', async () => {
  // 1. Create Page
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/pages',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Test Page Title',
      slug: testPageSlug,
      summary: 'Test summary content',
      body_html: '<p>Test body HTML</p>',
      template: 'default',
      is_featured: false,
      show_in_nav: true
    }
  });

  assert.equal(createRes.statusCode, 200);
  const createdBody = createRes.json();
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.data.title, 'Test Page Title');
  assert.equal(createdBody.data.slug, testPageSlug);
  assert.equal(createdBody.data.status, 'draft');
  const pageId = createdBody.data.id;
  const entityId = createdBody.data.entity_id;

  // 2. Fetch single Page via Admin route
  const getRes = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/pages/${pageId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().data.title, 'Test Page Title');

  // 3. Update Page details
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/pages/${pageId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Updated Page Title',
      body_html: '<p>Updated body HTML</p>'
    }
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.json().data.title, 'Updated Page Title');
  assert.equal(updateRes.json().data.body_html, '<p>Updated body HTML</p>');

  // 4. Verify public page slug endpoint fails (still draft)
  const publicSlugRes1 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/pages/${testPageSlug}`
  });
  assert.equal(publicSlugRes1.statusCode, 404);

  // 5. Transition: draft -> review
  const statusReviewRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/pages/${pageId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'review',
      remarks: 'Ready for review'
    }
  });
  assert.equal(statusReviewRes.statusCode, 200);
  assert.equal(statusReviewRes.json().data.status, 'review');

  // 6. Transition: review -> published
  const statusPublishRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/pages/${pageId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'published',
      remarks: 'Approved and published'
    }
  });
  assert.equal(statusPublishRes.statusCode, 200);
  assert.equal(statusPublishRes.json().data.status, 'published');

  // 7. Verify public page slug endpoint succeeds (now published)
  const publicSlugRes2 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/pages/${testPageSlug}`
  });
  assert.equal(publicSlugRes2.statusCode, 200);
  const publicBody = publicSlugRes2.json();
  assert.equal(publicBody.success, true);
  assert.equal(publicBody.data.title, 'Updated Page Title');

  // Wait briefly for view tracking fire-and-forget task
  await new Promise(resolve => setTimeout(resolve, 200));

  // 8. Verify a view impression log was recorded in the database
  const views = await app.db('entity_views').where({ entity_id: entityId });
  assert.equal(views.length, 1);

  // 9. Soft-delete / Archive the page
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/pages/${pageId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.json().data.success, true);

  // 10. Verify public page slug endpoint returns 404 again (now archived)
  const publicSlugRes3 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/pages/${testPageSlug}`
  });
  assert.equal(publicSlugRes3.statusCode, 404);
});
