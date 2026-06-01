const permissions = [
  ['CREATE_ANNOUNCEMENT', 'ANNOUNCEMENTS', 'Create announcements'],
  ['UPDATE_ANNOUNCEMENT', 'ANNOUNCEMENTS', 'Update announcements'],
  ['DELETE_ANNOUNCEMENT', 'ANNOUNCEMENTS', 'Delete or archive announcements'],
  ['APPROVE_ANNOUNCEMENT', 'ANNOUNCEMENTS', 'Approve and publish announcements'],
  ['CREATE_ACHIEVEMENT', 'ACHIEVEMENTS', 'Create achievements'],
  ['UPDATE_ACHIEVEMENT', 'ACHIEVEMENTS', 'Update achievements'],
  ['DELETE_ACHIEVEMENT', 'ACHIEVEMENTS', 'Delete or archive achievements'],
  ['APPROVE_ACHIEVEMENT', 'ACHIEVEMENTS', 'Approve and publish achievements'],
  ['CREATE_STORY', 'STORIES', 'Create stories'],
  ['UPDATE_STORY', 'STORIES', 'Update stories'],
  ['DELETE_STORY', 'STORIES', 'Delete or archive stories'],
  ['APPROVE_STORY', 'STORIES', 'Approve and publish stories'],
  ['CREATE_CLUB', 'CLUBS', 'Create club profiles'],
  ['UPDATE_CLUB', 'CLUBS', 'Update club profiles'],
  ['DELETE_CLUB', 'CLUBS', 'Delete or archive club profiles'],
  ['APPROVE_CLUB', 'CLUBS', 'Approve and publish club profiles']
].map(([code, module_name, description]) => ({ code, module_name, description }));

exports.up = async function up(knex) {
  await knex('permissions')
    .insert(permissions)
    .onConflict('code')
    .merge(['description', 'module_name', 'updated_at']);

  const superAdmin = await knex('roles').select('id').where({ name: 'SUPER_ADMIN' }).first();
  const latePermissions = await knex('permissions').select('id').whereIn('code', permissions.map((permission) => permission.code));

  if (superAdmin) {
    await knex('role_permissions')
      .insert(latePermissions.map((permission) => ({ role_id: superAdmin.id, permission_id: permission.id })))
      .onConflict(['role_id', 'permission_id'])
      .ignore();
  }
};

exports.down = async function down(knex) {
  const codes = permissions.map((permission) => permission.code);

  await knex('role_permissions')
    .whereIn('permission_id', knex('permissions').select('id').whereIn('code', codes))
    .del();
  await knex('permissions').whereIn('code', codes).del();
};
