const mutableAuditColumns = (table, knex, includeDeletedAt = true) => {
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  table.uuid('created_by').nullable();
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  table.uuid('updated_by').nullable();

  if (includeDeletedAt) {
    table.timestamp('deleted_at', { useTz: true }).nullable();
  }
};

const addAuditForeignKeys = async (knex, tableName) => {
  await knex.schema.alterTable(tableName, (table) => {
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 320).notNullable().unique();
    table.string('full_name', 255).notNullable();
    table.string('profile_image', 2048).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_login_at', { useTz: true }).nullable();
    mutableAuditColumns(table, knex);
    table.index(['email']);
    table.index(['is_active']);
    table.index(['deleted_at']);
  });

  await knex.schema.alterTable('users', (table) => {
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });

  await knex.schema.createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.text('description').nullable();
    table.integer('hierarchy_level').notNullable();
    mutableAuditColumns(table, knex);
    table.unique(['hierarchy_level']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'roles');

  await knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code', 100).notNullable().unique();
    table.text('description').nullable();
    table.string('module_name', 100).notNullable();
    mutableAuditColumns(table, knex);
    table.index(['module_name']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'permissions');

  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('org_type', 50).notNullable();
    table.uuid('parent_id').nullable();
    table.string('slug', 255).notNullable().unique();
    table.string('short_name', 100).nullable();
    table.string('code', 100).nullable();
    table.text('description').nullable();
    table.string('logo_url', 2048).nullable();
    table.string('banner_image', 2048).nullable();
    table.string('contact_email', 320).nullable();
    table.string('contact_phone', 50).nullable();
    table.string('website_url', 2048).nullable();
    table.text('address').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    mutableAuditColumns(table, knex);
    table.foreign('parent_id').references('id').inTable('organizations').onDelete('RESTRICT');
    table.index(['parent_id']);
    table.index(['org_type']);
    table.index(['is_active']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'organizations');

  await knex.raw(`
    ALTER TABLE organizations
    ADD CONSTRAINT organizations_org_type_check
    CHECK (org_type IN ('university', 'school', 'department', 'program', 'center', 'club', 'office', 'exam_cell', 'sports'))
  `);

  await knex.schema.createTable('organization_relations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('parent_org_id').notNullable();
    table.uuid('child_org_id').notNullable();
    table.string('relation_type', 100).notNullable();
    table.text('remarks').nullable();
    mutableAuditColumns(table, knex);
    table.foreign('parent_org_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.foreign('child_org_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.unique(['parent_org_id', 'child_org_id', 'relation_type']);
    table.index(['parent_org_id']);
    table.index(['child_org_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'organization_relations');

  await knex.schema.createTable('content_types', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.string('table_name', 100).notNullable().unique();
    table.string('slug', 100).notNullable().unique();
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    mutableAuditColumns(table, knex);
    table.index(['is_active']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'content_types');

  await knex.schema.createTable('user_roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.uuid('role_id').notNullable();
    mutableAuditColumns(table, knex);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    table.unique(['user_id', 'role_id']);
    table.index(['user_id']);
    table.index(['role_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'user_roles');

  await knex.schema.createTable('role_permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('role_id').notNullable();
    table.uuid('permission_id').notNullable();
    mutableAuditColumns(table, knex);
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
    table.unique(['role_id', 'permission_id']);
    table.index(['role_id']);
    table.index(['permission_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'role_permissions');

  await knex.schema.createTable('user_scope_permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.uuid('permission_id').notNullable();
    table.uuid('organization_id').nullable();
    table.uuid('content_type_id').nullable();
    mutableAuditColumns(table, knex);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.unique(['user_id', 'permission_id', 'organization_id', 'content_type_id']);
    table.index(['user_id']);
    table.index(['permission_id']);
    table.index(['organization_id']);
    table.index(['content_type_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'user_scope_permissions');

  await knex.schema.createTable('user_login_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.timestamp('login_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.string('ip_address', 100).nullable();
    table.text('user_agent').nullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id']);
    table.index(['login_at']);
  });

  await knex.schema.createTable('entity_organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.uuid('organization_id').notNullable();
    table.string('relation_type', 100).notNullable().defaultTo('primary');
    mutableAuditColumns(table, knex);
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.unique(['content_type_id', 'entity_id', 'organization_id', 'relation_type']);
    table.index(['content_type_id', 'entity_id']);
    table.index(['organization_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'entity_organizations');

  await knex.schema.createTable('entity_owners', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.uuid('user_id').notNullable();
    table.string('ownership_type', 50).notNullable();
    mutableAuditColumns(table, knex);
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['content_type_id', 'entity_id', 'user_id', 'ownership_type']);
    table.index(['content_type_id', 'entity_id']);
    table.index(['user_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'entity_owners');

  await knex.raw(`
    ALTER TABLE entity_owners
    ADD CONSTRAINT entity_owners_ownership_type_check
    CHECK (ownership_type IN ('creator', 'editor', 'reviewer', 'publisher'))
  `);

  await knex.schema.createTable('entity_approval_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.string('status_from', 50).nullable();
    table.string('status_to', 50).notNullable();
    table.text('remarks').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.index(['content_type_id', 'entity_id']);
    table.index(['created_at']);
    table.index(['status_to']);
  });

  await knex.schema.createTable('entity_audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.string('action', 100).notNullable();
    table.uuid('performed_by').nullable();
    table.jsonb('old_value').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.jsonb('new_value').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.string('ip_address', 100).nullable();
    table.text('user_agent').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('performed_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.index(['content_type_id', 'entity_id']);
    table.index(['created_at']);
    table.index(['action']);
  });

  await knex.schema.createTable('media', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').nullable();
    table.uuid('entity_id').nullable();
    table.string('media_type', 50).notNullable();
    table.string('media_category', 100).nullable();
    table.string('media_url', 2048).notNullable();
    table.string('thumbnail_url', 2048).nullable();
    table.text('alt_text').nullable();
    table.text('caption').nullable();
    table.string('mime_type', 255).notNullable();
    table.bigInteger('file_size').nullable();
    table.integer('width').nullable();
    table.integer('height').nullable();
    table.integer('duration').nullable();
    table.integer('display_order').notNullable().defaultTo(1);
    table.boolean('is_featured').notNullable().defaultTo(false);
    table.uuid('uploaded_by').nullable();
    mutableAuditColumns(table, knex);
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('SET NULL');
    table.foreign('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
    table.index(['content_type_id', 'entity_id']);
    table.index(['media_type']);
    table.index(['is_featured']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'media');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('media');
  await knex.schema.dropTableIfExists('entity_audit_logs');
  await knex.schema.dropTableIfExists('entity_approval_logs');
  await knex.schema.dropTableIfExists('entity_owners');
  await knex.schema.dropTableIfExists('entity_organizations');
  await knex.schema.dropTableIfExists('user_login_logs');
  await knex.schema.dropTableIfExists('user_scope_permissions');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('content_types');
  await knex.schema.dropTableIfExists('organization_relations');
  await knex.schema.dropTableIfExists('organizations');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('users');
};
