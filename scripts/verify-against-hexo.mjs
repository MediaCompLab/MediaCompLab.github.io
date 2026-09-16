/**
 * Compares the Astro build (`dist/`) against a reference build.
 *
 * Usage:
 *   npm run verify                     # against .baseline/ if present, else ../hexo/public
 *   node scripts/verify-against-hexo.mjs <dir>
 *   node scripts/verify-against-hexo.mjs --hexo      # force the Hexo reference
 *   VERBOSE=1 node scripts/verify-against-hexo.mjs
 *
 * Two references exist:
 *   - `.baseline/`, a snapshot of a known-good build (see scripts/snapshot.mjs).
 *     Everything must match; that is the ongoing regression guard.
 *   - `../hexo/public`, the archived Hexo output. It was the reference while the
 *     job was proving the migration, but the 2026 redesign replaced the whole
 *     front end, so page markup no longer has a Hexo counterpart. Against this
 *     reference only the copied static assets are still compared strictly.
 *
 * HTML/XML files are compared as a normalised token stream rather than byte by
 * byte, so framework-level formatting (self-closing slashes, indentation,
 * attribute quoting) does not drown out real differences. `<style>`, `<script>`
 * and `<title>` contents are compared exactly. Plain assets are byte compared.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

const hexoDir = path.join(root, '..', 'hexo', 'public');
const snapshotDir = path.join(root, '.baseline');

const arg = process.argv[2];
const useHexo = arg === '--hexo';
const goldenDir = path.resolve(
	useHexo || !arg
		? useHexo
			? hexoDir
			: existsSync(path.join(snapshotDir, 'index.html'))
				? snapshotDir
				: hexoDir
		: arg,
);

const usingSnapshot = goldenDir === snapshotDir;

/** Files that legitimately differ between a Hexo and an Astro build. */
const IGNORED = [
	/^_astro\//, // Astro's bundled assets
	/^\.astro\//,
	/^\.nojekyll$/,
];

const VOID_TAGS = new Set([
	'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
	'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Two kinds of accepted difference, kept separate on purpose.
 *
 * KNOWN_RENDERING_DIFFERENCES are inherent: the same Markdown renders slightly
 * differently under marked (Hexo) and CommonMark (Astro), or Hexo's output
 * depended on its own database ordering. They will never go away.
 *
 * CONTENT_DIVERGED are pages edited *after* the migration. The site is now
 * maintained in Astro only, so `../hexo/public` is a frozen reference: for these
 * files the check no longer proves anything, but everything else still has to
 * match byte for byte / structurally.
 */
const KNOWN_RENDERING_DIFFERENCES = new Map([
	[
		'publications/index.html',
		"One bibliography entry uses malformed emphasis (`***Feller*, *D. P***`). " +
			'Marked (Hexo) and CommonMark (Astro) split it differently, so the Astro ' +
			'build drops two literal asterisks.',
	],
	[
		'search.xml',
		'The same malformed-emphasis entry, plus the order of the page <entry> ' +
			'elements: Hexo used its database insertion order, which came from ' +
			'concurrent file processing and cannot be reproduced.',
	],
]);

const CONTENT_DIVERGED = new Map([
	[
		'people/index.html',
		'Charlisha Jett added; Gal Kaldes and Haeli Patel moved into an Alumni section at the ' +
			'bottom of the same page, together with Heather Ness-Maddox',
	],
	['publications/index.html', 'Three publications added (2026 Cognition, 2026 MDPI, 2025 Discourse Processes)'],
	['sitemap.xml', '`/people/` and `/publications/` lastmod moved to the day they were edited'],
	['sitemap.txt', 'Same pages, now ordered first because they are the most recently updated'],
]);/** Files the Astro build produces that the Hexo build had no counterpart for. */
const EXPECTED_EXTRA_FILES = new Map([
	['robots.txt', 'existed at the Hexo project root but was never copied into public/'],
	['images/charlisha_jett.jpg', 'new headshot, added after the migration'],
	['images/cehd-lockup.png', 'trimmed copy of cehd.png, made for the 2026 redesign header'],
]);

/**
 * Pages the Hexo build produced and this one deliberately does not.
 *
 * The archives were orphaned in the theme itself: `hexo generate` wrote thirteen
 * `/archives/…` pages, but nothing on the site linked to them and none of them
 * was in the sitemap, so they were reachable only by typing the URL. The News
 * page lists every update and the tag pages filter them, so the whole set was
 * dropped — along with the `theme.navbar` entry pointing at it.
 */
const INTENTIONALLY_REMOVED = /^archives\//;

async function listFiles(dir, prefix = '') {
	let out = [];
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) out = out.concat(await listFiles(path.join(dir, entry.name), rel));
		else out.push(rel);
	}
	return out;
}

async function readMaybe(file) {
	try {
		return await readFile(file);
	} catch {
		return null;
	}
}

const skip = (file) => IGNORED.some((re) => re.test(file));

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/** Canonicalise one attribute list: sorted, `attr` == `attr=""`, unquoted kept. */
function normaliseAttrs(raw) {
	const attrs = [];
	const re = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
	let m;
	while ((m = re.exec(raw))) {
		const name = m[1].toLowerCase();
		const value = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
		attrs.push(`${name}=${value}`);
	}
	attrs.sort();
	return attrs.join(' ');
}

/**
 * Entity references are equivalent to the characters they encode, and the two
 * frameworks disagree about escaping bare `&` in attributes.
 */
const NAMED_ENTITIES = {
	amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
};

function decodeEntities(value) {
	return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body) => {
		if (body[0] === '#') {
			const code = body[1] === 'x' || body[1] === 'X'
				? parseInt(body.slice(2), 16)
				: parseInt(body.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

/**
 * Flatten markup into `<tag attrs>` / `</tag>` / text tokens.
 *
 * Normal text between tags has its whitespace collapsed, so only a *change* in
 * whether whitespace exists at all shows up — the two frameworks indent their
 * output differently and that is not a rendering difference.
 *
 * The contents of raw-text elements (`<style>`, `<script>`, ...) are compared
 * **byte for byte instead**. Those blocks are verbatim copies of the theme's
 * own code, and trimming them hid a real bug once: a UTF-8 BOM pasted into a
 * `<style>` block made the browser drop the first CSS rule in it (the BOM is
 * whitespace to JavaScript's `\s`, so `.trim()` silently removed it).
 */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);

function normaliseStartTag(raw) {
	const selfClosing = /\/>$/.test(raw);
	const body = raw.slice(1, selfClosing ? -2 : -1).trim();
	const nameMatch = /^([^\s/>]+)/.exec(body);
	if (!nameMatch) return null;

	const name = nameMatch[1].toLowerCase();
	const attrs = normaliseAttrs(body.slice(nameMatch[0].length));
	return {
		name,
		selfClosing,
		token: attrs ? `<${name} ${attrs}>` : `<${name}>`,
	};
}

function pushText(tokens, chunk) {
	const text = decodeEntities(chunk).replace(/\s+/g, ' ').trim();
	if (text) tokens.push(text);
}

function tokenise(html) {
	const tokens = [];
	let i = 0;

	while (i < html.length) {
		const lt = html.indexOf('<', i);

		if (lt === -1) {
			pushText(tokens, html.slice(i));
			break;
		}
		if (lt > i) pushText(tokens, html.slice(i, lt));

		if (html.startsWith('<!--', lt)) {
			// Comments are never rendered, and the two frameworks reflow the
			// whitespace inside them differently.
			const end = html.indexOf('-->', lt + 4);
			const stop = end === -1 ? html.length : end + 3;
			tokens.push(`comment:${html.slice(lt, stop).replace(/\s+/g, '')}`);
			i = stop;
			continue;
		}

		if (html.startsWith('<![CDATA[', lt)) {
			// CDATA payloads (search.xml) are markup too — recurse.
			const end = html.indexOf(']]>', lt + 9);
			tokens.push('cdata:');
			tokens.push(...tokenise(html.slice(lt + 9, end === -1 ? html.length : end)));
			tokens.push(':cdata');
			i = end === -1 ? html.length : end + 3;
			continue;
		}

		const gt = html.indexOf('>', lt);
		if (gt === -1) {
			pushText(tokens, html.slice(lt));
			break;
		}

		const raw = html.slice(lt, gt + 1);

		if (raw.startsWith('</')) {
			tokens.push(`</${raw.slice(2, -1).trim().toLowerCase()}>`);
			i = gt + 1;
			continue;
		}

		const parsed = normaliseStartTag(raw);
		if (!parsed) {
			pushText(tokens, raw);
			i = gt + 1;
			continue;
		}

		tokens.push(parsed.token);

		if (parsed.selfClosing) {
			if (!VOID_TAGS.has(parsed.name)) tokens.push(`</${parsed.name}>`);
			i = gt + 1;
			continue;
		}

		if (RAW_TEXT_ELEMENTS.has(parsed.name)) {
			const rest = html.slice(gt + 1);
			const close = new RegExp(`</${parsed.name}\\s*>`, 'i').exec(rest);
			const inner = close ? rest.slice(0, close.index) : rest;
			tokens.push(`${parsed.name}-raw:\u0002${inner}\u0002`);
			tokens.push(`</${parsed.name}>`);
			i = close ? gt + 1 + close.index + close[0].length : html.length;
			continue;
		}

		i = gt + 1;
	}

	return tokens;
}

/**
 * HTML parsers discard an end tag that has no matching open element. Hexo
 * copied such strays through verbatim (the theme ends with an unmatched
 * `</section>`), while Astro's Markdown pipeline drops them. Neither affects
 * rendering, so both sides are normalised the same way.
 */
function dropUnmatchedEndTags(tokens) {
	const stack = [];
	const out = [];

	for (const token of tokens) {
		if (/^<[a-z][^>]*>$/.test(token) && !token.endsWith('/>')) {
			const name = /^<([a-z0-9-]+)/.exec(token)[1];
			// Void elements never have an end tag; anything closing them is a
			// stray (the theme has a `</img>`).
			if (!VOID_TAGS.has(name)) stack.push(name);
			out.push(token);
			continue;
		}
		if (/^<\/[a-z][^>]*>$/.test(token)) {
			const name = /^<\/([a-z0-9-]+)/.exec(token)[1];
			const at = stack.lastIndexOf(name);
			if (at === -1) continue; // unmatched -> parser ignores it
			stack.length = at;
			out.push(token);
			continue;
		}
		if (token.startsWith('comment:') || token === 'cdata:' || token === ':cdata') {
			out.push(token);
			continue;
		}
		out.push(token);
	}

	return out;
}

/** Strip the outer <html> wrapper differences that Astro always introduces. */
function normaliseText(content, file) {
	if (!/\.(html|xml)$/i.test(file)) return content.replace(/\s+/g, ' ').trim();

	const tokens = dropUnmatchedEndTags(tokenise(content));

	return tokens
		.filter(
			(token) =>
				// The generator meta is *supposed* to change: the site is no
				// longer built by Hexo.
				!/^<meta .*name=generator>/.test(token) &&
				// Hexo emitted the bootstrap bundle *after* </html>; Astro keeps
				// it inside <body>. HTML parsers relocate it either way, so the
				// closing tags carry no structural meaning here.
				token !== '</body>' &&
				token !== '</html>',
		)
		.join('\u0001');
}

/** First index where the two token streams diverge, with a little context. */
function firstDifference(a, b) {
	const ta = a.split('\u0001');
	const tb = b.split('\u0001');
	const n = Math.max(ta.length, tb.length);
	const clip = (s) => (s && s.length > 120 ? `${s.slice(0, 117)}...` : s);
	for (let i = 0; i < n; i++) {
		if (ta[i] !== tb[i]) {
			return {
				index: i,
				golden: ta.slice(Math.max(0, i - 3), i + 14).map(clip),
				build: tb.slice(Math.max(0, i - 3), i + 14).map(clip),
			};
		}
	}
	return null;
}

/**
 * search.xml lists one <entry> per post/page. Two things legitimately differ:
 *   - Hexo's page order came from its database insertion order (concurrent file
 *     processing), which cannot be reproduced;
 *   - the CDATA payload is only ever fed to a text search, so the HTML it
 *     embeds is compared with the same normalisation as the pages themselves.
 * Entries are therefore compared as a multiset.
 */
function entryMultiset(content) {
	return (content.match(/<entry>[\s\S]*?<\/entry>/g) ?? [])
		.map((entry) => normaliseText(entry, 'entry.html'))
		.sort();
}

/**
 * The visible text of a page: everything outside <script>/<style>, entities
 * decoded and whitespace collapsed. Catches changes the token comparison would
 * miss, such as a lost space between two inline elements.
 */
function textContent(html) {
	return decodeEntities(
		html
			.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
			.replace(/<!--[\s\S]*?-->/g, ' ')
			.replace(/<[^>]+>/g, ' '),
	)
		.replace(/\s+/g, ' ')
		.trim();
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const distFiles = (await listFiles(distDir)).filter((f) => !skip(f)).sort();
const goldenFiles = (await listFiles(goldenDir)).filter((f) => !skip(f)).sort();

const distSet = new Set(distFiles);
const goldenSet = new Set(goldenFiles);

const missing = goldenFiles.filter((f) => !distSet.has(f) && !INTENTIONALLY_REMOVED.test(f));
const removed = goldenFiles.filter((f) => !distSet.has(f) && INTENTIONALLY_REMOVED.test(f));
const extra = distFiles.filter((f) => !goldenSet.has(f));

const byteIdentical = [];
const structurallyIdentical = [];
const orderOnly = [];
const textMismatch = [];
const different = [];
/**
 * Page markup that the 2026 redesign replaced. Only meaningful when comparing
 * against the Hexo archive; the snapshot reference compares everything.
 */
const redesigned = [];

for (const file of goldenFiles) {
	if (!distSet.has(file)) continue;

	const a = await readMaybe(path.join(goldenDir, file));
	const b = await readMaybe(path.join(distDir, file));
	if (!a || !b) continue;

	if (a.equals(b)) {
		byteIdentical.push(file);
		continue;
	}

	const isMarkup = /\.(html|xml)$/i.test(file);

	// Every page was rewritten by the 2026 redesign, so against the Hexo archive
	// the page markup has no counterpart left to compare — only the copied
	// assets (css, js, images, fonts) are still checked. A snapshot baseline
	// compares everything, pages included.
	if (isMarkup && !usingSnapshot) {
		redesigned.push(file);
		continue;
	}

	if (!isMarkup && !/\.(txt|css|js|json|svg)$/i.test(file)) {
		different.push({ file, reason: 'binary differs' });
		continue;
	}

	const sa = a.toString('utf8');
	const sb = b.toString('utf8');

	if (file === 'search.xml') {
		const ea = entryMultiset(sa);
		const eb = entryMultiset(sb);
		if (ea.length === eb.length && ea.every((entry, i) => entry === eb[i])) {
			orderOnly.push(file);
			continue;
		}
		const titleOf = (entry = '') => (entry.match(/<title>(.*?)<\/title>/) ?? [])[1] ?? '?';
		const at = ea.findIndex((entry, i) => entry !== eb[i]);
		const A = ea[at] ?? '';
		const B = eb[at] ?? '';
		let pos = 0;
		while (pos < A.length && pos < B.length && A[pos] === B[pos]) pos++;
		different.push({
			file,
			diff: {
				index: at,
				golden: [`entry <${titleOf(A)}>`, JSON.stringify(A.slice(Math.max(0, pos - 120), pos + 200))],
				build: [`entry <${titleOf(B)}>`, JSON.stringify(B.slice(Math.max(0, pos - 120), pos + 200))],
			},
		});
		continue;
	}

	const na = normaliseText(sa, file);
	const nb = normaliseText(sb, file);

	if (na === nb) {
		structurallyIdentical.push(file);
		// A structural match can still hide a lost space between inline
		// elements; check the visible text too.
		if (isMarkup && file !== 'search.xml' && textContent(sa) !== textContent(sb)) {
			textMismatch.push(file);
		}
		continue;
	}

	different.push({ file, diff: firstDifference(na, nb) });
}

const pct = (n, total) => `${((n / (total || 1)) * 100).toFixed(1)}%`;

const isDiverged = (file) => CONTENT_DIVERGED.has(file);
const isKnownRendering = (file) => KNOWN_RENDERING_DIFFERENCES.has(file);

/** Differences that are neither content edits nor inherent framework quirks. */
const unexpected = different.filter((entry) => !isDiverged(entry.file) && !isKnownRendering(entry.file));
const unexpectedExtra = extra.filter((file) => !EXPECTED_EXTRA_FILES.has(file) && !usingSnapshot);

console.log(`\nReference: ${usingSnapshot ? 'snapshot (.baseline)' : 'Hexo archive'}`);
console.log(`Golden: ${goldenDir}`);
console.log(`Build : ${distDir}\n`);
console.log(`files in golden : ${goldenFiles.length}`);
console.log(`files in build  : ${distFiles.length}\n`);
console.log(`  byte-identical              : ${byteIdentical.length} (${pct(byteIdentical.length, goldenFiles.length)})`);
console.log(`  structurally identical      : ${structurallyIdentical.length}`);
console.log(`  order-only difference       : ${orderOnly.length}`);
console.log(`  visible text mismatch       : ${textMismatch.length}`);
console.log(`  UNEXPECTED differences      : ${unexpected.length}`);
if (redesigned.length) {
	console.log(`  redesigned pages            : ${redesigned.length}  (replaced by the 2026 redesign)`);
}
console.log(`  content diverged (expected) : ${different.filter((e) => isDiverged(e.file)).length}`);
console.log(`  rendering quirks (expected) : ${different.filter((e) => isKnownRendering(e.file) && !isDiverged(e.file)).length}`);
console.log(`  missing in build            : ${missing.length}`);
if (removed.length) {
	console.log(`  dropped on purpose          : ${removed.length}  (the orphaned /archives/ set)`);
}
console.log(`  new files with no peer      : ${extra.length}`);

if (missing.length) {
	console.log('\n--- missing in build ---');
	for (const f of missing) console.log(`  ${f}`);
}

if (extra.length) {
	console.log('\n--- new in the Astro build (no Hexo counterpart) ---');
	for (const f of extra) {
		const why = EXPECTED_EXTRA_FILES.get(f);
		console.log(`  ${f}${why ? '' : '   <-- UNEXPECTED'}`);
		if (why) console.log(`      ${why}`);
	}
}

const divergedEntries = different.filter((e) => isDiverged(e.file));
if (divergedEntries.length) {
	console.log('\n--- content diverged after the migration (expected) ---');
	for (const entry of divergedEntries) console.log(`  ${entry.file}\n      ${CONTENT_DIVERGED.get(entry.file)}`);
}

const renderingEntries = different.filter((e) => isKnownRendering(e.file) && !isDiverged(e.file));
if (renderingEntries.length) {
	console.log('\n--- inherent rendering differences (expected) ---');
	for (const entry of renderingEntries) console.log(`  ${entry.file}\n      ${KNOWN_RENDERING_DIFFERENCES.get(entry.file)}`);
}

if (unexpected.length) {
	console.log('\n--- UNEXPECTED DIFFERENCES ---');
	for (const entry of unexpected) {
		console.log(`  ${entry.file}${entry.reason ? ` (${entry.reason})` : ''}`);
		if (entry.diff) {
			console.log(`      golden: ${JSON.stringify(entry.diff.golden)}`);
			console.log(`      build : ${JSON.stringify(entry.diff.build)}`);
		}
	}
}

if (textMismatch.length) {
	console.log('\n--- visible text mismatch (structure OK, rendered text differs) ---');
	for (const f of textMismatch) console.log(`  ${f}`);
}

if (process.env.VERBOSE && structurallyIdentical.length) {
	console.log('\n--- structurally identical (formatting only) ---');
	for (const f of structurallyIdentical) console.log(`  ${f}`);
}

const ok = missing.length === 0 && unexpected.length === 0 && unexpectedExtra.length === 0 && textMismatch.length === 0;

if (redesigned.length) {
	console.log(`\n--- redesigned pages (${redesigned.length}) ---`);
	console.log('  Replaced wholesale by the 2026 redesign; the Hexo archive has no');
	console.log('  comparable markup. Run `npm run snapshot` to establish a new baseline.');
}

console.log(
	`\n${
		ok
			? usingSnapshot
				? 'RESULT: OK — the build matches the snapshot baseline'
				: `RESULT: OK — every asset still matches the Hexo archive; ${redesigned.length} page(s) redesigned`
			: 'RESULT: unexpected differences found'
	}\n`,
);
process.exit(ok ? 0 : 1);
