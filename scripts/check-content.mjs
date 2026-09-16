/**
 * Guards the one Markdown rule that keeps biting these content pages.
 *
 * `src/content/pages/*.md` are Markdown files whose bodies are mostly raw HTML.
 * In CommonMark a line indented by four or more spaces *after a blank line*
 * starts an indented code block — so a pretty-indented `<div class="…">` gets
 * rendered as a syntax-highlighted code block instead of markup. (A tab counts
 * as four spaces.)
 *
 * The same trap applies to a blank line *inside* an HTML block: it ends the
 * block, and whatever follows is re-parsed as Markdown.
 *
 * This check fails the build instead of letting that reach the browser.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'src/content/pages';

async function walk(dir) {
	const found = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await walk(full)));
		else if (/\.(md|markdown)$/.test(entry.name)) found.push(full);
	}
	return found;
}

/** Width of the leading whitespace, counting a tab as four columns. */
const indentWidth = (line) => {
	let width = 0;
	for (const ch of line) {
		if (ch === ' ') width += 1;
		else if (ch === '\t') width += 4;
		else break;
	}
	return width;
};

const problems = [];

for (const file of await walk(ROOT)) {
	const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');

	lines.forEach((line, i) => {
		if (line.trim() === '') return;

		const previous = i === 0 ? '' : lines[i - 1];
		const startsBlock = previous.trim() === '';
		if (!startsBlock) return;

		const width = indentWidth(line);
		if (width >= 4) {
			problems.push({
				file,
				line: i + 1,
				width,
				text: line.trim().slice(0, 70),
			});
		}
	});
}

if (problems.length) {
	console.error('\nContent pages: indentation that Markdown will turn into a code block\n');
	for (const p of problems) {
		console.error(`  ${p.file}:${p.line}  (indent ${p.width})  ${p.text}`);
	}
	console.error(
		'\nRaw HTML in these files must not be indented: a line indented by 4+ spaces\n' +
			'after a blank line becomes an indented code block. Keep block-level tags at\n' +
			'column 0, and do not leave blank lines inside an HTML block.\n',
	);
	process.exit(1);
}

console.log('content check: ok');
