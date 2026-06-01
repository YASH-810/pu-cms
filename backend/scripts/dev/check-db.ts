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
    const blogs = await db('blogs').select('id', 'deleted_at');
    const ce = await db('content_entities').select('id', 'deleted_at', 'status');
    console.log('blogs:', blogs);
    console.log('ce:', ce);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
check();
