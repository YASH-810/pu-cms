/**
 * Phase 10 – Announcements
 *
 * Creates:
 *   • announcement_types – Master table for announcement types
 *   • announcements      – Announcement-specific fields linked to content_entities
 */

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
  // ---------------------------------------------------------------------------
  // announcement_types
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('announcement_types', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.string('slug', 100).notNullable().unique();
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    mutableAuditColumns(table, knex);

    table.index(['is_active']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'announcement_types');

  // Seed types
  await knex('announcement_types').insert([
    {
      name: 'Title plus PDF',
      slug: 'title_plus_pdf',
      description: 'Announcement with a title and a PDF link',
      is_active: true
    },
    {
      name: 'Title plus Description',
      slug: 'title_plus_description',
      description: 'Announcement with a title and a text summary/description',
      is_active: true
    },
    {
      name: 'Full Content',
      slug: 'full_content',
      description: 'Announcement with rich-text HTML body content',
      is_active: true
    }
  ]);

  // ---------------------------------------------------------------------------
  // announcements
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('announcements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // FK back to shared content_entities record
    table.uuid('entity_id').notNullable().unique();
    // FK to type
    table.uuid('announcement_type_id').notNullable();
    // Fields
    table.text('summary').nullable();
    table.text('body_html').nullable();
    table.string('pdf_url', 2048).nullable();
    table.string('priority', 50).notNullable().defaultTo('medium');
    // Validity dates
    table.timestamp('valid_from', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('valid_until', { useTz: true }).nullable();
    // Scheduling fields
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('archived_at', { useTz: true }).nullable();

    mutableAuditColumns(table, knex);

    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');
    table.foreign('announcement_type_id').references('id').inTable('announcement_types').onDelete('RESTRICT');

    table.index(['entity_id']);
    table.index(['announcement_type_id']);
    table.index(['priority']);
    table.index(['valid_from']);
    table.index(['valid_until']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'announcements');

  await knex.raw(`
    ALTER TABLE announcements
    ADD CONSTRAINT announcements_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical'))
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('announcements');
  await knex.schema.dropTableIfExists('announcement_types');
};
