import { SITE } from '../consts';
import { getSitemapItems, getTagsInInsertionOrder } from '../utils/content';
import { asQuery, renderTemplate } from '../utils/templates';
import { absoluteUrl } from '../utils/url';

/**
 * Port of hexo-generator-sitemap. The XML comes from the project's own nunjucks
 * template (src/templates/sitemap.xml), so the output keeps the exact structure
 * and whitespace the Hexo build produced.
 *
 * hexo-generator-sitemap fed the template `[].concat(posts, pages)` sorted by
 * `updated` descending; `getSitemapItems()` reproduces that.
 */
export async function GET() {
	const items = await getSitemapItems();
	const tags = await getTagsInInsertionOrder();

	const posts = items.map((item) => ({
		permalink: absoluteUrl(item.path),
		updated: item.updated,
		date: item.updated,
	}));

	const xml = renderTemplate('sitemap.xml', {
		config: { url: `${SITE.url}/`, sitemap: { path: ['sitemap.xml', 'sitemap.txt'] } },
		posts: asQuery(posts),
		sNow: new Date(),
		tags: asQuery(tags.map((tag) => ({ permalink: absoluteUrl(tag.path) }))),
		categories: asQuery([]),
	});

	return new Response(xml, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
}
