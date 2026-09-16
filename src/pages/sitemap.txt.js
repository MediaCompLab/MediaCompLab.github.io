import { SITE } from '../consts';
import { getSitemapItems, getTagsInInsertionOrder } from '../utils/content';
import { asQuery, renderTemplate } from '../utils/templates';
import { absoluteUrl } from '../utils/url';

/** Port of hexo-generator-sitemap's plain-text output. */
export async function GET() {
	const items = await getSitemapItems();
	const tags = await getTagsInInsertionOrder();

	const txt = renderTemplate('sitemap.txt', {
		// Hexo's config.url keeps the trailing slash from _config.yml; the
		// template renders it verbatim as the site-root entry.
		config: { url: `${SITE.url}/` },
		posts: asQuery(items.map((item) => ({ permalink: absoluteUrl(item.path) }))),
		tags: asQuery(tags.map((tag) => ({ permalink: absoluteUrl(tag.path) }))),
		categories: asQuery([]),
	});

	return new Response(txt, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
