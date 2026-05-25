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
  await knex.schema.createTable('content_entities', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.string('title', 255).notNullable();
    table.string('slug', 255).notNullable();
    table.string('status', 50).notNullable().defaultTo('draft');
    table.jsonb('payload').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    mutableAuditColumns(table, knex);

    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.unique(['content_type_id', 'slug']);
    table.index(['content_type_id']);
    table.index(['status']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'content_entities');

  await knex.raw(`
    ALTER TABLE content_entities
    ADD CONSTRAINT content_entities_status_check
    CHECK (status IN ('draft', 'review', 'published', 'archived', 'rejected'))
  `);

  await knex.schema.createTable('saved_drafts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').nullable();
    table.string('draft_key', 255).nullable();
    table.jsonb('payload').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    mutableAuditColumns(table, knex);

    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');
    table.unique(['content_type_id', 'entity_id', 'draft_key', 'created_by']);
    table.index(['content_type_id', 'entity_id']);
    table.index(['created_by']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'saved_drafts');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('saved_drafts');
  await knex.schema.dropTableIfExists('content_entities');
};
