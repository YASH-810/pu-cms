/**
 * Phase 9 – Events
 *
 * Creates:
 *   • events – event-specific fields linked to content_entities
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
  // events – extended metadata for university events
  // The core entity lives in content_entities; this stores event-specific fields.
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // FK back to the shared content_entities record
    table.uuid('entity_id').notNullable().unique();
    // Event specific metadata
    table.string('event_type', 100).notNullable();
    table.string('event_mode', 50).notNullable();
    table.text('venue').nullable();
    table.string('organizer', 255).nullable();
    table.string('registration_link', 2048).nullable();
    table.string('contact_email', 320).nullable();
    table.string('contact_phone', 50).nullable();
    // Timing and timezone
    table.timestamp('start_at', { useTz: true }).notNullable();
    table.timestamp('end_at', { useTz: true }).notNullable();
    table.string('timezone', 100).notNullable().defaultTo('UTC');
    table.timestamp('registration_deadline_at', { useTz: true }).nullable();
    // Registration constraints
    table.integer('max_participants').nullable();
    // Scheduling fields
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('archived_at', { useTz: true }).nullable();
    // Featured event state
    table.boolean('is_featured').notNullable().defaultTo(false);

    mutableAuditColumns(table, knex);

    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');

    table.index(['entity_id']);
    table.index(['event_type']);
    table.index(['event_mode']);
    table.index(['start_at']);
    table.index(['is_featured']);
    table.index(['deleted_at']);
  });

  await knex.raw(`
    ALTER TABLE events
    ADD CONSTRAINT events_event_mode_check
    CHECK (event_mode IN ('online', 'offline', 'hybrid'))
  `);

  await knex.raw(`
    ALTER TABLE events
    ADD CONSTRAINT events_dates_check
    CHECK (start_at < end_at)
  `);

  await knex.schema.alterTable('events', (table) => {
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('events');
};
