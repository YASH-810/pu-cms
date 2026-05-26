import Fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type { GoogleAuthProvider } from './auth/google-auth-provider.js';
import { authRoutes } from './auth/auth-routes.js';
import { registerEnvironment } from './config/env.js';
import { registerApiResponseFormatter, registerErrorHandler } from './http/api-response.js';
import { registerDatabase } from './plugins/database.js';
import { healthRoutes } from './routes/health.js';
import { adminUsersRoutes } from './routes/admin-users.js';
import { adminOrganizationsRoutes } from './routes/admin-organizations.js';
import { adminTaxonomiesRoutes } from './routes/admin-taxonomies.js';
import { adminContentFrameworkRoutes } from './routes/admin-content-framework.js';
import { adminMediaRoutes } from './routes/admin-media.js';
import { adminTaxonomyAssignmentRoutes } from './routes/admin-taxonomy-assignments.js';
import { adminSeoRoutes } from './routes/admin-seo.js';
import { adminDraftsRoutes } from './routes/admin-drafts.js';

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

  return app;
}
