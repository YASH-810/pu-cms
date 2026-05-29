import { createDatabaseConnection } from './src/db/connection.js';
import { resolvePermission } from './src/auth/authorization.js';

async function check() {
  const db = createDatabaseConnection({
    NODE_ENV: 'local',
    HOST: '127.0.0.1',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/postgres'
  });
  
  try {
    // Get editor user
    const editor = await db('users').where({ email: 'editor@mes.ac.in' }).first();
    if (!editor) {
      console.error('Editor user not found');
      return;
    }

    const result = await resolvePermission(db, editor.id, 'REVIEW_CONTENT');
    console.log('Editor REVIEW_CONTENT permission:', result);

    // Also check for yash
    const yash = await db('users').where({ email: 'yash24beit@student.mes.ac.in' }).first();
    if (yash) {
      const result2 = await resolvePermission(db, yash.id, 'REVIEW_CONTENT');
      console.log('Yash REVIEW_CONTENT permission:', result2);
    }
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
check();
