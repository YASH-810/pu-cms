import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

const superAdminEmail = 'super-admin-content-framework@example.edu';
const entitySlugPrefix = 'phase5-shared-entity';

let app: FastifyInstance;
let superAdminId: string;
let token: string;

async function cleanup(): Promise<void> {
  const userIds = app.db('users').select('id').where({ email: superAdminEmail });
  await app.db('user_roles').whereIn('user_id', userIds).del();
  await app.db('users').where({ email: superAdminEmail }).del();

  const contentType = await app.db('content_types').select('id').where({ slug: 'page' }).first();
  if (contentType) {
    const entityIds = app.db('content_entities')
      .select('id')
      .where('content_type_id', contentType.id)
      .whereLike('slug', `${entitySlugPrefix}%`);

    await app.db('saved_drafts').whereIn('entity_id', entityIds.clone()).del();
    await app.db('entity_audit_logs').whereIn('entity_id', entityIds.clone()).del();
    await app.db('entity_approval_logs').whereIn('entity_id', entityIds.clone()).del();
    await app.db('entity_owners').whereIn('entity_id', entityIds.clone()).del();
    await app.db('entity_organizations').whereIn('entity_id', entityIds.clone()).del();
    await app.db('content_entities').whereIn('id', entityIds).del();
  }
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

  const [createdAdmin] = await app.db('users')
    .insert({
      email: superAdminEmail,
      full_name: 'Content Framework Admin',
      is_active: true
    })
    .returning(['id']);
  superAdminId = String(createdAdmin.id);

  const role = await app.db('roles').where({ name: 'SUPER_ADMIN' }).first();
  if (role) {
    await app.db('user_roles').insert({
      user_id: superAdminId,
      role_id: role.id
    });
  }

  token = app.jwt.sign({
    sub: superAdminId,
    email: superAdminEmail
  });
});

after(async () => {
  await cleanup();
  await app.close();
});

async function createDraft(slug: string): Promise<Record<string, unknown>> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/entities',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      content_type_slug: 'page',
      title: 'Phase 5 Shared Entity',
      slug,
      payload: {
        headline: 'Initial headline'
      }
    }
  });

  assert.equal(response.statusCode, 200);
  return response.json().data;
}

test('shared entity workflow blocks draft to published bypass', async () => {
  const created = await createDraft(`${entitySlugPrefix}-workflow`);

  const publishResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/entities/page/${created.id}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'published',
      remarks: 'Attempting to skip review'
    }
  });

  assert.equal(publishResponse.statusCode, 409);
  assert.match(publishResponse.json().errors[0].message, /Illegal status transition from draft to published/);

  const entity = await app.db('content_entities').where({ id: created.id }).first();
  assert.equal(entity.status, 'draft');
});

test('shared entity update writes old and new JSONB audit snapshots', async () => {
  const created = await createDraft(`${entitySlugPrefix}-audit`);

  const updateResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/entities/page/${created.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: 'Phase 5 Shared Entity Updated',
      payload: {
        headline: 'Updated headline'
      }
    }
  });

  assert.equal(updateResponse.statusCode, 200);

  const auditLog = await app.db('entity_audit_logs')
    .where({
      entity_id: created.id,
      action: 'update'
    })
    .first();

  assert.ok(auditLog);
  assert.equal(auditLog.old_value.title, 'Phase 5 Shared Entity');
  assert.equal(auditLog.old_value.payload.headline, 'Initial headline');
  assert.equal(auditLog.new_value.title, 'Phase 5 Shared Entity Updated');
  assert.equal(auditLog.new_value.payload.headline, 'Updated headline');
});

test('shared entity status transition writes approval log', async () => {
  const created = await createDraft(`${entitySlugPrefix}-approval`);

  const reviewResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/entities/page/${created.id}/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      status: 'review',
      remarks: 'Ready for review'
    }
  });

  assert.equal(reviewResponse.statusCode, 200);

  const approvalLog = await app.db('entity_approval_logs')
    .where({
      entity_id: created.id,
      status_from: 'draft',
      status_to: 'review'
    })
    .first();

  assert.ok(approvalLog);
  assert.equal(approvalLog.remarks, 'Ready for review');
});
