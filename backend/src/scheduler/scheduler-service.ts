import type { Knex } from 'knex';
import { ContentService } from '../content/content-service.js';
import { NotificationService } from '../notifications/notification-service.js';

export interface ScheduledJobRow {
  id: string;
  job_name: string;
  is_active: boolean;
  cron_expression_or_interval: string;
  last_run_at: Date | null;
  next_run_at: Date | null;
}

export interface JobExecutionLogRow {
  id: string;
  job_name: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  error_message: string | null;
  retry_count: number;
}

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private readonly contentService: ContentService;
  private readonly notificationService: NotificationService;

  public constructor(private readonly db: Knex) {
    this.contentService = new ContentService(db);
    this.notificationService = new NotificationService(db);
  }

  // -------------------------------------------------------------------------
  // Lifecycle Management
  // -------------------------------------------------------------------------
  public start(checkIntervalMs = 30000): void {
    if (this.timer) return;
    
    // Initialize next_run_at for any jobs where it is null
    this.initializeNextRunTimes().catch(err => console.error('SCHEDULER INIT ERROR:', err));

    this.timer = setInterval(() => {
      this.runPendingJobs().catch(err => console.error('SCHEDULER RUN ERROR:', err));
    }, checkIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Core Job Runner
  // -------------------------------------------------------------------------
  public async runPendingJobs(): Promise<void> {
    const pendingJobs = await this.db('scheduled_jobs')
      .where({ is_active: true })
      .andWhere((qb) => {
        qb.whereNull('next_run_at').orWhere('next_run_at', '<=', this.db.fn.now());
      });

    for (const job of pendingJobs) {
      await this.executeJob(job.job_name);
    }
  }

  public async executeJob(jobName: string): Promise<void> {
    const job = await this.db('scheduled_jobs').where({ job_name: jobName }).first();
    if (!job || !job.is_active) return;

    // Create log record
    const [logRecord] = await this.db('job_execution_logs')
      .insert({
        job_name: jobName,
        status: 'running',
        started_at: this.db.fn.now()
      })
      .returning('*');

    try {
      // Execute job-specific logic
      if (jobName === 'scheduled_publishing') {
        await this.runScheduledPublishing();
      } else if (jobName === 'automated_archival') {
        await this.runAutomatedArchival();
      } else if (jobName === 'generate_sitemap') {
        await this.runGenerateSitemap();
      } else if (jobName === 'job_retry') {
        await this.runJobRetry();
      }

      // Mark log as completed
      await this.db('job_execution_logs')
        .where({ id: logRecord.id })
        .update({
          status: 'completed',
          completed_at: this.db.fn.now()
        });

      // Update scheduler state
      const now = new Date();
      const nextRun = this.calculateNextRunTime(job.cron_expression_or_interval, now);

      await this.db('scheduled_jobs')
        .where({ job_name: jobName })
        .update({
          last_run_at: now,
          next_run_at: nextRun,
          updated_at: this.db.fn.now()
        });

    } catch (err: any) {
      console.error(`JOB FAILED [${jobName}]:`, err);

      // Mark log as failed
      await this.db('job_execution_logs')
        .where({ id: logRecord.id })
        .update({
          status: 'failed',
          completed_at: this.db.fn.now(),
          error_message: err.message || 'Unknown error'
        });

      // Update next_run_at so it runs again later
      const now = new Date();
      const nextRun = this.calculateNextRunTime(job.cron_expression_or_interval, now);

      await this.db('scheduled_jobs')
        .where({ job_name: jobName })
        .update({
          last_run_at: now,
          next_run_at: nextRun,
          updated_at: this.db.fn.now()
        });

      // Notify super admins about failure
      await this.notifyAdminsOfFailure(jobName, err.message || 'Unknown error');
    }
  }

  // -------------------------------------------------------------------------
  // Job Actions
  // -------------------------------------------------------------------------
  private async runScheduledPublishing(): Promise<void> {
    const pendingEntities = await this.db('content_entities')
      .where({ status: 'scheduled' })
      .where('scheduled_publish_at', '<=', this.db.fn.now())
      .whereNull('deleted_at');

    for (const entity of pendingEntities) {
      const contentType = await this.db('content_types').where({ id: entity.content_type_id }).first();
      if (!contentType) continue;

      // Use creator or system user context
      const actorId = entity.created_by || '00000000-0000-0000-0000-000000000000';
      const context = {
        actorId,
        ipAddress: '127.0.0.1',
        userAgent: 'System Scheduler'
      };

      // Perform status transition to published
      await this.contentService.transitionStatus(
        {
          contentTypeSlug: contentType.slug,
          entityId: entity.id,
          status: 'published',
          remarks: 'Published automatically by scheduler'
        },
        context
      );

      // Update specific content type tables (such as page, blog, event, announcement, achievement, story, club)
      const updateData = {
        published_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
        updated_by: actorId
      };

      await this.db(contentType.table_name)
        .where({ entity_id: entity.id })
        .update(updateData);

      // Trigger user notification for publication
      await this.notificationService.triggerWorkflowNotification(
        entity.id,
        contentType.slug,
        'publish',
        'Published automatically',
        actorId
      );
    }
  }

  private async runAutomatedArchival(): Promise<void> {
    // 1. Archive by scheduled_archive_at
    const expiredByScheduled = await this.db('content_entities')
      .where({ status: 'published' })
      .where('scheduled_archive_at', '<=', this.db.fn.now())
      .whereNull('deleted_at');

    for (const entity of expiredByScheduled) {
      await this.archiveEntity(entity);
    }

    // 2. Archive announcements past valid_until
    const expiredAnnouncements = await this.db('announcements as an')
      .join('content_entities as ce', 'ce.id', 'an.entity_id')
      .where('ce.status', 'published')
      .where('an.valid_until', '<=', this.db.fn.now())
      .whereNull('an.deleted_at')
      .whereNull('ce.deleted_at')
      .select('ce.*');

    for (const entity of expiredAnnouncements) {
      await this.archiveEntity(entity);
    }

    // 3. Archive events past end_at
    const expiredEvents = await this.db('events as ev')
      .join('content_entities as ce', 'ce.id', 'ev.entity_id')
      .where('ce.status', 'published')
      .where('ev.end_at', '<=', this.db.fn.now())
      .whereNull('ev.deleted_at')
      .whereNull('ce.deleted_at')
      .select('ce.*');

    for (const entity of expiredEvents) {
      await this.archiveEntity(entity);
    }
  }

  private async runGenerateSitemap(): Promise<void> {
    // Dynamic XML controller handles the serving, but we can audit sitemap metrics
    const count = await this.db('content_entities').where({ status: 'published' }).whereNull('deleted_at').count('id as total').first();
    console.log(`[Sitemap Generator Job] Public URLs verified: ${count?.total ?? 0}`);
  }

  private async runJobRetry(): Promise<void> {
    // Find failed logs in the last 2 hours and retry up to 3 times
    const failedLogs = await this.db('job_execution_logs')
      .where({ status: 'failed' })
      .where('started_at', '>=', this.db.raw("NOW() - INTERVAL '2 hours'"))
      .where('retry_count', '<', 3);

    for (const log of failedLogs) {
      // Increment retry_count and trigger job rerun
      await this.db('job_execution_logs')
        .where({ id: log.id })
        .update({
          retry_count: log.retry_count + 1
        });

      console.log(`[Job Retry Engine] Retrying background job: ${log.job_name}`);
      await this.executeJob(log.job_name);
    }
  }

  // -------------------------------------------------------------------------
  // Helper Utilities
  // -------------------------------------------------------------------------
  private async archiveEntity(entity: any): Promise<void> {
    const contentType = await this.db('content_types').where({ id: entity.content_type_id }).first();
    if (!contentType) return;

    const actorId = entity.created_by || '00000000-0000-0000-0000-000000000000';
    const context = {
      actorId,
      ipAddress: '127.0.0.1',
      userAgent: 'System Scheduler'
    };

    // Transition status to archived
    await this.contentService.transitionStatus(
      {
        contentTypeSlug: contentType.slug,
        entityId: entity.id,
        status: 'archived',
        remarks: 'Archived automatically by scheduler (expiration)'
      },
      context
    );

    // Update specific tables
    await this.db(contentType.table_name)
      .where({ entity_id: entity.id })
      .update({
        archived_at: this.db.fn.now(),
        deleted_at: this.db.fn.now(),
        updated_at: this.db.fn.now(),
        updated_by: actorId
      });
  }

  private async initializeNextRunTimes(): Promise<void> {
    const jobs = await this.db('scheduled_jobs').whereNull('next_run_at');
    const now = new Date();
    for (const job of jobs) {
      const nextRun = this.calculateNextRunTime(job.cron_expression_or_interval, now);
      await this.db('scheduled_jobs')
        .where({ id: job.id })
        .update({
          next_run_at: nextRun,
          updated_at: this.db.fn.now()
        });
    }
  }

  private calculateNextRunTime(interval: string, lastRun: Date): Date {
    const num = parseInt(interval, 10);
    const unit = interval.slice(-1);
    const next = new Date(lastRun);
    if (unit === 'm') {
      next.setMinutes(next.getMinutes() + num);
    } else if (unit === 'h') {
      next.setHours(next.getHours() + num);
    } else if (unit === 'd') {
      next.setDate(next.getDate() + num);
    } else {
      next.setMinutes(next.getMinutes() + 10); // Fallback
    }
    return next;
  }

  private async notifyAdminsOfFailure(jobName: string, errorMessage: string): Promise<void> {
    // Find all super admin user IDs
    const superAdminRole = await this.db('roles').where({ name: 'SUPER_ADMIN' }).first();
    if (!superAdminRole) return;

    const admins = await this.db('user_roles as ur')
      .join('users as u', 'u.id', 'ur.user_id')
      .where('ur.role_id', superAdminRole.id)
      .where('u.is_active', true)
      .whereNull('u.deleted_at')
      .select('u.id');

    for (const admin of admins) {
      await this.notificationService.sendNotificationFromTemplate(
        String(admin.id),
        'job_failed',
        {
          job_name: jobName,
          error_message: errorMessage
        }
      );
    }
  }
}
