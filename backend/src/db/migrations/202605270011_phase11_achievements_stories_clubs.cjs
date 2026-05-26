/**
 * Phase 11 – Achievements, Stories, and Clubs
 *
 * Creates:
 *   • achievements  – Achievements-specific fields linked to content_entities
 *   • stories       – Stories-specific fields linked to content_entities
 *   • club_details  – Club-specific fields linked to content_entities and organizations
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
  // achievements
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('achievements', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('entity_id').notNullable().unique();
    table.string('achievement_type', 100).notNullable();
    table.string('level', 100).notNullable();
    table.timestamp('awarded_at', { useTz: true }).notNullable();
    table.string('awarded_by', 255).notNullable();
    table.decimal('prize_amount', 12, 2).nullable();
    table.boolean('is_featured').notNullable().defaultTo(false);
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('archived_at', { useTz: true }).nullable();

    mutableAuditColumns(table, knex);

    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');

    table.index(['entity_id']);
    table.index(['achievement_type']);
    table.index(['level']);
    table.index(['awarded_at']);
    table.index(['is_featured']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'achievements');

  await knex.raw(`
    ALTER TABLE achievements
    ADD CONSTRAINT achievements_level_check
    CHECK (level IN ('international', 'national', 'state', 'university', 'school'))
  `);

  // ---------------------------------------------------------------------------
  // stories
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('stories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('entity_id').notNullable().unique();
    table.string('story_type', 100).notNullable();
    table.string('person_name', 255).notNullable();
    table.string('person_role', 100).notNullable();
    table.string('company', 255).nullable();
    table.integer('graduation_year').nullable();
    table.string('linkedin_url', 2048).nullable();
    table.boolean('is_featured').notNullable().defaultTo(false);
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('archived_at', { useTz: true }).nullable();

    mutableAuditColumns(table, knex);

    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');

    table.index(['entity_id']);
    table.index(['story_type']);
    table.index(['person_role']);
    table.index(['is_featured']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'stories');

  await knex.raw(`
    ALTER TABLE stories
    ADD CONSTRAINT stories_person_role_check
    CHECK (person_role IN ('student', 'alumnus', 'researcher', 'faculty', 'other'))
  `);

  // ---------------------------------------------------------------------------
  // club_details
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('club_details', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('entity_id').notNullable().unique();
    table.uuid('organization_id').notNullable();
    table.jsonb('leadership').nullable();
    table.jsonb('social_links').nullable();
    table.text('meeting_schedule').nullable();
    table.text('joining_process').nullable();
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('archived_at', { useTz: true }).nullable();

    mutableAuditColumns(table, knex);

    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');
    table.foreign('organization_id').references('id').inTable('organizations').onDelete('RESTRICT');

    table.index(['entity_id']);
    table.index(['organization_id']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'club_details');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('club_details');
  await knex.schema.dropTableIfExists('stories');
  await knex.schema.dropTableIfExists('achievements');
};
