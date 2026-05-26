import Fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type { GoogleAuthProvider } from './auth/google-auth-provider.js';
import { authRoutes } from './auth/auth-routes.js';
import { registerEnvironment } from './config/env.js';
import { registerApiResponseFormatter, registerErrorHandler } from './http/api-response.js';
import { registerDatabase } from './plugins/database.js';
import { registerSecurity } from './plugins/security.js';
import { healthRoutes } from './routes/health.js';
import { adminUsersRoutes } from './routes/admin-users.js';
import { adminOrganizationsRoutes } from './routes/admin-organizations.js';
import { adminTaxonomiesRoutes } from './routes/admin-taxonomies.js';
import { adminContentFrameworkRoutes } from './routes/admin-content-framework.js';
import { adminMediaRoutes } from './routes/admin-media.js';
import { adminTaxonomyAssignmentRoutes } from './routes/admin-taxonomy-assignments.js';
import { adminSeoRoutes } from './routes/admin-seo.js';
import { adminDraftsRoutes } from './routes/admin-drafts.js';
import { adminPagesRoutes } from './routes/admin-pages.js';
import { publicPagesRoutes } from './routes/public-pages.js';
import { adminBlogsRoutes } from './routes/admin-blogs.js';
import { publicBlogsRoutes } from './routes/public-blogs.js';
import { adminEventsRoutes } from './routes/admin-events.js';
import { publicEventsRoutes } from './routes/public-events.js';
import { adminAnnouncementsRoutes } from './routes/admin-announcements.js';
import { publicAnnouncementsRoutes } from './routes/public-announcements.js';
import { adminAchievementsRoutes } from './routes/admin-achievements.js';
import { publicAchievementsRoutes } from './routes/public-achievements.js';
import { adminStoriesRoutes } from './routes/admin-stories.js';
import { publicStoriesRoutes } from './routes/public-stories.js';
import { adminClubsRoutes } from './routes/admin-clubs.js';
import { publicClubsRoutes } from './routes/public-clubs.js';
import { adminNotificationsRoutes } from './routes/admin-notifications.js';
import { userNotificationsRoutes } from './routes/user-notifications.js';
import { adminSchedulerRoutes } from './routes/admin-scheduler.js';
import { publicSearchRoutes } from './routes/public-search.js';
import { adminAnalyticsRoutes } from './routes/admin-analytics.js';
import { publicSitemapRoutes } from './routes/public-sitemap.js';
import { SchedulerService } from './scheduler/scheduler-service.js';

export interface BuildAppOptions {
  googleAuthProvider?: GoogleAuthProvider;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  await registerEnvironment(app);
  app.log.level = app.config.LOG_LEVEL;

  await app.register(fastifyJwt, {
    secret: app.config.SESSION_SECRET
  });
  await registerDatabase(app);
  await registerSecurity(app);
  await registerApiResponseFormatter(app);
  await registerErrorHandler(app);
  await app.register(authRoutes, {
    googleAuthProvider: options.googleAuthProvider
  });
  await app.register(healthRoutes);
  await app.register(adminUsersRoutes);
  await app.register(adminOrganizationsRoutes);
  await app.register(adminTaxonomiesRoutes);
  await app.register(adminContentFrameworkRoutes);
  await app.register(adminMediaRoutes);
  await app.register(adminTaxonomyAssignmentRoutes);
  await app.register(adminSeoRoutes);
  await app.register(adminDraftsRoutes);
  await app.register(adminPagesRoutes);
  await app.register(publicPagesRoutes);
  await app.register(adminBlogsRoutes);
  await app.register(publicBlogsRoutes);
  await app.register(adminEventsRoutes);
  await app.register(publicEventsRoutes);
  await app.register(adminAnnouncementsRoutes);
  await app.register(publicAnnouncementsRoutes);
  await app.register(adminAchievementsRoutes);
  await app.register(publicAchievementsRoutes);
  await app.register(adminStoriesRoutes);
  await app.register(publicStoriesRoutes);
  await app.register(adminClubsRoutes);
  await app.register(publicClubsRoutes);
  await app.register(adminNotificationsRoutes);
  await app.register(userNotificationsRoutes);
  await app.register(adminSchedulerRoutes);
  await app.register(publicSearchRoutes);
  await app.register(adminAnalyticsRoutes);
  await app.register(publicSitemapRoutes);

  // Background scheduler initialization (run loop outside tests)
  if (app.config.NODE_ENV !== 'test') {
    const scheduler = new SchedulerService(app.db);
    scheduler.start();
    app.addHook('onClose', async () => {
      scheduler.stop();
    });
  }

  return app;
}
