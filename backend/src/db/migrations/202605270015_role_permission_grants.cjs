const grants = {
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
    'MANAGE_MEDIA', 'REVIEW_CONTENT', 'APPROVE_CONTENT', 'MANAGE_SEO'
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
  for (const [roleName, permissionCodes] of Object.entries(grants)) {
    const role = await knex('roles').select('id').where({ name: roleName }).first();
    if (!role) continue;

    const permissions = await knex('permissions').select('id').whereIn('code', permissionCodes);

    if (permissions.length > 0) {
      await knex('role_permissions')
        .insert(permissions.map((permission) => ({ role_id: role.id, permission_id: permission.id })))
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }
  }
};

exports.down = async function down(knex) {
  for (const [roleName, permissionCodes] of Object.entries(grants)) {
    const role = await knex('roles').select('id').where({ name: roleName }).first();
    if (!role) continue;

    await knex('role_permissions')
      .where({ role_id: role.id })
      .whereIn('permission_id', knex('permissions').select('id').whereIn('code', permissionCodes))
      .del();
  }
};
