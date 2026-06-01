import { createDatabaseConnection } from '../../src/db/connection.js';

async function check() {
  const db = createDatabaseConnection({
    NODE_ENV: 'local',
    HOST: '127.0.0.1',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/postgres'
  });
  
  try {
    // Get all roles
    const roles = await db('roles').select('id', 'name').whereNull('deleted_at');
    console.log('Roles:', roles);

    // Get all permissions
    const permissions = await db('permissions').select('id', 'code').whereNull('deleted_at');
    console.log('\nPermissions:', permissions);

    // Get role_permissions
    for (const role of roles) {
      const rps = await db('role_permissions as rp')
        .join('permissions as p', 'p.id', 'rp.permission_id')
        .where('rp.role_id', role.id)
        .whereNull('rp.deleted_at')
        .select('p.code');
      console.log(`\nRole "${role.name}" permissions:`, rps.map(r => r.code));
    }

    // Get users and their roles
    const users = await db('users').select('id', 'email', 'full_name').whereNull('deleted_at');
    for (const user of users) {
      const userRoles = await db('user_roles as ur')
        .join('roles as r', 'r.id', 'ur.role_id')
        .where('ur.user_id', user.id)
        .whereNull('ur.deleted_at')
        .select('r.name');
      console.log(`\nUser "${user.email}" roles:`, userRoles.map(r => r.name));
    }
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
check();
