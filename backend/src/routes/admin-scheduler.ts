import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { SchedulerService } from '../scheduler/scheduler-service.js';

interface ListLogsQuery {
  job_name?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

export async function adminSchedulerRoutes(app: FastifyInstance): Promise<void> {
  const schedulerGuard = requirePermission('MANAGE_USERS'); // Admin execution monitor

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/scheduler/jobs
  // ---------------------------------------------------------------------------
  app.get('/api/v1/admin/scheduler/jobs', { preHandler: [schedulerGuard] }, async (request) => {
    return request.server.db('scheduled_jobs')
      .whereNull('deleted_at')
      .orderBy('job_name', 'asc');
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/scheduler/logs
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: ListLogsQuery }>('/api/v1/admin/scheduler/logs', { preHandler: [schedulerGuard] }, async (request) => {
    const { job_name, status, limit, offset } = request.query;

    const query = request.server.db('job_execution_logs');

    if (job_name) {
      query.where({ job_name });
    }
    if (status) {
      query.where({ status });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('id as total').first();
    const [countRow, rows] = await Promise.all([
      countQuery,
      query
        .orderBy('started_at', 'desc')
        .limit(limit ? Number(limit) : 50)
        .offset(offset ? Number(offset) : 0)
    ]);

    return {
      logs: rows,
      total: Number((countRow as { total: string } | undefined)?.total ?? 0)
    };
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/admin/scheduler/jobs/:name/run
  // ---------------------------------------------------------------------------
  app.post<{ Params: { name: string } }>('/api/v1/admin/scheduler/jobs/:name/run', { preHandler: [schedulerGuard] }, async (request) => {
    const service = new SchedulerService(request.server.db);
    
    // Execute job asynchronously in background so endpoint returns immediately
    service.executeJob(request.params.name).catch(err => {
      console.error(`MANUAL JOB RUN ERROR FOR ${request.params.name}:`, err);
    });

    return { success: true, message: `Job ${request.params.name} execution triggered.` };
  });
}
