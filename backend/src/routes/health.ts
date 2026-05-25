import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'university-cms-backend'
  }));

  app.get('/api/v1/health', async () => ({
    status: 'ok',
    service: 'university-cms-backend',
    version: '0.1.0'
  }));
}
