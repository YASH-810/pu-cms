/**
 * Phase 12 – Notifications, Scheduler, Search, and Analytics
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
  // 1. Alter content_entities to add scheduling fields and update status constraint
  await knex.schema.alterTable('content_entities', (table) => {
    table.timestamp('scheduled_publish_at', { useTz: true }).nullable();
    table.timestamp('scheduled_archive_at', { useTz: true }).nullable();
  });

  await knex.raw(`
    ALTER TABLE content_entities DROP CONSTRAINT IF EXISTS content_entities_status_check
  `);

  await knex.raw(`
    ALTER TABLE content_entities
    ADD CONSTRAINT content_entities_status_check
    CHECK (status IN ('draft', 'review', 'published', 'archived', 'rejected', 'scheduled'))
  `);

  // 2. notification_templates
  await knex.schema.createTable('notification_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code', 100).notNullable().unique();
    table.string('subject_template', 255).notNullable();
    table.text('body_template').notNullable();
    mutableAuditColumns(table, knex);
    table.index(['code']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'notification_templates');

  // 3. notifications
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.string('title', 255).notNullable();
    table.text('body').notNullable();
    table.string('action_url', 2048).nullable();
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('read_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id']);
    table.index(['is_read']);
    table.index(['created_at']);
  });

  // 4. scheduled_jobs
  await knex.schema.createTable('scheduled_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('job_name', 100).notNullable().unique();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.string('cron_expression_or_interval', 100).notNullable();
    table.timestamp('last_run_at', { useTz: true }).nullable();
    table.timestamp('next_run_at', { useTz: true }).nullable();
    mutableAuditColumns(table, knex);
    table.index(['job_name']);
    table.index(['is_active']);
    table.index(['deleted_at']);
  });
  await addAuditForeignKeys(knex, 'scheduled_jobs');

  // 5. job_execution_logs
  await knex.schema.createTable('job_execution_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('job_name', 100).notNullable();
    table.string('status', 50).notNullable(); // 'running', 'completed', 'failed'
    table.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at', { useTz: true }).nullable();
    table.text('error_message').nullable();
    table.integer('retry_count').notNullable().defaultTo(0);

    table.index(['job_name']);
    table.index(['status']);
    table.index(['started_at']);
  });

  // 6. search_index
  await knex.schema.createTable('search_index', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_type_id').notNullable();
    table.uuid('entity_id').notNullable().unique();
    table.text('title').notNullable();
    table.text('body').notNullable();
    table.specificType('organization_ids', 'UUID[]').notNullable().defaultTo('{}');
    table.specificType('category_ids', 'UUID[]').notNullable().defaultTo('{}');
    table.specificType('tag_ids', 'UUID[]').notNullable().defaultTo('{}');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.string('status', 50).notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.foreign('content_type_id').references('id').inTable('content_types').onDelete('CASCADE');
    table.foreign('entity_id').references('id').inTable('content_entities').onDelete('CASCADE');
    table.index(['content_type_id']);
    table.index(['entity_id']);
    table.index(['is_active']);
    table.index(['status']);
  });

  // GIN Index for full-text search
  await knex.raw(`
    ALTER TABLE search_index ADD COLUMN tsv tsvector;
    CREATE INDEX search_index_tsv_idx ON search_index USING gin(tsv);
  `);

  // 7. search_queries
  await knex.schema.createTable('search_queries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('query', 255).notNullable();
    table.uuid('user_id').nullable();
    table.integer('results_count').notNullable().defaultTo(0);
    table.timestamp('searched_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.index(['query']);
    table.index(['searched_at']);
  });

  // Seed default templates
  await knex('notification_templates').insert([
    {
      code: 'content_submission',
      subject_template: 'New Content Submission: {title}',
      body_template: 'Entity {title} has been submitted for review. Remarks: {remarks}',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      code: 'content_approval',
      subject_template: 'Content Approved: {title}',
      body_template: 'Your submission {title} has been approved. Remarks: {remarks}',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      code: 'content_rejection',
      subject_template: 'Content Rejected: {title}',
      body_template: 'Your submission {title} was rejected. Remarks: {remarks}',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      code: 'content_publication',
      subject_template: 'Content Published: {title}',
      body_template: 'Your entity {title} has been published successfully. Remarks: {remarks}',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      code: 'job_failed',
      subject_template: 'Background Job Failure: {job_name}',
      body_template: 'Scheduled background task {job_name} failed to run. Error: {error_message}',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      code: 'permission_changed',
      subject_template: 'Permissions Updated',
      body_template: 'Your global or scoped permissions have been updated. Please sign in again to refresh context.',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  // Seed scheduled_jobs
  await knex('scheduled_jobs').insert([
    {
      job_name: 'scheduled_publishing',
      is_active: true,
      cron_expression_or_interval: '1m',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      job_name: 'automated_archival',
      is_active: true,
      cron_expression_or_interval: '5m',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      job_name: 'generate_sitemap',
      is_active: true,
      cron_expression_or_interval: '24h',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      job_name: 'job_retry',
      is_active: true,
      cron_expression_or_interval: '5m',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('search_queries');
  await knex.schema.dropTableIfExists('search_index');
  await knex.schema.dropTableIfExists('job_execution_logs');
  await knex.schema.dropTableIfExists('scheduled_jobs');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('notification_templates');

  await knex.schema.alterTable('content_entities', (table) => {
    table.dropColumn('scheduled_archive_at');
    table.dropColumn('scheduled_publish_at');
  });

  await knex.raw(`
    ALTER TABLE content_entities DROP CONSTRAINT IF EXISTS content_entities_status_check
  `);

  await knex.raw(`
    ALTER TABLE content_entities
    ADD CONSTRAINT content_entities_status_check
    CHECK (status IN ('draft', 'review', 'published', 'archived', 'rejected'))
  `);
};
