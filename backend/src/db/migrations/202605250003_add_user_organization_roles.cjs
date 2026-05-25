exports.up = async function up(knex) {
  await knex.schema.createTable('user_organization_roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.uuid('organization_id').notNullable();
    table.uuid('role_id').notNullable();
    table.timestamp('assigned_from', { useTz: true }).nullable();
    table.timestamp('assigned_to', { useTz: true }).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid('updated_by').nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');

    table.unique(['user_id', 'organization_id', 'role_id']);
    table.index(['user_id']);
    table.index(['organization_id']);
    table.index(['role_id']);
    table.index(['is_active']);
    table.index(['deleted_at']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('user_organization_roles');
};
