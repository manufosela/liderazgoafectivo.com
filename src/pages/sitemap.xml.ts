import type { APIRoute } from 'astro';
import { LANGUAGES, PATHS, type PageKey } from '../i18n/translations';

const baseUrl = 'https://liderazgoafectivo.com';
const lastmod = new Date().toISOString();

const priorityMap: Record<PageKey, { changefreq: string; priority: string }> = {
	home: { changefreq: 'weekly', priority: '1.0' },
	preview: { changefreq: 'monthly', priority: '0.8' },
	blog: { changefreq: 'weekly', priority: '0.7' },
	contact: { changefreq: 'monthly', priority: '0.6' },
};

const pageOrder: PageKey[] = ['home', 'preview', 'blog', 'contact'];

export const GET: APIRoute = () => {
	const pages = LANGUAGES.flatMap((lang) =>
		pageOrder.map((pageKey) => {
			const path = PATHS[lang][pageKey];
			const url = path === '/' ? `${baseUrl}/` : `${baseUrl}${path}`;
			const meta = priorityMap[pageKey];
			return {
				url,
				changefreq: meta.changefreq,
				priority: meta.priority,
				lastmod,
			};
		})
	);

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
