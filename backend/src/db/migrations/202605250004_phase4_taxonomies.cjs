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
  // 1. Create categories table
  await knex.schema.createTable('categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('slug', 255).notNullable().unique();
    table.text('description').nullable();
    table.uuid('content_type_id').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    mutableAuditColumns(table, knex);
    
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('SET NULL');
    table.index(['content_type_id']);
    table.index(['is_active']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'categories');

  // 2. Create tags table
  await knex.schema.createTable('tags', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable().unique();
    table.string('slug', 255).notNullable().unique();
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    mutableAuditColumns(table, knex);
    
    table.index(['is_active']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'tags');

  // 3. Create entity_categories polymorphic table
  await knex.schema.createTable('entity_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.uuid('category_id').notNullable();
    mutableAuditColumns(table, knex);
    
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('category_id').references('id').inTable('categories').onDelete('CASCADE');
    table.unique(['content_type_id', 'entity_id', 'category_id']);
    table.index(['content_type_id', 'entity_id']);
    table.index(['category_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'entity_categories');

  // 4. Create entity_tags polymorphic table
  await knex.schema.createTable('entity_tags', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable();
    table.uuid('tag_id').notNullable();
    mutableAuditColumns(table, knex);
    
    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('tag_id').references('id').inTable('tags').onDelete('CASCADE');
    table.unique(['content_type_id', 'entity_id', 'tag_id']);
    table.index(['content_type_id', 'entity_id']);
    table.index(['tag_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'entity_tags');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('entity_tags');
  await knex.schema.dropTableIfExists('entity_categories');
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('categories');
};
