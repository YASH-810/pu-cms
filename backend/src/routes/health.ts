import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'university-cms-backend'
  }));

  app.get('/api/v1/health', async (request) => {
    let dbStatus = 'ok';
    try {
      await request.server.db.raw('SELECT 1');
    } catch (e) {
      dbStatus = 'error';
      request.log.error(e, 'Database health check failed');
    }

    return {
      status: 'ok',
      service: 'university-cms-backend',
      version: '0.1.0',
      database: dbStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  });
}
