import { visit } from 'unist-util-visit';

/**
 * Port of `hexo-util/lib/slugize.js`.
 *
 * The old site ran with the hexo-renderer-marked defaults, where
 * `modifyAnchors: 0`, i.e. `slugize()` without a case transform. Heading ids
 * therefore keep their original casing ("2021 - present" -> "2021-present"),
 * which is why Astro's own lower-casing github-slugger cannot be used as-is.
 */
const rControl = /[\u0000-\u001f]/g;
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'<>,.?/]+/g;

/**
 * Port of `hexo-util/lib/escape_diacritic.js`.
 *
 * hexo-util ships an explicit lookup table. Most of that table is exactly what
 * Unicode NFD decomposition already produces, so we decompose first and only
 * keep the letters that do not decompose (ligatures, stroked letters, ...).
 */
const NON_DECOMPOSABLE = {
	'\u00C6': 'AE', '\u01FC': 'AE', '\u01E2': 'AE',
	'\u00E6': 'ae', '\u01FD': 'ae', '\u01E3': 'ae',
	'\u00D8': 'O', '\u01FE': 'O', '\u00F8': 'o', '\u01FF': 'o',
	'\u00DF': 's',
	'\u0152': 'OE', '\u0153': 'oe',
	'\u0141': 'L', '\u0142': 'l',
	'\u0110': 'D', '\u0111': 'd',
	'\u00D0': 'D', '\u00F0': 'd',
	'\u00DE': 'TH', '\u00FE': 'th',
	'\u0126': 'H', '\u0127': 'h',
	'\u0131': 'i', '\u0130': 'I',
	'\u014A': 'N', '\u014B': 'n',
	'\u0166': 'T', '\u0167': 't',
	'\u0180': 'b', '\u0181': 'B',
	'\u0189': 'D', '\u018A': 'D', '\u018B': 'D',
	'\u0190': 'E', '\u018E': 'E', '\u0197': 'I',
	'\u0198': 'K', '\u0199': 'k',
	'\u019D': 'N', '\u019E': 'n',
	'\u01A0': 'O', '\u01A1': 'o',
	'\u01AF': 'U', '\u01B0': 'u',
	'\u01B5': 'Z', '\u01B6': 'z',
	'\u01C4': 'DZ', '\u01C5': 'Dz', '\u01C6': 'dz',
	'\u01C7': 'LJ', '\u01C8': 'Lj', '\u01C9': 'lj',
	'\u01CA': 'NJ', '\u01CB': 'Nj', '\u01CC': 'nj',
	'\u01F1': 'DZ', '\u01F2': 'Dz', '\u01F3': 'dz',
	'\u0192': 'f', '\u0195': 'hv', '\u0199': 'k',
	'\u019A': 'l', '\u019C': 'M', '\u019D': 'N',
	'\u01A2': 'OI', '\u01A3': 'oi',
	'\u01A4': 'P', '\u01A5': 'p',
	'\u0222': 'OU', '\u0223': 'ou',
	'\u0224': 'Z', '\u0225': 'z',
};

function escapeDiacritic(str) {
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\u0000-\u007E]/g, (ch) => NON_DECOMPOSABLE[ch] ?? ch);
}

export function slugize(str, options = {}) {
	if (typeof str !== 'string') throw new TypeError('str must be a string!');

	const separator = options.separator || '-';
	const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	const result = escapeDiacritic(str)
		.replace(rControl, '')
		.replace(rSpecial, separator)
		.replace(new RegExp(`${escapedSep}{2,}`, 'g'), separator)
		.replace(new RegExp(`^${escapedSep}+|${escapedSep}+$`, 'g'), '');

	switch (options.transform) {
		case 1:
			return result.toLowerCase();
		case 2:
			return result.toUpperCase();
		default:
			return result;
	}
}

function textOf(node) {
	let out = '';
	visit(node, (child) => {
		if (child.type === 'text') out += child.value;
	});
	return out;
}

/**
 * Re-implements `Renderer.heading()` from hexo-renderer-marked:
 *
 *   <h2 id="Some-Id"><a href="#Some-Id" class="headerlink" title="Some Id"></a>Some Id</h2>
 *
 * Astro's built-in heading-id plugin keeps an id that is already present, so
 * setting `properties.id` here wins.
 */
export function rehypeHexoHeading() {
	return (tree) => {
		const seen = new Map();

		visit(tree, 'element', (node) => {
			if (!/^h[1-6]$/.test(node.tagName)) return;

			const text = textOf(node);
			const base = slugize(text.trim());
			let id = base;

			// Add a number after id if repeated (hexo-renderer-marked behaviour):
			//   if (headingId[id]) id += `-${headingId[id]++}`; else headingId[id] = 1;
			if (seen.has(base)) {
				const n = seen.get(base);
				id = `${base}-${n}`;
				seen.set(base, n + 1);
			} else {
				seen.set(base, 1);
			}

			node.properties = { ...node.properties, id };
			node.children.unshift({
				type: 'element',
				tagName: 'a',
				properties: { href: `#${id}`, className: ['headerlink'], title: text },
				children: [],
			});
		});
	};
}
