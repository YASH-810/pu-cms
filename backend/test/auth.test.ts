import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { GoogleAuthProvider, GoogleProfile } from '../src/auth/google-auth-provider.js';

class MockGoogleAuthProvider implements GoogleAuthProvider {
  public profile: GoogleProfile = {
    email: 'seeded-user@example.edu',
    fullName: 'Seeded User'
  };

  public async getProfile(): Promise<GoogleProfile> {
    return this.profile;
  }
}

const testEmail = 'seeded-user@example.edu';
const unknownEmail = 'unknown-user@example.edu';
let app: FastifyInstance;
let googleAuthProvider: MockGoogleAuthProvider;
let userId: string;

async function roleId(name: string): Promise<string> {
  const role = await app.db('roles').select('id').where({ name }).first();
  assert.ok(role, `Expected role ${name} to exist`);
  return String(role.id);
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.HOST = '127.0.0.1';
  process.env.PORT = '0';
  process.env.LOG_LEVEL = 'silent';
  process.env.DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/postgres';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost/api/v1/admin/auth/google/callback';
  process.env.SESSION_SECRET = 'test-session-secret-value';

  googleAuthProvider = new MockGoogleAuthProvider();
  app = await buildApp({
    googleAuthProvider
  });
});

beforeEach(async () => {
  await app.db('user_login_logs').whereIn('user_id', app.db('users').select('id').whereIn('email', [testEmail, unknownEmail])).del();
  await app.db('user_roles').whereIn('user_id', app.db('users').select('id').whereIn('email', [testEmail, unknownEmail])).del();
  await app.db('users').whereIn('email', [testEmail, unknownEmail]).del();

  const [createdUser] = await app.db('users')
    .insert({
      email: testEmail,
      full_name: 'Seeded User',
      is_active: true
    })
    .returning(['id']);

  userId = String(createdUser.id);

  await app.db('user_roles').insert({
    user_id: userId,
    role_id: await roleId('SUPER_ADMIN')
  });
});

after(async () => {
  await app.db('user_login_logs').whereIn('user_id', app.db('users').select('id').whereIn('email', [testEmail, unknownEmail])).del();
  await app.db('user_roles').whereIn('user_id', app.db('users').select('id').whereIn('email', [testEmail, unknownEmail])).del();
  await app.db('users').whereIn('email', [testEmail, unknownEmail]).del();
  await app.close();
});

test('Google callback logs in a seeded active user, returns JWT context, and writes login log', async () => {
  googleAuthProvider.profile = {
    email: testEmail,
    fullName: 'Seeded User'
  };

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/google/callback',
    headers: {
      'user-agent': 'node-test-agent',
      'x-forwarded-for': '203.0.113.10'
    },
    payload: {
      idToken: 'mock-id-token'
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.errors.length, 0);
  assert.equal(body.data.user.email, testEmail);
  assert.equal(body.data.globalRoles[0].name, 'SUPER_ADMIN');
  assert.equal(typeof body.data.token, 'string');

  const logs = await app.db('user_login_logs').select('ip_address', 'user_agent').where({ user_id: userId });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].ip_address, '203.0.113.10');
  assert.equal(logs[0].user_agent, 'node-test-agent');

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/auth/me',
    headers: {
      authorization: `Bearer ${body.data.token}`
    }
  });

  assert.equal(meResponse.statusCode, 200);
  const meBody = meResponse.json();
  assert.equal(meBody.success, true);
  assert.equal(meBody.data.user.email, testEmail);
  assert.equal(meBody.data.globalRoles[0].name, 'SUPER_ADMIN');
  assert.deepEqual(meBody.data.organizationScope, []);
});

test('Google callback rejects an unknown Google email with 401', async () => {
  googleAuthProvider.profile = {
    email: unknownEmail,
    fullName: 'Unknown User'
  };

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/google/callback',
    payload: {
      idToken: 'mock-id-token'
    }
  });

  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.success, false);
  assert.equal(body.data.constructor, Object);
  assert.equal(body.errors[0].code, 'UNAUTHENTICATED');

  const logs = await app.db('user_login_logs').whereIn('user_id', app.db('users').select('id').where({ email: unknownEmail }));
  assert.equal(logs.length, 0);
});
