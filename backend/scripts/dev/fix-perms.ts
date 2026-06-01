import { createDatabaseConnection } from '../../src/db/connection.js';

async function fixPerms() {
  const db = createDatabaseConnection({
    NODE_ENV: 'local',
    HOST: '127.0.0.1',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/postgres'
  });
  
  try {
    const reviewPerm = await db('permissions').where({ code: 'REVIEW_CONTENT' }).whereNull('deleted_at').first();
    if (!reviewPerm) {
      console.error('REVIEW_CONTENT permission not found');
      return;
    }

    const rolesToFix = ['EDITOR', 'CONTENT_CREATOR'];
    
    for (const roleName of rolesToFix) {
      const role = await db('roles').where({ name: roleName }).whereNull('deleted_at').first();
      if (!role) {
        console.log(`Role ${roleName} not found, skipping`);
        continue;
      }

      const existing = await db('role_permissions')
        .where({ role_id: role.id, permission_id: reviewPerm.id })
        .whereNull('deleted_at')
        .first();

      if (existing) {
        console.log(`${roleName} already has REVIEW_CONTENT`);
      } else {
        await db('role_permissions').insert({
          role_id: role.id,
          permission_id: reviewPerm.id
        });
        console.log(`Added REVIEW_CONTENT to ${roleName}`);
      }
    }

    console.log('Done!');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
fixPerms();
