import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testEmail = 'analytics-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
  // Clean up views, queries, approval logs, and user roles
  await app.db('entity_views').del();
  await app.db('search_queries').del();
  await app.db('entity_approval_logs').del();
  await app.db('notifications').del();

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
      full_name: 'Analytics Test User',
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

test('Analytics dashboard administrative reporting endpoints', async () => {
  // 1. Seed some view and query event metrics
  await app.db('notifications').insert({
    user_id: userId,
    title: 'Alert',
    body: 'Body',
    is_read: false
  });

  await app.db('search_queries').insert({
    query: 'science',
    results_count: 5,
    user_id: userId
  });

  // 2. Fetch Overview Statistics
  const overviewRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/analytics/overview',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(overviewRes.statusCode, 200);
  const overview = overviewRes.json();
  assert.ok(overview.data);
  assert.equal(overview.data.totalNotifications, 1);

  // 3. Fetch Views Traffic and Top Content
  const viewsRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/analytics/views',
    headers: { authorization: `Bearer ${token}` },
    query: { interval: 'day', limit: '15' }
  });
  assert.equal(viewsRes.statusCode, 200);
  const views = viewsRes.json();
  assert.ok(Array.isArray(views.data.trend));
  assert.ok(Array.isArray(views.data.top));

  // 4. Fetch Popular and Failed Search Keywords
  const searchRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/analytics/search',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(searchRes.statusCode, 200);
  const search = searchRes.json();
  assert.ok(Array.isArray(search.data.topQueries));
  assert.ok(Array.isArray(search.data.zeroResultQueries));

  // 5. Fetch Workflow performance stats
  const workflowRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/analytics/workflow',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(workflowRes.statusCode, 200);
  const workflow = workflowRes.json();
  assert.ok(workflow.data);
  assert.ok('avgReviewHours' in workflow.data);
});
