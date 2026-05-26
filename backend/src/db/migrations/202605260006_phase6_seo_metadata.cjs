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
  await knex.schema.createTable('seo_metadata', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.string('language_code', 10).notNullable().defaultTo('en');

    // Core SEO fields
    table.string('meta_title', 255).nullable();
    table.text('meta_description').nullable();
    table.text('meta_keywords').nullable();
    table.string('canonical_url', 2048).nullable();
    table.string('robots', 100).nullable().defaultTo('index,follow');

    // OpenGraph fields
    table.string('og_title', 255).nullable();
    table.text('og_description').nullable();
    table.string('og_image_url', 2048).nullable();

    // Twitter Card fields
    table.string('twitter_title', 255).nullable();
    table.text('twitter_description').nullable();
    table.string('twitter_image_url', 2048).nullable();
    table.string('twitter_card_type', 50).nullable().defaultTo('summary_large_image');

    // Structured data
    table.jsonb('schema_markup').nullable().defaultTo(knex.raw("'null'::jsonb"));

    mutableAuditColumns(table, knex);

    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');

    // One SEO record per entity per language
    table.unique(['content_type_id', 'entity_id', 'language_code']);

    table.index(['content_type_id', 'entity_id']);
    table.index(['language_code']);
    table.index(['deleted_at']);
  });

  await addAuditForeignKeys(knex, 'seo_metadata');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('seo_metadata');
};
