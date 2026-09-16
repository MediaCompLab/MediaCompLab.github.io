/**
 * Relabel bare-DOI anchors as "Full text".
 *
 * The bibliography in `src/content/pages/publications/index.md` grew over
 * twenty years of copy-pasted citations, and the DOI links in it display as
 * full URLs — `https://doi.org/10.1016/j.cognition.2026.106669` — which reads
 * as a wall of blue noise. The page's own lede already promises "Full text is
 * linked where a DOI is available", so every anchor whose visible text is a
 * DOI URL (or a bare DOI) is rewritten to that label.
 *
 * This runs as a post-build pass over the emitted HTML rather than a rehype
 * plugin because the citations mix Markdown autolinks, hand-written Markdown
 * links, and raw HTML; the built output is the only place they all exist.
 * Text-only: `href` and `target`/`rel` are left untouched, so links keep
 * working and opening in a new tab.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rAnchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const rTag = /<[^>]+>/g;

/** Does the anchor point at a DOI resolver? */
const isDoiHref = (attrs) => /href=["'][^"']*(?:doi\.org|dx\.doi\.org)\/[^"']*["']/i.test(attrs);

/** Is the visible text a URL or DOI rather than a human phrase? */
const isBareDoiText = (text) =>
	/doi\.org\//i.test(text) || /^\s*(?:doi:?\s*)?10\.\d{4,9}\b/i.test(text);

async function listHtmlFiles(dir) {
	const found = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await listHtmlFiles(full)));
		else if (entry.name.endsWith('.html')) found.push(full);
	}
	return found;
}

export default function doiLinkText() {
	return {
		name: 'doi-link-text',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				let touchedFiles = 0;
				let touchedLinks = 0;

				for (const file of await listHtmlFiles(root)) {
					const html = await readFile(file, 'utf8');
					let count = 0;

					const out = html.replace(rAnchor, (str, attrs, inner) => {
						if (!isDoiHref(attrs)) return str;
						const visible = inner.replace(rTag, '').trim();
						if (!isBareDoiText(visible)) return str;
						count++;
						return `<a${attrs}>Full text</a>`;
					});

					if (out !== html) {
						await writeFile(file, out);
						touchedFiles++;
						touchedLinks += count;
					}
				}

				logger.info(`doi links: relabelled ${touchedLinks} anchor(s) across ${touchedFiles} file(s)`);
			},
		},
	};
}
