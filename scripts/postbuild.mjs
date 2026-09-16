/**
 * Post-build fixups so `dist/` matches the file layout `hexo generate` produced.
 *
 * Astro's `build.format: 'directory'` writes `src/pages/people/virginia.astro`
 * to `dist/people/virginia/index.html`. Hexo emitted `public/people/virginia.html`
 * for `source/people/virginia.md`, and the live site links to `/people/virginia`,
 * so flatten those non-index content pages back to `<name>.html`.
 */
import { readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'src', 'content', 'pages');
const distDir = path.join(root, 'dist');

/** Every `.md` under src/content/pages, as a slash-separated relative path. */
async function listMarkdown(dir, prefix = '') {
	const entries = await readdir(dir, { withFileTypes: true });
	const found = [];

	for (const entry of entries) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			found.push(...(await listMarkdown(path.join(dir, entry.name), rel)));
		} else if (/\.(md|markdown)$/.test(entry.name)) {
			found.push(rel.replace(/\.(md|markdown)$/, ''));
		}
	}
	return found;
}

async function exists(target) {
	try {
		await stat(target);
		return true;
	} catch {
		return false;
	}
}

const flattened = [];

for (const pagePath of await listMarkdown(contentDir)) {
	// `index` -> dist/index.html and `people/index` -> dist/people/index.html are
	// already correct; only deeper names need flattening.
	if (pagePath.split('/').pop() === 'index') continue;

	const from = path.join(distDir, pagePath, 'index.html');
	const to = path.join(distDir, `${pagePath}.html`);

	if (!(await exists(from))) continue;

	await rename(from, to);

	// Drop the now-empty directory Astro created.
	try {
		const { rmdir } = await import('node:fs/promises');
		await rmdir(path.dirname(from));
	} catch {
		/* non-empty directory is fine */
	}

	flattened.push(`${pagePath}.html`);
}

if (flattened.length) {
	console.log(`postbuild: flattened ${flattened.length} page(s): ${flattened.join(', ')}`);
} else {
	console.log('postbuild: nothing to flatten');
}
