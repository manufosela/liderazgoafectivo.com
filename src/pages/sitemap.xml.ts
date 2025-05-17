import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const pages = [
    {
      url: 'https://liderazgoafectivo.com',
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: '1.0',
    },
    {
      url: 'https://liderazgoafectivo.com/primeras-paginas',
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: '0.8',
    },
    {
      url: 'https://liderazgoafectivo.com/blog',
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: '0.7',
    },
    {
      url: 'https://liderazgoafectivo.com/contacto',
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: '0.6',
    },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map(
      (page) => `
  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}; 