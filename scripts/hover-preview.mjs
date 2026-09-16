/**
 * Screenshots a card page (People / Alumni) with the :hover state forced open,
 * so the "more" panels can be checked for overflow. Works on a throwaway copy of
 * dist/ — the real build is never modified.
 *
 * Usage: npm run hover-preview -- people/alumni
 *        node scripts/hover-preview.mjs people/alumni [output.png]
 *
 * Pass the path WITHOUT a leading slash: npm runs scripts through Git Bash on
 * Windows, which rewrites a leading-slash argument into a Windows path.
 *
 * Output defaults to .visual-diff/hover-<page>.png (gitignored).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rawPath = process.argv[2] ?? 'people';
const pagePath = `/${rawPath.replace(/^\/+|\/+$/g, '')}`;
const outFile =
	process.argv[3] ??
	path.join('.visual-diff', `hover-${pagePath.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}.png`);

const tmp = path.join(process.env.TEMP ?? '/tmp', 'dsh-hover-check');
const dist = path.resolve('dist');

await cp(dist, tmp, { recursive: true, force: true });

// Force every card into its hovered end state.
//
// The card follows the Hexo mechanic — the plate grows from a 150px scrim at the
// foot of the picture to the full card height, and the biography slides up from
// below the fold (bottom: -100% -> 0) — but the sheet is dark, because the type
// on this card is white. Forcing the old white sheet would render white text on
// white and look like the preview had failed.
const OVERRIDE = `<style id="force-hover">
.person__body {
	height: 100% !important;
	padding-top: 60px !important;
	background: linear-gradient(0deg, rgba(6, 14, 32, 0.93) 0%, rgba(6, 14, 32, 0.9) 52%, rgba(6, 14, 32, 0.86) 100%) !important;
	z-index: 10 !important;
}
.person__bio { bottom: 0 !important; }
.person__photo img { transform: scale(1.06) !important; opacity: .5 !important; }
.person { transform: translateY(-8px) !important; }
</style>`;

// postbuild.mjs flattens non-index content pages to `<name>.html`, so try both.
const rel = pagePath.replace(/^\/+|\/+$/g, '');
if (/^[A-Za-z]:/.test(rel)) {
	throw new Error(
		`Expected a site path such as "people/alumni", got "${rel}".\n` +
			'On Windows, npm runs scripts through Git Bash, which rewrites a leading "/". Drop the leading slash.',
	);
}
const candidates = [path.join(tmp, rel, 'index.html'), path.join(tmp, `${rel}.html`)];
const { existsSync: exists } = await import('node:fs');
const target = candidates.find((p) => exists(p));
if (!target) throw new Error(`No built page for ${pagePath} (tried ${candidates.join(', ')})`);

const html = await readFile(target, 'utf8');
await writeFile(target, html.replace('</head>', `${OVERRIDE}</head>`));

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
	const { stat } = await import('node:fs/promises');
	try {
		const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		// Mirror how the real server resolves paths: a directory serves its
		// index.html, and `/people/alumni` comes from `people/alumni.html`
		// because postbuild.mjs flattened it.
		const base = path.join(tmp, rel);
		const info = await stat(base).catch(() => null);
		let file = base;
		if (info?.isDirectory()) file = path.join(base, 'index.html');
		else if (!info) {
			if (existsSync(`${base}.html`)) file = `${base}.html`;
			else if (existsSync(path.join(base, 'index.html'))) file = path.join(base, 'index.html');
		}
		// Read before writing headers so a late failure can still 404 cleanly.
		const body = await readFile(file);
		res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
		res.end(body);
	} catch {
		if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('not found');
	}
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
const { existsSync } = await import('node:fs');
const chrome = BROWSERS.find((p) => existsSync(p));

await mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
await new Promise((resolve, reject) => {
	const child = spawn(chrome, [
		'--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
		'--window-size=1400,2400', '--virtual-time-budget=1200',
		`--screenshot=${path.resolve(outFile)}`, `http://127.0.0.1:${port}${pagePath}`,
	], { stdio: 'ignore' });
	child.on('error', reject);
	child.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`chrome exited ${c}`))));
});

server.close();
console.log(`已输出 ${path.resolve(outFile)}（${pagePath}，悬停状态全部展开）`);
