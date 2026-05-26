/**
 * Phase 7 – CMS Pages
 *
 * Creates:
 *   • entity_views   – append-only view/impression log (shared across all content types)
 *   • pages          – page-specific fields linked to content_entities
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
  // entity_views – content impression log (no personal data stored beyond IP)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('entity_views', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.string('viewer_ip', 100).nullable();
    table.text('viewer_agent').nullable();
    table.uuid('viewer_user_id').nullable();
    table.timestamp('viewed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('viewer_user_id').references('id').inTable('users').onDelete('SET NULL');

    table.index(['content_type_id', 'entity_id']);
    table.index(['viewed_at']);
    table.index(['viewer_user_id']);
  });

  // ---------------------------------------------------------------------------
  // pages – extended metadata for static CMS pages
  // The core entity lives in content_entities; this stores page-specific fields.
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('pages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // FK back to the shared content_entities record
    table.uuid('entity_id').notNullable().unique();
    // Rich-text body (HTML from editor)
    table.text('body_html').nullable();
    // Layout template identifier (e.g. 'default', 'full-width', 'landing')
    table.string('template', 100).notNullable().defaultTo('default');
    // Short summary shown in listings / meta description fallback
    table.text('summary').nullable();
    // Optional hero/banner image URL
    table.string('hero_image_url', 2048).nullable();
    // Scheduling fields
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('archived_at', { useTz: true }).nullable();
    // Feature flags
    table.boolean('is_featured').notNullable().defaultTo(false);
    table.boolean('show_in_nav').notNullable().defaultTo(false);

    mutableAuditColumns(table, knex);

    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');

    table.index(['entity_id']);
    table.index(['is_featured']);
    table.index(['show_in_nav']);
    table.index(['deleted_at']);
  });

  await knex.schema.alterTable('pages', (table) => {
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('pages');
  await knex.schema.dropTableIfExists('entity_views');
};
