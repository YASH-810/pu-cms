import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testEmail = 'scheduler-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
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
      full_name: 'Scheduler Test User',
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

test('Scheduler jobs, logs, and manual run triggers', async () => {
  // 1. Fetch Scheduler Jobs
  const jobsRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/scheduler/jobs',
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(jobsRes.statusCode, 200);
  const jobs = jobsRes.json().data;
  assert.ok(Array.isArray(jobs));
  
  // Make sure standard scheduled_publishing or generate_sitemap is registered
  const sitemapJob = jobs.find((j: any) => j.job_name === 'generate_sitemap');
  assert.ok(sitemapJob);

  // 2. Trigger sitemap generation manually
  const runRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/scheduler/jobs/generate_sitemap/run',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(runRes.statusCode, 200);
  assert.equal(runRes.json().data.success, true);

  // 3. Poll execution logs to verify that the job completes successfully
  let jobCompleted = false;
  const timeoutMs = 8000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const logsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/scheduler/logs',
      headers: { authorization: `Bearer ${token}` },
      query: { job_name: 'generate_sitemap' }
    });
    assert.equal(logsRes.statusCode, 200);
    const body = logsRes.json().data;
    
    const relevantLog = body.logs.find((l: any) => l.job_name === 'generate_sitemap');
    if (relevantLog && (relevantLog.status === 'completed' || relevantLog.status === 'failed')) {
      assert.equal(relevantLog.status, 'completed');
      jobCompleted = true;
      break;
    }
    
    // Sleep 150ms
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  assert.ok(jobCompleted, 'Scheduled job did not complete within the timeout');
});
