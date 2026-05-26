import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { SeoService, type UpsertSeoInput } from '../seo/seo-service.js';
import { TaxonomyAssignmentService } from '../taxonomy/taxonomy-assignment-service.js';

interface JwtPayload {
  sub: string;
  email: string;
}

async function getActorContext(request: FastifyRequest): Promise<{ actorId: string; ipAddress?: string; userAgent?: string }> {
  const payload = await request.jwtVerify<JwtPayload>();
  return {
    actorId: payload.sub,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']
  };
}

interface UpsertSeoBody {
  language_code?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  robots?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image_url?: string | null;
  twitter_card_type?: string | null;
  schema_markup?: Record<string, unknown> | null;
}

export async function adminSeoRoutes(app: FastifyInstance): Promise<void> {
  const guard = requirePermission('MANAGE_SEO');

  // ---------------------------------------------------------------------------
  // PUT /api/v1/admin/entities/:contentTypeSlug/:entityId/seo
  // Create or update SEO metadata for an entity (upsert by language).
  // ---------------------------------------------------------------------------
  app.put<{ Params: { contentTypeSlug: string; entityId: string }; Body: UpsertSeoBody }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/seo',
    { preHandler: [guard] },
    async (request) => {
      const { contentTypeSlug, entityId } = request.params;
      const body = request.body;

      // Resolve content type to get its UUID
      const ctService = new TaxonomyAssignmentService(request.server.db);
      const ct = await ctService.resolveContentType(contentTypeSlug);

      const service = new SeoService(request.server.db);
      const context = await getActorContext(request);

      return service.upsertSeoMetadata(
        {
          contentTypeId: ct.id,
          entityId,
          languageCode: body.language_code ?? 'en',
          metaTitle: body.meta_title,
          metaDescription: body.meta_description,
          metaKeywords: body.meta_keywords,
          canonicalUrl: body.canonical_url,
          robots: body.robots,
          ogTitle: body.og_title,
          ogDescription: body.og_description,
          ogImageUrl: body.og_image_url,
          twitterTitle: body.twitter_title,
          twitterDescription: body.twitter_description,
          twitterImageUrl: body.twitter_image_url,
          twitterCardType: body.twitter_card_type,
          schemaMarkup: body.schema_markup
        } satisfies UpsertSeoInput,
        context
      );
    }
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/entities/:contentTypeSlug/:entityId/seo
  // List all SEO records for an entity (all languages).
  // Optional ?lang= query to get a single language record.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { contentTypeSlug: string; entityId: string }; Querystring: { lang?: string } }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/seo',
    { preHandler: [guard] },
    async (request) => {
      const { contentTypeSlug, entityId } = request.params;
      const { lang } = request.query;

      const ctService = new TaxonomyAssignmentService(request.server.db);
      const ct = await ctService.resolveContentType(contentTypeSlug);

      const service = new SeoService(request.server.db);

      if (lang) {
        const record = await service.getSeoMetadata(ct.id, entityId, lang);
        return { seo: record };
      }

      const records = await service.listSeoMetadata(ct.id, entityId);
      return { seo: records };
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/entities/:contentTypeSlug/:entityId/seo/:id
  // Soft-delete a specific SEO record by its own ID.
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { contentTypeSlug: string; entityId: string; id: string } }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/seo/:id',
    { preHandler: [guard] },
    async (request) => {
      const service = new SeoService(request.server.db);
      const context = await getActorContext(request);
      await service.deleteSeoMetadata(request.params.id, context);
      return { success: true };
    }
  );
}
