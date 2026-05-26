import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const testPageSlug = 'search-test-page';
const testEmail = 'search-admin-test@example.edu';

let app: FastifyInstance;
let userId: string;
let token: string;

async function cleanup(): Promise<void> {
  // Clean up search queries & search index records
  await app.db('search_queries').del();
  await app.db('search_index').del();

  // Clean up pages
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
      full_name: 'Search Test User',
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

test('Search engine public endpoints and dynamic XML sitemap', async () => {
  // 1. Create a Page
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/pages',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Advanced Agentic Coding Tutorial',
      slug: testPageSlug,
      summary: 'Learn AI agent pair-programming paradigms.',
      body_html: '<p>A deep dive into advanced agentic coding systems and pairs.</p>',
      template: 'default',
      is_featured: false,
      show_in_nav: true
    }
  });
  assert.equal(createRes.statusCode, 200);
  const page = createRes.json().data;

  // 2. Publish the Page so it gets indexed
  const reviewRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/pages/${page.id}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'review',
      remarks: 'Submit for review'
    }
  });
  assert.equal(reviewRes.statusCode, 200);

  const publishRes = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/pages/${page.id}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'published',
      remarks: 'Release to public'
    }
  });
  assert.equal(publishRes.statusCode, 200);

  // 3. Query the sitemap.xml
  const sitemapRes = await app.inject({
    method: 'GET',
    url: '/sitemap.xml'
  });
  assert.equal(sitemapRes.statusCode, 200);
  assert.equal(sitemapRes.headers['content-type'], 'application/xml');
  assert.ok(sitemapRes.payload.includes(testPageSlug));

  // 4. Poll search index to ensure search is populated (handled async via event loop/promises)
  let searchFound = false;
  const start = Date.now();
  const timeoutMs = 5000;

  while (Date.now() - start < timeoutMs) {
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/v1/public/search',
      query: { q: 'Agentic' }
    });
    assert.equal(searchRes.statusCode, 200);
    const body = searchRes.json().data;
    
    if (body.results && body.results.length > 0) {
      const match = body.results.find((r: any) => r.title.includes('Agentic'));
      if (match) {
        assert.equal(match.content_type_slug, 'page');
        searchFound = true;
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  assert.ok(searchFound, 'Search query did not return indexed page within timeout');

  // 5. Try filter by content type slug
  const typeFilterRes = await app.inject({
    method: 'GET',
    url: '/api/v1/public/search',
    query: { q: 'Agentic', content_type: 'page' }
  });
  assert.equal(typeFilterRes.statusCode, 200);
  assert.ok(typeFilterRes.json().data.results.length > 0);

  // 6. Verify zero results queries logging
  const failedRes = await app.inject({
    method: 'GET',
    url: '/api/v1/public/search',
    query: { q: 'NonExistentGibberishKeyword' }
  });
  assert.equal(failedRes.statusCode, 200);
  assert.equal(failedRes.json().data.results.length, 0);

  // Verify search query event logged in search_queries table
  const queryLogs = await app.db('search_queries').where({ query: 'NonExistentGibberishKeyword' }).first();
  assert.ok(queryLogs);
  assert.equal(queryLogs.results_count, 0);
});
