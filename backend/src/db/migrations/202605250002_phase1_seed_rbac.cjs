const roles = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full system access',
    hierarchy_level: 1
  },
  {
    name: 'UNIVERSITY_ADMIN',
    description: 'Manage university-wide content',
    hierarchy_level: 2
  },
  {
    name: 'SCHOOL_ADMIN',
    description: 'Manage school/faculty content',
    hierarchy_level: 3
  },
  {
    name: 'EDITOR',
    description: 'Edit assigned content',
    hierarchy_level: 4
  },
  {
    name: 'REVIEWER',
    description: 'Review submitted content',
    hierarchy_level: 5
  },
  {
    name: 'CONTENT_CREATOR',
    description: 'Create draft content only',
    hierarchy_level: 6
  }
];

const permissions = [
  ['CREATE_PAGE', 'PAGES', 'Create CMS pages'],
  ['UPDATE_PAGE', 'PAGES', 'Update CMS pages'],
  ['DELETE_PAGE', 'PAGES', 'Delete or archive CMS pages'],
  ['PUBLISH_PAGE', 'PAGES', 'Publish CMS pages'],
  ['CREATE_BLOG', 'BLOGS', 'Create blogs and news articles'],
  ['UPDATE_BLOG', 'BLOGS', 'Update blogs and news articles'],
  ['DELETE_BLOG', 'BLOGS', 'Delete or archive blogs and news articles'],
  ['PUBLISH_BLOG', 'BLOGS', 'Publish blogs and news articles'],
  ['CREATE_EVENT', 'EVENTS', 'Create events'],
  ['UPDATE_EVENT', 'EVENTS', 'Update events'],
  ['DELETE_EVENT', 'EVENTS', 'Delete or archive events'],
  ['PUBLISH_EVENT', 'EVENTS', 'Publish events'],
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
  ['APPROVE_CLUB', 'CLUBS', 'Approve and publish club profiles'],
  ['MANAGE_MEDIA', 'MEDIA', 'Manage media assets'],
  ['MANAGE_USERS', 'USERS', 'Manage users'],
  ['MANAGE_ROLES', 'RBAC', 'Manage roles and permissions'],
  ['REVIEW_CONTENT', 'WORKFLOW', 'Review submitted content'],
  ['APPROVE_CONTENT', 'WORKFLOW', 'Approve submitted content'],
  ['MANAGE_SEO', 'SEO', 'Manage SEO metadata']
].map(([code, module_name, description]) => ({ code, module_name, description }));

const contentTypes = [
  ['Page', 'pages', 'page', 'Static CMS pages'],
  ['Blog', 'blogs', 'blog', 'Blog posts and news articles'],
  ['Event', 'events', 'event', 'University events'],
  ['Achievement', 'achievements', 'achievement', 'Awards and institutional achievements'],
  ['Announcement', 'announcements', 'announcement', 'University notices'],
  ['Story', 'stories', 'story', 'Success stories and testimonials'],
  ['Club', 'club_details', 'club', 'Club profile content backed by organizations']
].map(([name, table_name, slug, description]) => ({ name, table_name, slug, description }));

exports.up = async function up(knex) {
  await knex('roles')
    .insert(roles)
    .onConflict('name')
    .merge(['description', 'hierarchy_level', 'updated_at']);

  await knex('permissions')
    .insert(permissions)
    .onConflict('code')
    .merge(['description', 'module_name', 'updated_at']);

  await knex('content_types')
    .insert(contentTypes)
    .onConflict('slug')
    .merge(['name', 'table_name', 'description', 'updated_at']);

  const superAdmin = await knex('roles').select('id').where({ name: 'SUPER_ADMIN' }).first();
  const allPermissions = await knex('permissions').select('id');

  if (superAdmin) {
    await knex('role_permissions')
      .insert(
        allPermissions.map((permission) => ({
          role_id: superAdmin.id,
          permission_id: permission.id
        }))
      )
      .onConflict(['role_id', 'permission_id'])
      .ignore();
  }
};

exports.down = async function down(knex) {
  const permissionCodes = permissions.map((permission) => permission.code);
  const roleNames = roles.map((role) => role.name);
  const contentTypeSlugs = contentTypes.map((contentType) => contentType.slug);

  await knex('role_permissions')
    .whereIn('permission_id', knex('permissions').select('id').whereIn('code', permissionCodes))
    .orWhereIn('role_id', knex('roles').select('id').whereIn('name', roleNames))
    .del();

  await knex('permissions').whereIn('code', permissionCodes).del();
  await knex('roles').whereIn('name', roleNames).del();
  await knex('content_types').whereIn('slug', contentTypeSlugs).del();
};
