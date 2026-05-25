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

const email = process.argv[2] ?? 'admin@pu.edu';
const fullName = process.argv[3] ?? 'Local Super Admin';

try {
  const [user] = await db('users')
    .insert({
      email,
      full_name: fullName,
      is_active: true,
      deleted_at: null,
      updated_at: db.fn.now()
    })
    .onConflict('email')
    .merge({
      full_name: fullName,
      is_active: true,
      deleted_at: null,
      updated_at: db.fn.now()
    })
    .returning(['id', 'email']);

  const role = await db('roles').select('id').where({ name: 'SUPER_ADMIN' }).first();
  if (!role) {
    throw new Error('SUPER_ADMIN role does not exist. Run migrations first.');
  }

  await db('user_roles')
    .insert({
      user_id: user.id,
      role_id: role.id
    })
    .onConflict(['user_id', 'role_id'])
    .ignore();

  console.log(`Seeded local Super Admin: ${user.email}`);
} finally {
  await db.destroy();
}
