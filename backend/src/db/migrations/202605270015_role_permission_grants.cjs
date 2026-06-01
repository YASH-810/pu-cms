const rolePermissionMap = {
  UNIVERSITY_ADMIN: [
    'CREATE_PAGE', 'UPDATE_PAGE', 'DELETE_PAGE', 'PUBLISH_PAGE',
    'CREATE_BLOG', 'UPDATE_BLOG', 'DELETE_BLOG', 'PUBLISH_BLOG',
    'CREATE_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT', 'PUBLISH_EVENT',
    'CREATE_ANNOUNCEMENT', 'UPDATE_ANNOUNCEMENT', 'DELETE_ANNOUNCEMENT', 'APPROVE_ANNOUNCEMENT',
    'CREATE_ACHIEVEMENT', 'UPDATE_ACHIEVEMENT', 'DELETE_ACHIEVEMENT', 'APPROVE_ACHIEVEMENT',
    'CREATE_STORY', 'UPDATE_STORY', 'DELETE_STORY', 'APPROVE_STORY',
    'CREATE_CLUB', 'UPDATE_CLUB', 'DELETE_CLUB', 'APPROVE_CLUB',
    'MANAGE_MEDIA', 'MANAGE_USERS', 'MANAGE_ROLES', 'REVIEW_CONTENT', 'APPROVE_CONTENT', 'MANAGE_SEO'
  ],
  SCHOOL_ADMIN: [
    'CREATE_PAGE', 'UPDATE_PAGE', 'DELETE_PAGE', 'PUBLISH_PAGE',
    'CREATE_BLOG', 'UPDATE_BLOG', 'DELETE_BLOG', 'PUBLISH_BLOG',
    'CREATE_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT', 'PUBLISH_EVENT',
    'CREATE_ANNOUNCEMENT', 'UPDATE_ANNOUNCEMENT', 'DELETE_ANNOUNCEMENT', 'APPROVE_ANNOUNCEMENT',
    'CREATE_ACHIEVEMENT', 'UPDATE_ACHIEVEMENT', 'DELETE_ACHIEVEMENT', 'APPROVE_ACHIEVEMENT',
    'CREATE_STORY', 'UPDATE_STORY', 'DELETE_STORY', 'APPROVE_STORY',
    'CREATE_CLUB', 'UPDATE_CLUB', 'DELETE_CLUB', 'APPROVE_CLUB',
    'MANAGE_MEDIA', 'MANAGE_USERS', 'REVIEW_CONTENT', 'APPROVE_CONTENT', 'MANAGE_SEO'
  ],
  EDITOR: [
    'CREATE_PAGE', 'UPDATE_PAGE', 'DELETE_PAGE',
    'CREATE_BLOG', 'UPDATE_BLOG', 'DELETE_BLOG',
    'CREATE_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT',
    'CREATE_ANNOUNCEMENT', 'UPDATE_ANNOUNCEMENT', 'DELETE_ANNOUNCEMENT',
    'CREATE_ACHIEVEMENT', 'UPDATE_ACHIEVEMENT', 'DELETE_ACHIEVEMENT',
    'CREATE_STORY', 'UPDATE_STORY', 'DELETE_STORY',
    'CREATE_CLUB', 'UPDATE_CLUB', 'DELETE_CLUB',
    'MANAGE_MEDIA', 'REVIEW_CONTENT'
  ],
  REVIEWER: [
    'REVIEW_CONTENT', 'APPROVE_CONTENT',
    'APPROVE_ANNOUNCEMENT', 'APPROVE_ACHIEVEMENT', 'APPROVE_STORY', 'APPROVE_CLUB'
  ],
  CONTENT_CREATOR: [
    'CREATE_PAGE', 'UPDATE_PAGE',
    'CREATE_BLOG', 'UPDATE_BLOG',
    'CREATE_EVENT', 'UPDATE_EVENT',
    'CREATE_ANNOUNCEMENT', 'UPDATE_ANNOUNCEMENT',
    'CREATE_ACHIEVEMENT', 'UPDATE_ACHIEVEMENT',
    'CREATE_STORY', 'UPDATE_STORY',
    'CREATE_CLUB', 'UPDATE_CLUB',
    'MANAGE_MEDIA', 'REVIEW_CONTENT'
  ]
};

exports.up = async function up(knex) {
  const roles = await knex('roles').select('id', 'name').whereIn('name', Object.keys(rolePermissionMap));
  const permissions = await knex('permissions')
    .select('id', 'code')
    .whereIn('code', [...new Set(Object.values(rolePermissionMap).flat())]);

  const roleByName = Object.fromEntries(roles.map((role) => [role.name, role.id]));
  const permissionByCode = Object.fromEntries(permissions.map((permission) => [permission.code, permission.id]));

  const grants = [];
  for (const [roleName, permissionCodes] of Object.entries(rolePermissionMap)) {
    for (const permissionCode of permissionCodes) {
      if (roleByName[roleName] && permissionByCode[permissionCode]) {
        grants.push({
          role_id: roleByName[roleName],
          permission_id: permissionByCode[permissionCode]
        });
      }
    }
  }

  if (grants.length) {
    await knex('role_permissions')
      .insert(grants)
      .onConflict(['role_id', 'permission_id'])
      .ignore();
  }
};

exports.down = async function down(knex) {
  const roleNames = Object.keys(rolePermissionMap);
  const permissionCodes = [...new Set(Object.values(rolePermissionMap).flat())];

  await knex('role_permissions')
    .whereIn('role_id', knex('roles').select('id').whereIn('name', roleNames))
    .whereIn('permission_id', knex('permissions').select('id').whereIn('code', permissionCodes))
    .del();
};
