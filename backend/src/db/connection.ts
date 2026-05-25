import knex, { type Knex } from 'knex';
import type { AppConfig } from '../config/env.js';

let db: Knex | null = null;

export function createDatabaseConnection(config: AppConfig): Knex {
  return knex({
    client: 'pg',
    connection: config.DATABASE_URL,
    pool: {
      min: config.NODE_ENV === 'production' ? 2 : 0,
      max: config.NODE_ENV === 'production' ? 20 : 10
    }
  });
}

export function getDatabaseConnection(config: AppConfig): Knex {
  if (!db) {
    db = createDatabaseConnection(config);
  }

  return db;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
