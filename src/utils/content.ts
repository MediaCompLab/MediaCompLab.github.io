import fs from 'node:fs';
import { getCollection } from 'astro:content';
import { getDateParts, prettyUrl, slugize, urlFor } from './url';
import type { PageEntry, PostEntry } from './url';

export type { PageEntry, PostEntry };

const pad = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ *
 * Posts
 * ------------------------------------------------------------------ */

/** Post slug = the Markdown file name, exactly as Hexo's `:title` placeholder. */
export function postSlug(post: PostEntry): string {
	return post.id;
}

/** `2023/05/19/<slug>/` — Hexo's `post.path`. */
export function postRawPath(post: PostEntry): string {
	const { year, month, day } = getDateParts(post.data.date ?? new Date(0));
	return `${year}/${pad(month)}/${pad(day)}/${postSlug(post)}/`;
}

/** `2023/05/19/<slug>/index.html` */
export function postHexoPath(post: PostEntry): string {
	return `${postRawPath(post)}index.html`;
}

/** `/2023/05/19/<slug>/` with `url_for` applied. */
export function postPath(post: PostEntry): string {
	return urlFor(`/${postRawPath(post)}`);
}

export function postTags(post: PostEntry): string[] {
	return post.data.tags ?? [];
}

export function postCategories(post: PostEntry): string[] {
	return post.data.categories ?? [];
}

/** Hexo's `updated_option: mtime`, overridable through front matter. */
export function entryUpdated(entry: PostEntry | PageEntry): Date {
	if (entry.data.updated) return entry.data.updated;
	const filePath = (entry as { filePath?: string }).filePath;
	if (filePath) {
		try {
			return fs.statSync(filePath).mtime;
		} catch {
			/* fall through */
		}
	}
	const date = (entry.data as { date?: Date }).date;
	return date ?? new Date(0);
}

/** Newest first, matching `site.posts.sort('-date')`. */
export async function getPostsNewestFirst(): Promise<PostEntry[]> {
	const posts = await getCollection('posts');
	return [...posts].sort((a, b) => {
		const da = a.data.date?.valueOf() ?? 0;
		const db = b.data.date?.valueOf() ?? 0;
		return db - da;
	});
}

/**
 * Hexo's `page.prev` is the *newer* post and `page.next` the *older* one
 * (see post.ejs: `post-foot-next` renders `page.next`, `post-foot-prev`
 * renders `page.prev`).
 */
export function neighbours(posts: PostEntry[], index: number) {
	return {
		/** newer */
		prev: index > 0 ? posts[index - 1] : undefined,
		/** older */
		next: index < posts.length - 1 ? posts[index + 1] : undefined,
	};
}

/* ------------------------------------------------------------------ *
 * Tags / categories
 * ------------------------------------------------------------------ */

export function tagSlug(tag: string): string {
	return slugize(tag);
}

export function tagPath(tag: string): string {
	return urlFor(`/tags/${tagSlug(tag)}/`);
}

export function categoryPath(category: string): string {
	return urlFor(`/categories/${slugize(category)}/`);
}

/**
 * Tag display order used by `list_tags()` — alphabetical.
 */
export async function getTagsAlphabetical() {
	const posts = await getPostsNewestFirst();
	const counts = new Map<string, number>();
	for (const post of posts) {
		for (const tag of postTags(post)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count, slug: tagSlug(name), path: tagPath(name) }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Tag order used by sitemap.xml — Hexo's tag database insertion order, which
 * is "first time the tag is seen while walking `source/_posts` alphabetically".
 */
export async function getTagsInInsertionOrder() {
	const posts = await getCollection('posts');
	const ordered: string[] = [];
	for (const post of [...posts].sort((a, b) => a.id.localeCompare(b.id))) {
		for (const tag of postTags(post)) {
			if (!ordered.includes(tag)) ordered.push(tag);
		}
	}
	return ordered.map((name) => ({ name, slug: tagSlug(name), path: tagPath(name) }));
}

export function postsWithTag(posts: PostEntry[], tag: string): PostEntry[] {
	return posts.filter((post) => postTags(post).includes(tag));
}

/**
 * News items are written as `#Headline@https://link` — the title itself carries
 * the destination. Everything after the `@` is the URL, and the rest (minus the
 * leading `#`) is the link text. This is how the lab has always entered news.
 */
export function newsLink(post: PostEntry): {
	href: string;
	text: string;
	external: boolean;
} {
	const title = post.data.title ?? '';
	if (title.startsWith('#')) {
		const [text, href] = title.split('@');
		if (href) {
			return { href: href.trim(), text: text.slice(1).trim(), external: true };
		}
	}
	return { href: postPath(post), text: title, external: false };
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

/** Hexo's `page.path`, e.g. `people/virginia.html` or `research/index.html`. */
export function pageHexoPath(page: PageEntry): string {
	return `${page.id}.html`;
}

/** `url_for(page.path)` with the `pretty_urls` options applied. */
export function pagePath(page: PageEntry): string {
	return urlFor(prettyUrl(pageHexoPath(page)));
}

export async function getPages(): Promise<PageEntry[]> {
	const pages = await getCollection('pages');
	return [...pages].sort((a, b) => a.id.localeCompare(b.id));
}

/** Pages that are not claimed by a dedicated route file. */
export const EXPLICIT_PAGE_IDS = new Set(['index', 'tags/index']);

/* ------------------------------------------------------------------ *
 * Sitemap inputs
 * ------------------------------------------------------------------ */

export type SitemapItem = {
	/** `/people/virginia` style, unencoded. */
	path: string;
	updated: Date;
};

/**
 * Port of hexo-generator-sitemap: posts then pages, sorted by `updated` desc.
 * `Array.prototype.sort` is stable, so equal timestamps keep posts-before-pages
 * and, within pages, alphabetical order.
 *
 * Note: Hexo's own page order came from its database insertion order (an
 * artefact of concurrent file processing), which is not reproducible. Only the
 * order of `<entry>` elements in search.xml is affected by this.
 *
 * Paths are returned *unencoded*; the nunjucks templates apply `uriencode`.
 */
export async function getSitemapItems(): Promise<SitemapItem[]> {
	const [posts, pages] = await Promise.all([getCollection('posts'), getPages()]);

	const items: SitemapItem[] = [
		...posts.map((post) => ({
			path: `/${postRawPath(post)}`,
			updated: entryUpdated(post),
		})),
		...pages.map((page) => ({
			path: pagePath(page),
			updated: entryUpdated(page),
		})),
	];

	items.sort((a, b) => b.updated.valueOf() - a.updated.valueOf());

	return items;
}
