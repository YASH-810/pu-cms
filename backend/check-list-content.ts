import { createDatabaseConnection } from './src/db/connection.js';
import { ContentService } from './src/content/content-service.js';

async function check() {
  const db = createDatabaseConnection({
    NODE_ENV: 'local',
    HOST: '127.0.0.1',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/postgres'
  });
  
  try {
    const service = new ContentService(db);
    const result = await service.listEntities({ status: 'archived', limit: 10, offset: 0 });
    console.log('Archived content:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
check();
