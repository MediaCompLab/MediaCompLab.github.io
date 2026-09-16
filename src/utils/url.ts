import type { CollectionEntry } from 'astro:content';
import { SITE } from '../consts';

export type PostEntry = CollectionEntry<'posts'>;
export type PageEntry = CollectionEntry<'pages'>;

export const SITE_URL = SITE.url;

/* ------------------------------------------------------------------ *
 * URL helpers — ports of hexo-util
 * ------------------------------------------------------------------ */

/** Port of hexo-util `escapeURL`/`encodeURL` for the (relative) paths we emit. */
export function encodeURL(str: string): string {
	// Absolute URLs keep their own encoding; the old site only ever passed
	// root-relative permalinks through here.
	if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(str)) return str;
	return encodeURI(unescapePercent(str));
}

/** `querystring.unescape` in spirit: %XX back to raw characters. */
function unescapePercent(str: string): string {
	return str.replace(/%([0-9A-Fa-f]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * `url_for()` with `root: '/'` — every path on this site already starts with a
 * slash, so this is just the URL encoding step.
 */
export function urlFor(path: string): string {
	return encodeURL(path);
}

/** `pretty_urls` handling from _config.yml (trailing_index/trailing_html: false). */
export function prettyUrl(hexoPath: string): string {
	let out = hexoPath;
	if (out.endsWith('index.html')) out = out.slice(0, -'index.html'.length);
	else if (out.endsWith('.html')) out = out.slice(0, -'.html'.length);
	if (!out.startsWith('/')) out = `/${out}`;
	return out;
}

export function absoluteUrl(path: string): string {
	return `${SITE_URL}${path}`;
}

/**
 * Port of hexo-util `isExternalLink` for the single-host case this site uses
 * (no `exclude` list in _config.yml).
 */
export function isExternalLink(input: string, sitehost: string = SITE.hostname): boolean {
	if (!/^(\/\/|http(s)?:)/.test(input)) return false;

	let data: URL;
	try {
		data = new URL(input, `http://${sitehost}`);
	} catch {
		return false;
	}

	if (data.origin === 'null') return false;

	return data.hostname !== sitehost;
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

type DateLike = Date | string | number;

const pad = (n: number) => String(n).padStart(2, '0');

/** Zero-padded two-digit number, as used by the permalink months/days. */
export const pad2 = pad;

function toDate(value: DateLike): Date {
	return value instanceof Date ? value : new Date(value);
}

/**
 * Front matter dates are written the way Hexo wrote them — `2023-05-19 21:17:40`
 * with no timezone — and the YAML parser turns that into a *UTC* timestamp.
 * Hexo/moment treated the same string as local wall-clock time, so reading the
 * UTC components back reproduces the original rendering exactly, and does so
 * independently of the build machine's timezone.
 */
export function getDateParts(value: DateLike) {
	const date = toDate(value);

	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
		hour: date.getUTCHours(),
		minute: date.getUTCMinutes(),
		second: date.getUTCSeconds(),
	};
}

/** moment's `YYYY-MM-DD` */
export function formatDate(value: DateLike) {
	const { year, month, day } = getDateParts(value);
	return `${year}-${pad(month)}-${pad(day)}`;
}

/** moment's `MM-DD` */
export function formatMonthDay(value: DateLike) {
	const { month, day } = getDateParts(value);
	return `${pad(month)}-${pad(day)}`;
}

/** moment's `YYYY-MM-DD HH:mm:ss` */
export function formatDateTime(value: DateLike) {
	const { hour, minute, second } = getDateParts(value);
	return `${formatDate(value)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/* ------------------------------------------------------------------ *
 * Slugs
 * ------------------------------------------------------------------ */

/** Port of hexo-util `slugize` with `modifyAnchors: 0` (no case transform). */
const rControl = /[\u0000-\u001f]/g;
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'<>,.?/]+/g;

export function slugize(str: string, separator = '-'): string {
	const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return str
		.replace(rControl, '')
		.replace(rSpecial, separator)
		.replace(new RegExp(`${escapedSep}{2,}`, 'g'), separator)
		.replace(new RegExp(`^${escapedSep}+|${escapedSep}+$`, 'g'), '');
}
