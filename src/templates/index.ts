/**
 * The nunjucks templates that used to live in the Hexo project, imported as
 * raw strings so they are bundled into the prerendered endpoints (a runtime
 * `readFileSync` would not survive the build).
 */
import searchXml from './search.xml?raw';
import sitemapTxt from './sitemap.txt?raw';
import sitemapXml from './sitemap.xml?raw';

export const TEMPLATES: Record<string, string> = {
	'search.xml': searchXml,
	'sitemap.txt': sitemapTxt,
	'sitemap.xml': sitemapXml,
};
