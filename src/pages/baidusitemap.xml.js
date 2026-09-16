import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { entryUpdated, postRawPath } from '../utils/content';

/**
 * Port of hexo-generator-baidu-sitemap.
 *
 * The plugin's EJS template only emitted entries for documents that have a
 * `categories` virtual — which is every Post but no Page — so this feed lists
 * posts only, newest `updated` first.
 */
export async function GET() {
	const posts = await getCollection('posts');

	const sorted = [...posts].sort((a, b) => entryUpdated(b).valueOf() - entryUpdated(a).valueOf());

	const body = sorted
		.map((post) => {
			const loc = encodeURI(`${SITE.url}/${postRawPath(post)}`);
			const lastmod = entryUpdated(post).toISOString().replace(/T.*$/i, '');
			return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n`;
		})
		.join('');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}</urlset> `;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
}
