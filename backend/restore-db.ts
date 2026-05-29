import { createDatabaseConnection } from './src/db/connection.js';

async function restore() {
  const db = createDatabaseConnection({
    NODE_ENV: 'local',
    HOST: '127.0.0.1',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/postgres'
  });
  
  try {
    const tables = ['blogs', 'pages', 'stories', 'events', 'club_details', 'announcements', 'achievements'];
    for (const t of tables) {
      await db(t).update({ deleted_at: null }).whereNotNull('archived_at');
    }
    console.log('Restored archived items');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
restore();
