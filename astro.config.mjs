// @ts-check

import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import { rehypeHexoHeading } from './src/plugins/rehype-hexo-heading.mjs';
import hexoExternalLinks from './integrations/hexo-external-links.mjs';
import doiLinkText from './integrations/doi-link-text.mjs';

// https://astro.build/config
export default defineConfig({
	// Same canonical origin as the old Hexo site (_config.yml -> url).
	site: 'https://mediacomplab.com',

	// Hexo emitted hand-formatted EJS output; keep Astro from minifying the
	// whitespace away so the generated HTML stays diffable against the
	// previous `hexo generate` output.
	compressHTML: false,

	build: {
		// Hexo (pretty_urls.trailing_index: false) writes directory indexes
		// such as /people/index.html and /2023/05/19/<slug>/index.html.
		// scripts/postbuild.mjs flattens the non-index content pages back to
		// <name>.html, which is what Hexo did for source/**/*.md.
		format: 'directory',
	},

	markdown: {
		// Mirrors the defaults of hexo-renderer-marked (see its index.js):
		//   gfm: true            -> Astro default
		//   smartypants: true    -> Astro default
		//   breaks: true         -> remark-breaks
		//   headerIds: true      -> rehypeHexoHeading (Hexo slug + headerlink)
		//   external_link        -> integrations/hexo-external-links.mjs
		//
		// external_link is deliberately *not* a rehype plugin: Hexo applied it
		// as a site-wide `after_render:html` filter, i.e. after the page body
		// was splices into the layout and *not* to the Markdown output that
		// hexo-generator-search indexed. Doing it in the build hook reproduces
		// both halves of that behaviour.
		processor: unified({
			remarkPlugins: [remarkBreaks],
			rehypePlugins: [rehypeHexoHeading],
		}),
	},

	integrations: [
		hexoExternalLinks({ site: 'https://mediacomplab.com' }),
		doiLinkText(),
	],
});
