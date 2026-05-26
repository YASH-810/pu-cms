import type { FastifyInstance } from 'fastify';

export async function publicSitemapRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /sitemap.xml
  // Returns a dynamic XML sitemap of all active published content
  // ---------------------------------------------------------------------------
  app.get('/sitemap.xml', async (request, reply) => {
    const db = request.server.db;

    // Get the base URL from host header
    const host = request.headers.host || 'university.edu';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    // Query all published, non-deleted entities
    const entities = await db('content_entities as ce')
      .join('content_types as ct', 'ct.id', 'ce.content_type_id')
      .where('ce.status', 'published')
      .whereNull('ce.deleted_at')
      .select(
        'ce.slug',
        'ce.updated_at',
        'ct.slug as content_type_slug'
      )
      .orderBy('ce.updated_at', 'desc');

    // Build XML response
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add homepage
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += `  </url>\n`;

    for (const entity of entities) {
      let segment = '';
      if (entity.content_type_slug === 'page') segment = 'pages';
      else if (entity.content_type_slug === 'blog') segment = 'blogs';
      else if (entity.content_type_slug === 'event') segment = 'events';
      else if (entity.content_type_slug === 'announcement') segment = 'announcements';
      else if (entity.content_type_slug === 'achievement') segment = 'achievements';
      else if (entity.content_type_slug === 'story') segment = 'stories';
      else if (entity.content_type_slug === 'club') segment = 'clubs';
      else segment = `${entity.content_type_slug}s`;

      const lastmod = new Date(entity.updated_at).toISOString();

      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/${segment}/${entity.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `  </url>\n`;
    }

    xml += '</urlset>\n';

    reply.type('application/xml').send(xml);
  });
}
