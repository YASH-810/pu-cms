import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testSlugBase = 'test-announcement';
const testEmail = 'announcement-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;
let pdfTypeId: string;
let descTypeId: string;
let fullTypeId: string;

async function cleanup(): Promise<void> {
  // Clean up views
  await app.db('entity_views').del();
  // Clean up announcements and content entities
  const entities = await app.db('content_entities').select('id').whereILike('slug', `${testSlugBase}%`);
  const entityIds = entities.map(e => e.id);
  if (entityIds.length > 0) {
    await app.db('announcements').whereIn('entity_id', entityIds).del();
    await app.db('entity_owners').whereIn('entity_id', entityIds).del();
    await app.db('entity_approval_logs').whereIn('entity_id', entityIds).del();
    await app.db('entity_audit_logs').whereIn('entity_id', entityIds).del();
    await app.db('content_entities').whereIn('id', entityIds).del();
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

  // Retrieve seeded announcement type IDs
  const pdfType = await app.db('announcement_types').where({ slug: 'title_plus_pdf' }).first();
  const descType = await app.db('announcement_types').where({ slug: 'title_plus_description' }).first();
  const fullType = await app.db('announcement_types').where({ slug: 'full_content' }).first();

  pdfTypeId = pdfType.id;
  descTypeId = descType.id;
  fullTypeId = fullType.id;
});

beforeEach(async () => {
  await cleanup();

  // Create super admin user
  const [createdAdmin] = await app.db('users')
    .insert({
      email: testEmail,
      full_name: 'Announcement Admin User',
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

test('Admin routes validation and CRUD lifecycle', async () => {
  // 1. Fetch types
  const typesRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/announcements/types',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(typesRes.statusCode, 200);
  const typesBody = typesRes.json();
  assert.equal(typesBody.success, true);
  assert.ok(typesBody.data.length >= 3);

  // 2. Validate title_plus_pdf requires pdf_url
  const invalidPdfRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/announcements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Invalid PDF Announcement',
      slug: `${testSlugBase}-pdf-invalid`,
      announcement_type_id: pdfTypeId
      // missing pdf_url
    }
  });
  assert.equal(invalidPdfRes.statusCode, 400);
  assert.match(invalidPdfRes.json().errors[0].message, /require/i);

  // 3. Validate title_plus_description requires summary
  const invalidDescRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/announcements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Invalid Desc Announcement',
      slug: `${testSlugBase}-desc-invalid`,
      announcement_type_id: descTypeId
      // missing summary
    }
  });
  assert.equal(invalidDescRes.statusCode, 400);
  assert.match(invalidDescRes.json().errors[0].message, /require/i);

  // 4. Validate full_content requires body_html
  const invalidFullRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/announcements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Invalid Full Announcement',
      slug: `${testSlugBase}-full-invalid`,
      announcement_type_id: fullTypeId
      // missing body_html
    }
  });
  assert.equal(invalidFullRes.statusCode, 400);
  assert.match(invalidFullRes.json().errors[0].message, /require/i);

  // 5. Create Announcement successfully (Description Type)
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/announcements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Test Announcement Title',
      slug: `${testSlugBase}-valid`,
      announcement_type_id: descTypeId,
      summary: 'This is a test summary for description announcement',
      priority: 'high'
    }
  });
  assert.equal(createRes.statusCode, 200);
  const createdBody = createRes.json();
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.data.title, 'Test Announcement Title');
  assert.equal(createdBody.data.priority, 'high');
  assert.equal(createdBody.data.status, 'draft');

  const id = createdBody.data.id;
  const entityId = createdBody.data.entity_id;

  // 6. Fetch single via Admin
  const getRes = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/announcements/${id}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().data.title, 'Test Announcement Title');

  // 7. Update Announcement details
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/announcements/${id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Updated Announcement Title',
      priority: 'critical'
    }
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.json().data.title, 'Updated Announcement Title');
  assert.equal(updateRes.json().data.priority, 'critical');

  // 8. Public retrieval fails when in draft
  const publicSlugRes1 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/announcements/${testSlugBase}-valid`
  });
  assert.equal(publicSlugRes1.statusCode, 404);

  // 9. Status transition: draft -> review -> published
  const reviewRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/announcements/${id}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'review',
      remarks: 'Submitting for review'
    }
  });
  assert.equal(reviewRes.statusCode, 200);
  assert.equal(reviewRes.json().data.status, 'review');

  const publishRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/announcements/${id}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'published',
      remarks: 'Approved!'
    }
  });
  assert.equal(publishRes.statusCode, 200);
  assert.equal(publishRes.json().data.status, 'published');

  // 10. Public retrieval succeeds when published
  const publicSlugRes2 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/announcements/${testSlugBase}-valid`
  });
  assert.equal(publicSlugRes2.statusCode, 200);
  assert.equal(publicSlugRes2.json().data.title, 'Updated Announcement Title');

  // 11. View tracking impression log recorded
  await new Promise(resolve => setTimeout(resolve, 150));
  const views = await app.db('entity_views').where({ entity_id: entityId });
  assert.equal(views.length, 1);

  // 12. Soft-delete / Archive
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/announcements/${id}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.json().data.success, true);

  // 13. Public retrieval fails (now archived)
  const publicSlugRes3 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/announcements/${testSlugBase}-valid`
  });
  assert.equal(publicSlugRes3.statusCode, 404);
});

test('Public announcement lists and date window exclusions', async () => {
  // Create an announcement that is in the future
  const futureRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/announcements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Future Announcement',
      slug: `${testSlugBase}-future`,
      announcement_type_id: descTypeId,
      summary: 'This announcement is set to be valid in the future',
      valid_from: new Date('2030-01-01T00:00:00Z').toISOString()
    }
  });
  assert.equal(futureRes.statusCode, 200);
  const futureId = futureRes.json().data.id;

  // Publish future announcement
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/announcements/${futureId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'published' }
  });

  // Create an announcement that expired in the past
  const pastRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/announcements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Expired Announcement',
      slug: `${testSlugBase}-expired`,
      announcement_type_id: descTypeId,
      summary: 'This announcement has expired',
      valid_from: new Date('2020-01-01T00:00:00Z').toISOString(),
      valid_until: new Date('2020-02-01T00:00:00Z').toISOString()
    }
  });
  assert.equal(pastRes.statusCode, 200);
  const pastId = pastRes.json().data.id;

  // Publish expired announcement
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/announcements/${pastId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'published' }
  });

  // Create currently valid announcement
  const activeRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/announcements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Active Announcement',
      slug: `${testSlugBase}-active`,
      announcement_type_id: descTypeId,
      summary: 'This is active right now',
      valid_from: new Date('2025-01-01T00:00:00Z').toISOString(),
      valid_until: new Date('2030-01-01T00:00:00Z').toISOString()
    }
  });
  assert.equal(activeRes.statusCode, 200);
  const activeId = activeRes.json().data.id;

  // Publish active announcement
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/announcements/${activeId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'published' }
  });

  // DB debug log
  const dbAnnouncement = await app.db('announcements').where({ id: activeId }).first();
  const dbEntity = await app.db('content_entities').where({ id: dbAnnouncement.entity_id }).first();
  const dbTypes = await app.db('content_types').select('*');
  console.log('DB ANNOUNCEMENT:', dbAnnouncement);
  console.log('DB ENTITY:', dbEntity);
  console.log('DB CONTENT TYPES:', dbTypes);

  // Fetch public announcements listing
  const listRes = await app.inject({
    method: 'GET',
    url: '/api/v1/public/announcements'
  });
  assert.equal(listRes.statusCode, 200);
  const listBody = listRes.json();
  assert.equal(listBody.success, true);

  // Assert only currently active is returned (future and expired are hidden)
  const items = listBody.data.announcements;
  const slugs = items.map((x: any) => x.slug);
  console.log('ACTIVE CHECK SLUGS:', slugs);
  console.log('FULL LIST RESPONSE DATA:', JSON.stringify(listBody.data, null, 2));
  assert.ok(slugs.includes(`${testSlugBase}-active`));
  assert.ok(!slugs.includes(`${testSlugBase}-future`));
  assert.ok(!slugs.includes(`${testSlugBase}-expired`));
});
