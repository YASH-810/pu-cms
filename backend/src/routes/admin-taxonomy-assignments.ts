import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../auth/authorization.js';
import { badRequest } from '../http/api-error.js';
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

interface SetCategoriesBody {
  /** Array of category UUIDs to assign to the entity */
  category_ids: string[];
}

interface SetTagsBody {
  /** Array of tag UUIDs to assign to the entity */
  tag_ids: string[];
}

export async function adminTaxonomyAssignmentRoutes(app: FastifyInstance): Promise<void> {
  const guard = requirePermission('REVIEW_CONTENT');

  // ---------------------------------------------------------------------------
  // PUT /api/v1/admin/entities/:contentTypeSlug/:entityId/categories
  // Replaces the full set of categories for an entity.
  // ---------------------------------------------------------------------------
  app.put<{ Params: { contentTypeSlug: string; entityId: string }; Body: SetCategoriesBody }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/categories',
    { preHandler: [guard] },
    async (request) => {
      const { contentTypeSlug, entityId } = request.params;
      const { category_ids } = request.body;

      if (!Array.isArray(category_ids)) {
        throw badRequest('category_ids must be an array of UUIDs');
      }

      const service = new TaxonomyAssignmentService(request.server.db);
      const context = await getActorContext(request);

      const ct = await service.resolveContentType(contentTypeSlug);
      const assignments = await service.setCategories(
        { contentTypeId: ct.id, entityId, categoryIds: category_ids },
        context
      );

      return { categories: assignments };
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/entities/:contentTypeSlug/:entityId/categories/:categoryId
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { contentTypeSlug: string; entityId: string; categoryId: string } }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/categories/:categoryId',
    { preHandler: [guard] },
    async (request) => {
      const { contentTypeSlug, entityId, categoryId } = request.params;

      const service = new TaxonomyAssignmentService(request.server.db);
      const context = await getActorContext(request);

      const ct = await service.resolveContentType(contentTypeSlug);
      await service.removeCategory({ contentTypeId: ct.id, entityId, categoryId }, context);

      return { success: true };
    }
  );

  // ---------------------------------------------------------------------------
  // PUT /api/v1/admin/entities/:contentTypeSlug/:entityId/tags
  // Replaces the full set of tags for an entity.
  // ---------------------------------------------------------------------------
  app.put<{ Params: { contentTypeSlug: string; entityId: string }; Body: SetTagsBody }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/tags',
    { preHandler: [guard] },
    async (request) => {
      const { contentTypeSlug, entityId } = request.params;
      const { tag_ids } = request.body;

      if (!Array.isArray(tag_ids)) {
        throw badRequest('tag_ids must be an array of UUIDs');
      }

      const service = new TaxonomyAssignmentService(request.server.db);
      const context = await getActorContext(request);

      const ct = await service.resolveContentType(contentTypeSlug);
      const assignments = await service.setTags(
        { contentTypeId: ct.id, entityId, tagIds: tag_ids },
        context
      );

      return { tags: assignments };
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/admin/entities/:contentTypeSlug/:entityId/tags/:tagId
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { contentTypeSlug: string; entityId: string; tagId: string } }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/tags/:tagId',
    { preHandler: [guard] },
    async (request) => {
      const { contentTypeSlug, entityId, tagId } = request.params;

      const service = new TaxonomyAssignmentService(request.server.db);
      const context = await getActorContext(request);

      const ct = await service.resolveContentType(contentTypeSlug);
      await service.removeTag({ contentTypeId: ct.id, entityId, tagId }, context);

      return { success: true };
    }
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/admin/entities/:contentTypeSlug/:entityId/taxonomy
  // Returns all categories and tags currently assigned to the entity.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { contentTypeSlug: string; entityId: string } }>(
    '/api/v1/admin/entities/:contentTypeSlug/:entityId/taxonomy',
    { preHandler: [guard] },
    async (request) => {
      const { contentTypeSlug, entityId } = request.params;

      const service = new TaxonomyAssignmentService(request.server.db);
      const ct = await service.resolveContentType(contentTypeSlug);

      return service.getEntityTaxonomy(ct.id, entityId);
    }
  );
}
