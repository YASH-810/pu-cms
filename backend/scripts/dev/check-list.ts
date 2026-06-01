import { createDatabaseConnection } from '../../src/db/connection.js';
import { BlogService } from '../../src/blogs/blog-service.js';

async function check() {
  const db = createDatabaseConnection({
    NODE_ENV: 'local',
    HOST: '127.0.0.1',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/postgres'
  });
  
  try {
    const service = new BlogService(db);
    const result = await service.listBlogs({ status: 'archived', limit: 10, offset: 0 });
    console.log('Archived blogs:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
check();
