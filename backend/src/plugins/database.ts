import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { closeDatabaseConnection, getDatabaseConnection } from '../db/connection.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Knex;
  }
}

export async function registerDatabase(app: FastifyInstance): Promise<void> {
  app.decorate('db', getDatabaseConnection(app.config));

  app.addHook('onClose', async () => {
    await closeDatabaseConnection();
  });
}
