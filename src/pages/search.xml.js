import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { render } from 'astro:content';
import {
	getPages,
	getPostsNewestFirst,
	pageHexoPath,
	postRawPath,
	postTags,
} from '../utils/content';
import { asQuery, renderTemplate } from '../utils/templates';

/**
 * Port of hexo-generator-search's XML generator.
 *
 * `_config.yml` had `search: { field: source, content: true }`, which made the
 * generator index both posts and pages (`field` can be `post`, `page`, or
 * anything else meaning "both").
 */
export async function GET() {
	const container = await AstroContainer.create();

	const posts = await getPostsNewestFirst();
	const pages = await getPages();

	const postDocs = [];
	for (const post of posts) {
		const { Content } = await render(post);
		postDocs.push({
			indexing: undefined,
			title: post.data.title,
			path: postRawPath(post),
			content: await container.renderToString(Content),
			categories: asQuery([]),
			tags: asQuery(postTags(post).map((name) => ({ name }))),
		});
	}

	const pageDocs = [];
	for (const page of pages) {
		const { Content } = await render(page);
		pageDocs.push({
			indexing: undefined,
			title: page.data.title ?? '',
			path: pageHexoPath(page),
			content: await container.renderToString(Content),
		});
	}

	const xml = renderTemplate('search.xml', {
		content: true,
		url: '/',
		posts: asQuery(postDocs),
		pages: asQuery(pageDocs),
	});

	return new Response(xml, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
}
