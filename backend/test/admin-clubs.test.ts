import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testSlugBase = 'test-club';
const testEmail = 'club-admin-test@example.edu';
const testOrgSlug = 'test-club-org';

let app: FastifyInstance;
let userId: string;
let token: string;
let orgId: string;

async function cleanup(): Promise<void> {
  await app.db('entity_views').del();
  const entities = await app.db('content_entities').select('id').whereILike('slug', `${testSlugBase}%`);
  const entityIds = entities.map(e => e.id);
  if (entityIds.length > 0) {
    await app.db('club_details').whereIn('entity_id', entityIds).del();
    await app.db('entity_organizations').whereIn('entity_id', entityIds).del();
    await app.db('entity_owners').whereIn('entity_id', entityIds).del();
    await app.db('entity_approval_logs').whereIn('entity_id', entityIds).del();
    await app.db('entity_audit_logs').whereIn('entity_id', entityIds).del();
    await app.db('content_entities').whereIn('id', entityIds).del();
  }

  // Clean up org
  await app.db('organizations').where({ slug: testOrgSlug }).del();

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
      full_name: 'Club Admin User',
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

  // Create test organization
  const [createdOrg] = await app.db('organizations')
    .insert({
      name: 'Test Club Org',
      org_type: 'club',
      slug: testOrgSlug,
      is_active: true
    })
    .returning(['id']);
  orgId = String(createdOrg.id);

  token = app.jwt.sign({
    sub: userId,
    email: testEmail
  });
});

after(async () => {
  await cleanup();
  await app.close();
});

test('Clubs Admin CRUD and lifecycle', async () => {
  // 1. Missing fields check
  const missingRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/clubs',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Missing Fields',
      slug: `${testSlugBase}-missing`
      // missing organization_id
    }
  });
  assert.equal(missingRes.statusCode, 400);

  // 2. Successful create
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/clubs',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Photography Club',
      slug: `${testSlugBase}-photo`,
      organization_id: orgId,
      leadership: { president: 'Alice Smith', secretary: 'Bob Johnson' },
      social_links: { instagram: 'https://instagram.com/photoclub' },
      meeting_schedule: 'Every Friday at 4 PM',
      joining_process: 'Fill the Google Form'
    }
  });
  assert.equal(createRes.statusCode, 200);
  const created = createRes.json().data;
  assert.equal(created.title, 'Photography Club');
  assert.equal(created.organization_id, orgId);
  assert.equal(created.leadership.president, 'Alice Smith');
  assert.equal(created.status, 'draft');

  const clubId = created.id;
  const entityId = created.entity_id;

  // 3. Update
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/clubs/${clubId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Photography Club (Updated)',
      leadership: { president: 'Alice Smith', secretary: 'Charlie Brown' }
    }
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.json().data.title, 'Photography Club (Updated)');
  assert.equal(updateRes.json().data.leadership.secretary, 'Charlie Brown');

  // 4. Submit for review (draft -> review)
  const reviewRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/clubs/${clubId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'review', remarks: 'Submitted' }
  });
  assert.equal(reviewRes.statusCode, 200);
  assert.equal(reviewRes.json().data.status, 'review');

  // 5. Publish (review -> published)
  const publishRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/clubs/${clubId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: { status: 'published', remarks: 'Approved' }
  });
  assert.equal(publishRes.statusCode, 200);
  assert.equal(publishRes.json().data.status, 'published');

  // 6. Read public slug
  const publicSlugRes = await app.inject({
    method: 'GET',
    url: `/api/v1/public/clubs/${testSlugBase}-photo`
  });
  assert.equal(publicSlugRes.statusCode, 200);
  assert.equal(publicSlugRes.json().data.title, 'Photography Club (Updated)');

  // Wait for view tracking task
  let views = [];
  for (let i = 0; i < 20; i++) {
    views = await app.db('entity_views').where({ entity_id: entityId });
    if (views.length >= 1) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(views.length, 1);

  // 7. Public listing checks
  const listRes = await app.inject({
    method: 'GET',
    url: '/api/v1/public/clubs'
  });
  assert.equal(listRes.statusCode, 200);
  const clubs = listRes.json().data.clubs;
  const slugs = clubs.map((c: any) => c.slug);
  assert.ok(slugs.includes(`${testSlugBase}-photo`));

  // 8. Soft-delete
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/clubs/${clubId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.statusCode, 200);

  // 9. Public slug fails
  const publicSlugRes2 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/clubs/${testSlugBase}-photo`
  });
  assert.equal(publicSlugRes2.statusCode, 404);
});
