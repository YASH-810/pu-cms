/**
 * Phase 8 – Blogs and News
 *
 * Creates:
 *   • blogs – blog-specific fields linked to content_entities and users (authors)
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

exports.up = async function up(knex) {
  // ---------------------------------------------------------------------------
  // blogs – extended metadata for blogs and news articles
  // The core entity lives in content_entities; this stores blog-specific fields.
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('blogs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // FK back to the shared content_entities record
    table.uuid('entity_id').notNullable().unique();
    // Rich-text body (HTML from editor)
    table.text('body_html').nullable();
    // Short summary shown in listings / meta description fallback
    table.text('summary').nullable();
    // Optional hero/banner image URL
    table.string('hero_image_url', 2048).nullable();
    // Author attribution - references users.id
    table.uuid('author_id').nullable();
    // Calculated reading time in minutes
    table.integer('reading_time').notNullable().defaultTo(0);
    // Scheduling fields
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('archived_at', { useTz: true }).nullable();
    // Feature & pinning flags
    table.boolean('is_featured').notNullable().defaultTo(false);
    table.boolean('is_pinned').notNullable().defaultTo(false);

    mutableAuditColumns(table, knex);

    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');
    table.foreign('author_id').references('id').inTable('users').onDelete('SET NULL');

    table.index(['entity_id']);
    table.index(['author_id']);
    table.index(['is_featured']);
    table.index(['is_pinned']);
    table.index(['deleted_at']);
  });

  await knex.schema.alterTable('blogs', (table) => {
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('blogs');
};
