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
    // All content_entities
    const allCe = await db('content_entities as ce')
      .join('content_types as ct', 'ce.content_type_id', 'ct.id')
      .leftJoin('users as u', 'ce.created_by', 'u.id')
      .select('ce.id', 'ce.title', 'ce.slug', 'ce.status', 'ce.deleted_at', 'ct.slug as type_slug', 'u.full_name as author_name')
      .orderBy('ce.updated_at', 'desc');
    
    console.log('ALL content_entities:');
    for (const ce of allCe) {
      console.log(`  [${ce.type_slug}] "${ce.title}" status=${ce.status} deleted_at=${ce.deleted_at}`);
    }

    // Published only
    const published = allCe.filter(ce => ce.status === 'published');
    console.log(`\nPublished items: ${published.length}`);
    for (const p of published) {
      console.log(`  [${p.type_slug}] "${p.title}" deleted_at=${p.deleted_at}`);
    }

    // Check content_types
    const cts = await db('content_types').select('id', 'slug', 'is_active', 'deleted_at');
    console.log('\nContent types:', cts);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await db.destroy();
  }
}
check();
