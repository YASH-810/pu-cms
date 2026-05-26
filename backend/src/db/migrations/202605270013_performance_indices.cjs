exports.up = async function (knex) {
  // Add index on entity_views for fast lookups by content_type_id and entity_id
  await knex.schema.alterTable('entity_views', (table) => {
    table.index(['content_type_id', 'entity_id'], 'idx_entity_views_type_entity');
    table.index(['viewed_at'], 'idx_entity_views_viewed_at');
  });

  // Add index on notifications for fast lookups by user_id and is_read
  await knex.schema.alterTable('notifications', (table) => {
    table.index(['user_id', 'is_read'], 'idx_notifications_user_read');
  });

  // Add index on scheduled_jobs for fast polling
  await knex.schema.alterTable('scheduled_jobs', (table) => {
    table.index(['is_active', 'next_run_at'], 'idx_scheduled_jobs_polling');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('scheduled_jobs', (table) => {
    table.dropIndex(['is_active', 'next_run_at'], 'idx_scheduled_jobs_polling');
  });

  await knex.schema.alterTable('notifications', (table) => {
    table.dropIndex(['user_id', 'is_read'], 'idx_notifications_user_read');
  });

  await knex.schema.alterTable('entity_views', (table) => {
    table.dropIndex(['viewed_at'], 'idx_entity_views_viewed_at');
    table.dropIndex(['content_type_id', 'entity_id'], 'idx_entity_views_type_entity');
  });
};
