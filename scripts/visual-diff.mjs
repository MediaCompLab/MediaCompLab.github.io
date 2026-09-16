/**
 * Renders the Astro build and the archived Hexo build in a headless browser and
 * compares the screenshots, region by region.
 *
 * Usage:
 *   node scripts/visual-diff.mjs [--shots 3] [--width 1400] [--height 900] [--keep]
 *
 * Why this exists on top of `npm run verify`: byte-level comparison of the HTML
 * famously missed a UTF-8 BOM that had been pasted into a <style> block. The
 * markup was "structurally identical" and the visible text matched, yet the
 * browser dropped the first CSS rule in that block and the home page hero moved.
 * Only rendering both builds side by side caught it.
 *
 * The pages animate (carousel, Ken Burns zoom, VANTA fog), so a single pair of
 * screenshots is never equal. The script takes N shots of each side and reports
 * the *minimum* difference across all pairs: if the two builds render the same,
 * some pair will line up almost exactly.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : Number(args[i + 1]);
};

const SHOTS = arg('shots', 3);
const WIDTH = arg('width', 1400);
const HEIGHT = arg('height', 900);
const KEEP = args.includes('--keep');

const OLD_DIR = path.resolve(
	process.env.REFERENCE_DIR ??
		(existsSync(path.join(root, '.baseline', 'index.html'))
			? path.join(root, '.baseline')
			: path.join(root, '..', 'hexo', 'public')),
);
const NEW_DIR = path.join(root, 'dist');
const SHOT_DIR = path.join(root, '.visual-diff');
const PAGE = '/';

/** Regions of the home page, in CSS pixels. */
const REGIONS = [
	['顶部横幅 + 导航栏', 0, 150],
	['轮播图 + 大标题', 150, 650],
	['正文', 650, 900],
];

const BROWSERS = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.xml': 'application/xml; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.woff': 'font/woff',
	'.ico': 'image/x-icon',
};

function serve(dir) {
	return new Promise((resolve) => {
		const server = createServer(async (req, res) => {
			try {
				const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
				let file = path.join(dir, rel);
				const { stat } = await import('node:fs/promises');
				const info = await stat(file).catch(() => null);
				if (!info || info.isDirectory()) file = path.join(file, 'index.html');
				const body = await readFile(file);
				res.writeHead(200, {
					'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
				});
				res.end(body);
			} catch {
				res.writeHead(404).end('not found');
			}
		});
		server.listen(0, '127.0.0.1', () => resolve(server));
	});
}

function run(bin, argv) {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, argv, { stdio: 'ignore' });
		child.on('error', reject);
		child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`))));
	});
}

function pixels(a, b) {
	if (a.width !== b.width || a.height !== b.height) {
		throw new Error(`Size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
	}
	const out = new Uint8Array(a.width * a.height);
	for (let y = 0; y < a.height; y++) {
		for (let x = 0; x < a.width; x++) {
			const i = (y * a.width + x) << 2;
			const d =
				Math.abs(a.data[i] - b.data[i]) +
				Math.abs(a.data[i + 1] - b.data[i + 1]) +
				Math.abs(a.data[i + 2] - b.data[i + 2]);
			out[y * a.width + x] = d > 12 ? 1 : 0;
		}
	}
	return out;
}

const countIn = (mask, png, y0, y1) => {
	let n = 0;
	for (let y = y0; y < Math.min(y1, png.height); y++) {
		for (let x = 0; x < png.width; x++) n += mask[y * png.width + x];
	}
	return n;
};

/* ------------------------------------------------------------------ */

if (!existsSync(OLD_DIR) || !existsSync(path.join(OLD_DIR, 'index.html'))) {
	console.error(
		`找不到参考构建: ${OLD_DIR}\n` +
			'先运行 npm run snapshot 建立基线（或设置 REFERENCE_DIR 指向另一次构建）。',
	);
	process.exit(2);
}
if (!existsSync(path.join(NEW_DIR, 'index.html'))) {
	console.error(`找不到新站构建产物: ${NEW_DIR}\n请先执行 npm run build。`);
	process.exit(2);
}

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
	console.error('没有找到 Chrome 或 Edge，无法截图。');
	process.exit(2);
}

await rm(SHOT_DIR, { recursive: true, force: true });
await mkdir(SHOT_DIR, { recursive: true });

const oldServer = await serve(OLD_DIR);
const newServer = await serve(NEW_DIR);
const portOf = (s) => s.address().port;

const FLAGS = [
	'--headless=new',
	'--disable-gpu',
	'--hide-scrollbars',
	'--force-device-scale-factor=1',
	`--window-size=${WIDTH},${HEIGHT}`,
	'--virtual-time-budget=900',
	'--no-first-run',
	'--no-default-browser-check',
	'--disable-extensions',
];

console.log(`浏览器: ${browser}`);
console.log(`窗口:   ${WIDTH}x${HEIGHT}   每个站点截 ${SHOTS} 张\n`);

const shots = { old: [], new: [] };
for (const [side, server] of [
	['old', oldServer],
	['new', newServer],
]) {
	for (let i = 1; i <= SHOTS; i++) {
		const file = path.join(SHOT_DIR, `${side}-${i}.png`);
		await run(browser, [...FLAGS, `--screenshot=${file}`, `http://127.0.0.1:${portOf(server)}${PAGE}`]);
		shots[side].push(PNG.sync.read(await readFile(file)));
	}
	process.stdout.write(`${side === 'old' ? '旧站' : '新站'} 截图完成\n`);
}

oldServer.close();
newServer.close();

let failures = 0;
for (const [label, y0, y1] of REGIONS) {
	let best = Infinity;
	let worst = 0;
	for (const a of shots.old) {
		for (const b of shots.new) {
			const mask = pixels(a, b);
			best = Math.min(best, countIn(mask, a, y0, y1));
		}
	}
	for (let i = 1; i < shots.old.length; i++) {
		worst = Math.max(worst, countIn(pixels(shots.old[0], shots.old[i]), shots.old[0], y0, y1));
	}

	const total = (Math.min(y1, HEIGHT) - y0) * WIDTH;
	const pct = ((best / total) * 100).toFixed(3);
	const verdict = best === 0 ? '完全一致' : best <= worst ? '一致（在动画抖动范围内）' : '不一致';
	if (best !== 0 && best > worst) failures++;

	console.log(
		`${label.padEnd(18)} 最佳匹配差异 ${String(best).padStart(7)} / ${total} 像素 (${pct}%)` +
			`   旧站动画抖动上限 ${worst}   → ${verdict}`,
	);
}

if (!KEEP) await rm(SHOT_DIR, { recursive: true, force: true });
else console.log(`\n截图保留在 ${SHOT_DIR}`);

console.log(
	failures === 0
		? '\n视觉比对通过：两个构建渲染一致。\n'
		: '\n视觉比对发现差异，请查看截图。\n',
);
process.exit(failures === 0 ? 0 : 1);
