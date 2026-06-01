import { createDatabaseConnection } from '../../src/db/connection.js';

async function addStatusColumn() {
  const db = createDatabaseConnection({
    NODE_ENV: 'local',
    HOST: '127.0.0.1',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/postgres'
  });
  
  try {
    const tables = ['blogs', 'pages', 'stories', 'events', 'club_details', 'announcements', 'achievements'];
    
    for (const table of tables) {
      // Check if status column exists
      const hasColumn = await db.schema.hasColumn(table, 'status');
      if (!hasColumn) {
        await db.raw(`ALTER TABLE ${table} ADD COLUMN status VARCHAR(50)`);
        
        // Populate existing rows
        console.log(`Populating status for ${table}...`);
        await db.raw(`
          UPDATE ${table} t
          SET status = ce.status
          FROM content_entities ce
          WHERE ce.id = t.entity_id
        `);
      } else {
        console.log(`Column status already exists on ${table}.`);
      }
    }
    
    console.log('Successfully added status column to all content extension tables!');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
addStatusColumn();
