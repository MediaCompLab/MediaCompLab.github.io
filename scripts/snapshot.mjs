/**
 * Saves the current build as the reference for `npm run verify`.
 *
 * The original baseline was the archived Hexo output, which made sense while the
 * job was proving the migration. After the redesign that comparison no longer
 * describes anything, so the reference moves to a snapshot of a known-good
 * build: run this after reviewing a change, and `npm run verify` will afterwards
 * fail if anything moves unexpectedly.
 *
 * The snapshot lives in .baseline/ and is gitignored.
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const baseline = path.join(root, '.baseline');

if (!existsSync(path.join(dist, 'index.html'))) {
	console.error('No build found in dist/. Run `npm run build` first.');
	process.exit(1);
}

await rm(baseline, { recursive: true, force: true });
await mkdir(baseline, { recursive: true });
await cp(dist, baseline, { recursive: true });

console.log(`Baseline snapshot written to ${baseline}`);
console.log('`npm run verify` will now compare future builds against it.');
