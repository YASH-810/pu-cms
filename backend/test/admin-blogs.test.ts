import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testBlogSlug = 'test-blog-slug';
const testEmail = 'blog-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
  // Clean up views
  await app.db('entity_views').del();
  // Clean up blogs and content entities
  const entity = await app.db('content_entities').select('id').where({ slug: testBlogSlug }).first();
  if (entity) {
    const entityId = entity.id;
    await app.db('blogs').where({ entity_id: entityId }).del();
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
  process.env.DATABASE_URL = 'postgresql://postgres:1234@127.0.0.1:5432/postgres';

  app = await buildApp();
  await app.ready();
});

beforeEach(async () => {
  await cleanup();

  // Create super admin user
  const [createdAdmin] = await app.db('users')
    .insert({
      email: testEmail,
      full_name: 'Blog Admin User',
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

test('Admin can create, read, update, transition status, and delete a blog post', async () => {
  // 1. Create Blog
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/blogs',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Test Blog Title',
      slug: testBlogSlug,
      summary: 'Test summary content',
      body_html: '<p>Hello world. This is a five word test.</p>',
      hero_image_url: 'https://example.com/image.png',
      author_id: userId,
      is_featured: false,
      is_pinned: true
    }
  });

  assert.equal(createRes.statusCode, 200);
  const createdBody = createRes.json();
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.data.title, 'Test Blog Title');
  assert.equal(createdBody.data.slug, testBlogSlug);
  assert.equal(createdBody.data.status, 'draft');
  assert.equal(createdBody.data.reading_time, 1); // < 200 words => 1 min
  assert.equal(createdBody.data.is_pinned, true);
  assert.equal(createdBody.data.author_id, userId);

  const blogId = createdBody.data.id;
  const entityId = createdBody.data.entity_id;

  // 2. Fetch single Blog via Admin route
  const getRes = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/blogs/${blogId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().data.title, 'Test Blog Title');

  // 3. Update Blog details and verify reading time increases
  // Let's create a body with 250 words
  const longBody = Array(250).fill('word').join(' ');
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/blogs/${blogId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Updated Blog Title',
      body_html: `<p>${longBody}</p>`
    }
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.json().data.title, 'Updated Blog Title');
  assert.equal(updateRes.json().data.reading_time, 2); // 250 words / 200 speed = 1.25 -> rounded up is 2 min

  // 4. Verify public blog slug endpoint fails (still draft)
  const publicSlugRes1 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/blogs/${testBlogSlug}`
  });
  assert.equal(publicSlugRes1.statusCode, 404);

  // 5. Transition: draft -> review
  const statusReviewRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/blogs/${blogId}/status`,
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
    url: `/api/v1/admin/blogs/${blogId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'published',
      remarks: 'Approved and published'
    }
  });
  assert.equal(statusPublishRes.statusCode, 200);
  assert.equal(statusPublishRes.json().data.status, 'published');

  // 7. Verify public blog slug endpoint succeeds (now published)
  const publicSlugRes2 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/blogs/${testBlogSlug}`
  });
  assert.equal(publicSlugRes2.statusCode, 200);
  const publicBody = publicSlugRes2.json();
  assert.equal(publicBody.success, true);
  assert.equal(publicBody.data.title, 'Updated Blog Title');
  assert.equal(publicBody.data.author_name, 'Blog Admin User');

  // Wait briefly for view tracking fire-and-forget task
  await new Promise(resolve => setTimeout(resolve, 200));

  // 8. Verify a view impression log was recorded in the database
  const views = await app.db('entity_views').where({ entity_id: entityId });
  assert.equal(views.length, 1);

  // 9. Soft-delete / Archive the blog
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/blogs/${blogId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.json().data.success, true);

  // 10. Verify public blog slug endpoint returns 404 again (now archived)
  const publicSlugRes3 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/blogs/${testBlogSlug}`
  });
  assert.equal(publicSlugRes3.statusCode, 404);
});
