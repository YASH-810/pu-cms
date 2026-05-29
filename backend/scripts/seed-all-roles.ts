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

const rolesToSeed = [
  { email: 'super_admin@mes.ac.in', name: 'Super Admin User', role: 'SUPER_ADMIN' },
  { email: 'university_admin@mes.ac.in', name: 'University Admin User', role: 'UNIVERSITY_ADMIN' },
  { email: 'school_admin@mes.ac.in', name: 'School Admin User', role: 'SCHOOL_ADMIN' },
  { email: 'reviewer@mes.ac.in', name: 'Reviewer User', role: 'REVIEWER' },
  { email: 'content_creator@mes.ac.in', name: 'Content Creator User', role: 'CONTENT_CREATOR' },
];

async function seed() {
  try {
    for (const data of rolesToSeed) {
      const [user] = await db('users')
        .insert({
          email: data.email,
          full_name: data.name,
          is_active: true,
          deleted_at: null,
          updated_at: db.fn.now()
        })
        .onConflict('email')
        .merge({
          full_name: data.name,
          is_active: true,
          deleted_at: null,
          updated_at: db.fn.now()
        })
        .returning(['id', 'email']);

      const role = await db('roles').select('id').where({ name: data.role }).first();
      if (!role) {
        throw new Error(`Role ${data.role} does not exist. Run migrations first.`);
      }

      await db('user_roles')
        .insert({
          user_id: user.id,
          role_id: role.id
        })
        .onConflict(['user_id', 'role_id'])
        .ignore();

      console.log(`Seeded ${data.role}: ${user.email}`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await db.destroy();
  }
}

seed();
