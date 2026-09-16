/**
 * Renders a page in its `@media (hover: none)` layout — the touch fallback for
 * the People cards, where the biography has to be visible without a hover.
 *
 * Chrome will not emulate `hover`/`pointer` in headless mode: neither
 * `Emulation.setEmulatedMedia` with those features nor
 * `--blink-settings=primaryHoverType=none,...` makes `(hover: none)` match. So
 * this swaps that one condition for an always-true one in a throwaway copy of
 * the build. The declarations inside the block are the real ones from
 * src/styles/site.css — only the condition changes.
 *
 * Usage: npm run touch-preview -- people [width]
 *        node scripts/touch-preview.mjs people [width] [out.png]
 *
 * Pass the path WITHOUT a leading slash: npm runs scripts through Git Bash on
 * Windows, which rewrites a leading-slash argument into a Windows path.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const rawPath = process.argv[2] ?? 'people';
const pagePath = `/${rawPath.replace(/^\/+|\/+$/g, '')}`;
if (/^[A-Za-z]:/.test(rawPath.replace(/^\/+/, ''))) {
	throw new Error(
		`Expected a site path such as "people", got "${rawPath}".\n` +
			'On Windows, npm runs scripts through Git Bash, which rewrites a leading "/". Drop the leading slash.',
	);
}

const width = Number(process.argv[3] ?? 420);
const outFile =
	process.argv[4] ??
	path.join('.visual-diff', `touch-${pagePath.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}.png`);

const tmp = path.join(process.env.TEMP ?? '/tmp', 'dsh-touch-preview');
await cp(path.resolve('dist'), tmp, { recursive: true, force: true });

const QUERY = '@media(hover:none)'; // as the minifier writes it
let patched = 0;
for (const name of await readdir(path.join(tmp, '_astro'))) {
	if (!name.endsWith('.css')) continue;
	const file = path.join(tmp, '_astro', name);
	const css = await readFile(file, 'utf8');
	if (!css.includes(QUERY)) continue;
	await writeFile(file, css.replaceAll(QUERY, '@media(min-width:0px)'));
	patched += css.split(QUERY).length - 1;
}
if (!patched) throw new Error(`No ${QUERY} block found in the built CSS`);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
	const { stat } = await import('node:fs/promises');
	try {
		const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		const base = path.join(tmp, rel);
		const info = await stat(base).catch(() => null);
		let file = base;
		if (info?.isDirectory()) file = path.join(base, 'index.html');
		else if (!info) {
			if (existsSync(`${base}.html`)) file = `${base}.html`;
			else if (existsSync(path.join(base, 'index.html'))) file = path.join(base, 'index.html');
		}
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

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));

await new Promise((resolve, reject) => {
	const child = spawn(
		chrome,
		[
			'--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
			`--window-size=${width + 20},1900`, '--virtual-time-budget=2500',
			`--screenshot=${path.resolve(outFile)}`, `http://127.0.0.1:${port}${pagePath}`,
		],
		{ stdio: 'ignore' },
	);
	child.on('error', reject);
	child.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`chrome exited ${c}`))));
});

server.close();
console.log(`已输出 ${path.resolve(outFile)}（${pagePath}，${width}px 触屏布局）`);
