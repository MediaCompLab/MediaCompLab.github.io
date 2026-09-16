/**
 * Site + theme configuration.
 *
 * These values are a direct port of the two YAML files that drove the Hexo
 * build:
 *   - hexo/_config.yml            -> SITE
 *   - hexo/themes/oranges/_config.yml -> THEME
 *
 * Keeping them in one typed module means the Astro build renders the same
 * markup as `hexo generate` did, without a hexo dependency.
 */

export const SITE = {
	title: 'MC Lab',
	subtitle: '',
	description: '',
	keywords: '',
	author: 'MC Lab',
	language: 'en',
	/** `url` in _config.yml, without the trailing slash. */
	url: 'https://mediacomplab.com',
	hostname: 'mediacomplab.com',
	/** permalink: :year/:month/:day/:title/ */
	permalink: ':year/:month/:day/:title/',
} as const;

export type NavItem = {
	name: string;
	enable: boolean;
	path: string;
	key: string;
};

export type FooterLink = {
	name: string;
	icon: string;
	path: string;
};

/** theme.navbar — order matters, it is rendered verbatim. */
export const NAVBAR: NavItem[] = [
	{ name: 'RESEARCH', enable: true, path: '/research/', key: 'research' },
	{ name: 'PEOPLE', enable: true, path: '/people/', key: 'people' },
	// ARCHIVES was removed from this list along with the pages themselves. The
	// Hexo theme shipped the entry disabled and nothing ever linked to the route,
	// so leaving a disabled item pointing at a page that no longer exists is just
	// a trap for whoever flips `enable` to true.
	{ name: 'NEWS', enable: true, path: '/tags/', key: 'tags' },
	{ name: 'PUBLICATIONS', enable: true, path: '/publications/', key: 'publications' },
	{ name: 'Categories', enable: false, path: '/categories/', key: 'categories' },
	{ name: 'Friends', enable: false, path: '/friends/', key: 'friends' },
];

/** Whether the navbar exposes a `tags` / `categories` entry (post.ejs checks this). */
export const NAVBAR_HAS_TAGS = NAVBAR.some((item) => item.key === 'tags' && item.enable);
export const NAVBAR_HAS_CATEGORIES = NAVBAR.some((item) => item.key === 'categories' && item.enable);

export const THEME = {
	favicon: {
		enable: true,
		icon: '/images/icon_black.png',
		touchIcon: '/images/icon_white.png',
	},
	avatar: {
		authorPhoto: '/images/icon.png',
		authorNickname: 'Lab',
		path: '/',
	},
	gtag: {
		enable: true,
		key: 'G-SRWK7ST5HM',
	},
	comments: {
		enable: true,
		gitalk: {
			enable: false,
			clientID: '',
			clientSecret: '',
			repo: 'https://github.com/angushushu/angushushu.github.io',
			owner: 'angushushu',
			admin: 'angushushu',
		},
		valine: {
			enable: true,
			appId: 'ev2Nl7Q4Pi6exUdgpptshLIz-gzGzoHsz',
			appKey: 'HH88IUeE7znKAJZDg5g7dINA',
			placeholder: 'listening...',
			avatar: 'retro',
			vemptyDisplay: true,
		},
		disqus: {
			enable: false,
			shortname: 'https-angushushu-github-io',
		},
		waline: {
			enable: false,
			serverURL: '',
		},
	},
	catalog: { enable: true },
	prevnext: { enable: true },
	friends: [
		{ nickname: 'Zcheng', site: 'https://zcheng.site/', meta: '' },
		{ nickname: 'Hexo', site: 'https://hexo.io/', meta: '' },
	],
	footer: {
		social: [
			{ name: 'github', icon: 'github', path: 'https://github.com/MediaCompLab' },
			{ name: 'email', icon: 'envelope', path: 'mailto:jmagliano@gsu.edu' },
		] as FooterLink[],
		more: [
			// The Hexo theme's footer carried the copyright line and nothing else.
			// The affiliation line that used to sit above it was added during the
			// redesign; the college lockup in the masthead already says as much.
			{
				name: 'Copyright © {thisYear} Media Comprehension Lab',
				path: 'https://github.com/MediaCompLab/MediaCompLab.github.io',
			},
		],
		views: { enable: false, provider: '', item: [] as unknown[] },
	},
	search: { enable: true, placeholder: '' },
	colorSwitch: { enable: false },
	postShare: {
		enable: true,
		twitter: { enable: true },
		facebook: { enable: true },
	},
	codeBlock: {
		/** 'normal' (default) or 'mac-black' — loads css/figcaption/mac-block.css. */
		style: 'normal' as 'normal' | 'mac-black',
		copy: { enable: true },
	},
	mathjax: { enable: true },
	cdns: {
		jquery: { enable: false, url: 'https://cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.min.js' },
		fancybox: {
			enable: false,
			url: {
				css: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.css',
				js: 'https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.js',
			},
		},
		mathjax: { enable: false, url: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js' },
		clipboard: { enable: false, url: 'https://cdn.jsdelivr.net/npm/clipboard@2.0.10/dist/clipboard.min.js' },
		comments: {
			gitalk: { enable: false, url: { css: '', js: '' } },
			valine: { enable: true, url: 'https://cdn.jsdelivr.net/npm/valine@1.4.18/dist/Valine.min.js' },
			waline: { enable: false, url: 'https://cdn.jsdelivr.net/npm/@waline/client@2.5.1/dist/legacy.min.js' },
		},
	},
	themeColor: '#808080',
} as const;
