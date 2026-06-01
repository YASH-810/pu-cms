import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testEmail = 'notification-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
  // Clean up notifications and execution log records
  await app.db('notifications').del();
  // Clean up user
  const userIds = app.db('users').select('id').where({ email: testEmail });
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('users').where({ email: testEmail }).del();
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

  // Create super admin user
  const [createdAdmin] = await app.db('users')
    .insert({
      email: testEmail,
      full_name: 'Notification Test User',
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

test('User inbox and Admin template endpoints for Notifications', async () => {
  // 1. Fetch Notification Templates as Admin
  const templatesRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/notification-templates',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(templatesRes.statusCode, 200);
  const templates = templatesRes.json();
  assert.ok(Array.isArray(templates.data));

  // Find a template to update
  const firstTemplate = templates.data[0];
  if (firstTemplate) {
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/notification-templates/${firstTemplate.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        subject_template: 'Updated Subject: {{title}}',
        body_template: 'Updated Body: {{title}} is updated by {{actor}}.'
      }
    });
    assert.equal(updateRes.statusCode, 200);
    const updated = updateRes.json();
    assert.equal(updated.data.subject_template, 'Updated Subject: {{title}}');
  }

  // 2. Insert direct Notification in database for our test user
  const [notification] = await app.db('notifications').insert({
    user_id: userId,
    title: 'New Review Requested',
    body: 'A page is waiting for your review.',
    action_url: '/admin/pages',
    is_read: false
  }).returning('*');

  // 3. Get Unread Count
  const countRes = await app.inject({
    method: 'GET',
    url: '/api/v1/notifications/unread-count',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(countRes.statusCode, 200);
  assert.equal(countRes.json().data.count, 1);

  // 4. List User Notifications
  const listRes = await app.inject({
    method: 'GET',
    url: '/api/v1/notifications',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(listRes.statusCode, 200);
  const list = listRes.json();
  assert.equal(list.data.notifications.length, 1);
  assert.equal(list.data.notifications[0].id, notification.id);

  // 5. Mark Single Notification as Read
  const readRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/notifications/${notification.id}/read`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(readRes.statusCode, 200);
  assert.equal(readRes.json().data.success, true);

  // 6. Verify Unread Count is now 0
  const countResAfter = await app.inject({
    method: 'GET',
    url: '/api/v1/notifications/unread-count',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(countResAfter.json().data.count, 0);
});
