/**
 * Port of Hexo's site-wide external-link filter.
 *
 * The old `_config.yml` had
 *
 *   external_link:
 *     enable: true
 *     field: site
 *
 * which made Hexo post-process the *entire* rendered page, rewriting every
 * outbound `<a>` to `<a target="_blank" rel="noopener" href="...">`.
 *
 * `src/plugins/rehype-external-link.mjs` covers the anchors Astro generates
 * from Markdown (and does so during `astro dev` too). This integration covers
 * everything else — the lab pages embed a lot of hand-written HTML, and those
 * anchors never pass through the Markdown pipeline. Links that already carry a
 * `target` are skipped, so running both is idempotent.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Verbatim from hexo/lib/plugins/filter/after_render/external_link.js
const rATag = /<a(?:\s+?|\s+?[^<>]+?\s+?)href=["']((?:https?:|\/\/)[^<>"']+)["'][^<>]*>/gi;
const rTargetAttr = /target=/i;
const rRelAttr = /rel=/i;
const rRelStrAttr = /rel=["']([^<>"']*)["']/i;

function isExternalLink(input, sitehost, exclude) {
	if (!/^(\/\/|http(s)?:)/.test(input)) return false;
	if (!sitehost) return false;

	let data;
	try {
		data = new URL(input, `http://${sitehost}`);
	} catch {
		return false;
	}
	if (data.origin === 'null') return false;

	const host = data.hostname;
	if (exclude?.length && exclude.includes(host)) return false;

	return host !== sitehost;
}

async function listHtmlFiles(dir) {
	const found = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await listHtmlFiles(full)));
		else if (entry.name.endsWith('.html')) found.push(full);
	}
	return found;
}

export default function hexoExternalLinks(options = {}) {
	const siteUrl = options.site ?? 'https://mediacomplab.com';
	const exclude = options.exclude ?? [];
	const sitehost = new URL(siteUrl).hostname;

	return {
		name: 'hexo-external-links',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				let touchedFiles = 0;
				let touchedLinks = 0;

				for (const file of await listHtmlFiles(root)) {
					const html = await readFile(file, 'utf8');
					let count = 0;

					const out = html.replace(rATag, (str, href) => {
						if (!isExternalLink(href, sitehost, exclude)) return str;
						if (rTargetAttr.test(str)) return str;

						count++;
						if (rRelAttr.test(str)) {
							const withRel = str.replace(rRelStrAttr, (relStr, rel) =>
								rel.includes('noopenner') ? relStr : `rel="${rel} noopener"`,
							);
							return withRel.replace('href=', 'target="_blank" href=');
						}
						return str.replace('href=', 'target="_blank" rel="noopener" href=');
					});

					if (out !== html) {
						await writeFile(file, out);
						touchedFiles++;
						touchedLinks += count;
					}
				}

				logger.info(
					`external links: rewrote ${touchedLinks} link(s) across ${touchedFiles} file(s)`,
				);
			},
		},
	};
}
