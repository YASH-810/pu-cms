import 'dotenv/config';
import { createDatabaseConnection } from '../src/db/connection.js';

const db = createDatabaseConnection({
  NODE_ENV: 'local',
  HOST: process.env.HOST ?? '127.0.0.1',
  PORT: Number(process.env.PORT ?? 4000),
  LOG_LEVEL: 'info',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:1234@localhost:5432/postgres',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'local',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'local',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/api/v1/admin/auth/google/callback',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'local-development-secret'
});

const rolePermissionMap: Record<string, string[]> = {
  'UNIVERSITY_ADMIN': [
    'CREATE_PAGE', 'UPDATE_PAGE', 'DELETE_PAGE', 'PUBLISH_PAGE',
    'CREATE_BLOG', 'UPDATE_BLOG', 'DELETE_BLOG', 'PUBLISH_BLOG',
    'CREATE_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT', 'PUBLISH_EVENT',
    'MANAGE_MEDIA', 'MANAGE_USERS', 'REVIEW_CONTENT', 'APPROVE_CONTENT', 'MANAGE_SEO'
  ],
  'SCHOOL_ADMIN': [
    'CREATE_PAGE', 'UPDATE_PAGE', 'DELETE_PAGE', 'PUBLISH_PAGE',
    'CREATE_BLOG', 'UPDATE_BLOG', 'DELETE_BLOG', 'PUBLISH_BLOG',
    'CREATE_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT', 'PUBLISH_EVENT',
    'MANAGE_MEDIA', 'REVIEW_CONTENT', 'APPROVE_CONTENT', 'MANAGE_SEO'
  ],
  'EDITOR': [
    'CREATE_PAGE', 'UPDATE_PAGE', 'DELETE_PAGE',
    'CREATE_BLOG', 'UPDATE_BLOG', 'DELETE_BLOG',
    'CREATE_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT',
    'MANAGE_MEDIA', 'REVIEW_CONTENT'
  ],
  'REVIEWER': [
    'REVIEW_CONTENT', 'APPROVE_CONTENT'
  ],
  'CONTENT_CREATOR': [
    'CREATE_PAGE', 'UPDATE_PAGE', 'CREATE_BLOG', 'UPDATE_BLOG', 'CREATE_EVENT', 'UPDATE_EVENT', 'MANAGE_MEDIA', 'REVIEW_CONTENT'
  ]
};

async function seedPermissions() {
  try {
    const roles = await db('roles').select('id', 'name');
    const permissions = await db('permissions').select('id', 'code');

    const roleMap = Object.fromEntries(roles.map(r => [r.name, r.id]));
    const permMap = Object.fromEntries(permissions.map(p => [p.code, p.id]));

    for (const [roleName, permCodes] of Object.entries(rolePermissionMap)) {
      const roleId = roleMap[roleName];
      if (!roleId) {
        console.warn(`Role ${roleName} not found in DB. Skipping.`);
        continue;
      }

      const inserts = [];
      for (const code of permCodes) {
        const permId = permMap[code];
        if (!permId) {
          console.warn(`Permission ${code} not found in DB. Skipping.`);
          continue;
        }
        inserts.push({
          role_id: roleId,
          permission_id: permId
        });
      }

      if (inserts.length > 0) {
        await db('role_permissions')
          .insert(inserts)
          .onConflict(['role_id', 'permission_id'])
          .ignore();
        
        console.log(`Seeded ${inserts.length} permissions for ${roleName}`);
      }
    }
    console.log('Permissions seeded successfully.');
  } catch (error) {
    console.error('Error seeding permissions:', error);
  } finally {
    await db.destroy();
  }
}

seedPermissions();
