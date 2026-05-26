import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testEventSlug = 'test-event-slug';
const testEmail = 'event-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
  // Clean up views
  await app.db('entity_views').del();
  // Clean up events and content entities
  const entity = await app.db('content_entities').select('id').where({ slug: testEventSlug }).first();
  if (entity) {
    const entityId = entity.id;
    await app.db('events').where({ entity_id: entityId }).del();
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
      full_name: 'Event Admin User',
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

test('Admin can create, read, update, transition status, and delete an event', async () => {
  // 1. Create Event with invalid dates (start >= end)
  const invalidDateRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/events',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Invalid Date Event',
      slug: testEventSlug,
      event_type: 'sports',
      event_mode: 'offline',
      start_at: new Date('2026-06-10T12:00:00Z').toISOString(),
      end_at: new Date('2026-06-10T10:00:00Z').toISOString() // Before start
    }
  });
  assert.equal(invalidDateRes.statusCode, 400);

  // 2. Create Event with invalid deadline (deadline >= start)
  const invalidDeadlineRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/events',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Invalid Deadline Event',
      slug: testEventSlug,
      event_type: 'sports',
      event_mode: 'offline',
      start_at: new Date('2026-06-10T12:00:00Z').toISOString(),
      end_at: new Date('2026-06-10T14:00:00Z').toISOString(),
      registration_deadline_at: new Date('2026-06-10T13:00:00Z').toISOString() // After start
    }
  });
  assert.equal(invalidDeadlineRes.statusCode, 400);

  // 3. Create Event with invalid mode
  const invalidModeRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/events',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Invalid Mode Event',
      slug: testEventSlug,
      event_type: 'sports',
      event_mode: 'invalid_mode_here',
      start_at: new Date('2026-06-10T12:00:00Z').toISOString(),
      end_at: new Date('2026-06-10T14:00:00Z').toISOString()
    }
  });
  assert.equal(invalidModeRes.statusCode, 400);

  // 4. Create Event successfully
  const startAt = new Date('2026-06-10T12:00:00Z').toISOString();
  const endAt = new Date('2026-06-10T14:00:00Z').toISOString();
  const deadlineAt = new Date('2026-06-09T12:00:00Z').toISOString();

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/events',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Test Event Title',
      slug: testEventSlug,
      event_type: 'sports',
      event_mode: 'offline',
      venue: 'University Stadium',
      organizer: 'Sports Club',
      start_at: startAt,
      end_at: endAt,
      timezone: 'Asia/Kolkata',
      registration_deadline_at: deadlineAt,
      max_participants: 100,
      is_featured: false
    }
  });

  assert.equal(createRes.statusCode, 200);
  const createdBody = createRes.json();
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.data.title, 'Test Event Title');
  assert.equal(createdBody.data.slug, testEventSlug);
  assert.equal(createdBody.data.event_mode, 'offline');
  assert.equal(createdBody.data.venue, 'University Stadium');
  assert.equal(createdBody.data.status, 'draft');

  const eventId = createdBody.data.id;
  const entityId = createdBody.data.entity_id;

  // 5. Fetch single Event via Admin route
  const getRes = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/events/${eventId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().data.title, 'Test Event Title');

  // 6. Update Event details
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/events/${eventId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Updated Event Title',
      venue: 'Main Campus Gymnasium'
    }
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.json().data.title, 'Updated Event Title');
  assert.equal(updateRes.json().data.venue, 'Main Campus Gymnasium');

  // 7. Verify public event slug endpoint fails (still draft)
  const publicSlugRes1 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/events/${testEventSlug}`
  });
  assert.equal(publicSlugRes1.statusCode, 404);

  // 8. Transition: draft -> review
  const statusReviewRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/events/${eventId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'review',
      remarks: 'Ready for review'
    }
  });
  assert.equal(statusReviewRes.statusCode, 200);
  assert.equal(statusReviewRes.json().data.status, 'review');

  // 9. Transition: review -> published
  const statusPublishRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/events/${eventId}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'published',
      remarks: 'Approved and published'
    }
  });
  assert.equal(statusPublishRes.statusCode, 200);
  assert.equal(statusPublishRes.json().data.status, 'published');

  // 10. Verify public event slug endpoint succeeds (now published)
  const publicSlugRes2 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/events/${testEventSlug}`
  });
  assert.equal(publicSlugRes2.statusCode, 200);
  const publicBody = publicSlugRes2.json();
  assert.equal(publicBody.success, true);
  assert.equal(publicBody.data.title, 'Updated Event Title');
  assert.equal(publicBody.data.venue, 'Main Campus Gymnasium');

  // Wait briefly for view tracking fire-and-forget task
  await new Promise(resolve => setTimeout(resolve, 200));

  // 11. Verify a view impression log was recorded in the database
  const views = await app.db('entity_views').where({ entity_id: entityId });
  assert.equal(views.length, 1);

  // 12. Soft-delete / Archive the event
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/events/${eventId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.json().data.success, true);

  // 13. Verify public event slug endpoint returns 404 again (now archived)
  const publicSlugRes3 = await app.inject({
    method: 'GET',
    url: `/api/v1/public/events/${testEventSlug}`
  });
  assert.equal(publicSlugRes3.statusCode, 404);
});
