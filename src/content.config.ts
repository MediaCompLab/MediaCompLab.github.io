import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Front matter that Hexo accepted. Everything is optional so the collections
 * stay tolerant of the shapes already present in hexo/source.
 */
const hexoDate = z.preprocess(
	(value) => (value === null || value === '' || value === undefined ? undefined : value),
	z.coerce.date().optional(),
);

const tagsField = z
	.union([z.string(), z.array(z.string()), z.null()])
	.optional()
	.transform((value) => {
		if (value === null || value === undefined) return [] as string[];
		return (Array.isArray(value) ? value : [value]).filter(Boolean);
	});

/**
 * Astro's default glob id runs each path segment through github-slugger, which
 * lower-cases and strips punctuation. Hexo kept the raw file name, and the
 * live URLs depend on it (e.g. the em dash in
 * `Breaking-News—Is-it-Fake-or-Real-...`), so keep the literal relative path.
 */
const rawId = ({ entry }: { entry: string }) => entry.replace(/\.(md|markdown)$/, '');

const posts = defineCollection({
	loader: glob({
		base: './src/content/posts',
		pattern: '**/*.{md,markdown}',
		generateId: rawId,
	}),
	schema: z.object({
		title: z.string(),
		date: hexoDate,
		/** Hexo used `updated_option: mtime`; allow overriding it explicitly. */
		updated: hexoDate,
		tags: tagsField,
		categories: tagsField,
		/** `top: true` rendered the pinned icon in the post list. */
		top: z.boolean().optional(),
		/** `sitemap: false` kept an entry out of sitemap.xml. */
		sitemap: z.boolean().optional(),
	}),
});

const pages = defineCollection({
	loader: glob({
		base: './src/content/pages',
		pattern: '**/*.{md,markdown}',
		generateId: rawId,
	}),
	schema: z.object({
		title: z.string().nullish(),
		date: hexoDate,
		updated: hexoDate,
		/** Hexo layout name: `home` renders the carousel, `site` the plain body. */
		layout: z.enum(['home', 'site', 'post']).nullish(),
		/** `type: tags` / `categories` / `friends` selected a branch in post.ejs. */
		type: z.string().nullish(),
		tags: tagsField,
		categories: tagsField,
		sitemap: z.boolean().optional(),
	}),
});

export const collections = { posts, pages };
