/**
 * Site behaviour — one small vanilla module, no jQuery, no Bootstrap.
 *
 * Everything degrades gracefully: if a hook is missing on a page, the
 * corresponding block simply does not run.
 */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------ *
 * Header — shadow on scroll, mobile menu, sliding nav indicator
 * ------------------------------------------------------------------ */

function initHeader() {
	const header = $('#site-header');
	const nav = $('#site-nav');
	const toggle = $('#nav-toggle');
	const indicator = $('#nav-indicator');

	if (header) {
		/**
		 * How far the reader scrolls before the masthead is fully condensed.
		 *
		 * The height is interpolated across this distance rather than switched at
		 * a threshold: toggling a class at `scrollY > 8` made the whole 44px
		 * collapse fire the instant the page moved, which reads as the header
		 * snapping shut. Tying it to the scroll position means it moves with the
		 * reader instead.
		 */
		const CONDENSE_DISTANCE = 180;
		let frame = 0;

		const update = () => {
			frame = 0;
			const y = window.scrollY;
			// The shadow still arrives immediately — it is what separates the bar
			// from the page, and it should be there the moment they overlap.
			header.classList.toggle('is-stuck', y > 8);
			const condensed = Math.min(1, Math.max(0, y / CONDENSE_DISTANCE));
			// On the document element, not the header: `--bar-h` is defined on
			// `:root` and resolves `--condense` against its own element, so a value
			// set further down would not reach it.
			document.documentElement.style.setProperty('--condense', condensed.toFixed(3));
		};

		update();
		window.addEventListener(
			'scroll',
			() => {
				if (!frame) frame = requestAnimationFrame(update);
			},
			{ passive: true },
		);
	}

	if (toggle && nav) {
		toggle.addEventListener('click', () => {
			const open = nav.classList.toggle('is-open');
			toggle.setAttribute('aria-expanded', String(open));
		});
		nav.addEventListener('click', (event) => {
			if (event.target instanceof HTMLAnchorElement) {
				nav.classList.remove('is-open');
				toggle.setAttribute('aria-expanded', 'false');
			}
		});
	}

	if (!indicator) return;

	const links = $$('[data-nav]');
	const moveTo = (link) => {
		if (!link || window.innerWidth <= 960) {
			indicator.classList.remove('is-visible');
			return;
		}
		// Only the horizontal position is computed: CSS pins the rule to the
		// base line (`bottom: -3px`, as the Hexo `#magic-line` was). Measuring
		// both boxes keeps it correct whatever padding the header or links carry,
		// and the 14px inset makes it span the label rather than the padding —
		// the Hexo links had none, so theirs spanned the text exactly.
		const header = indicator.parentElement.getBoundingClientRect();
		const rect = link.getBoundingClientRect();
		indicator.style.width = `${rect.width - 28}px`;
		indicator.style.transform = `translateX(${rect.left - header.left + 14}px)`;
		indicator.classList.add('is-visible');
	};

	const active = () => {
		/**
		 * The link the rule rests under. Returns null on the home page, which is
		 * what the theme did: `activeNav.js` only marked items carrying
		 * `data-path`, and HOME was hard-coded outside the loop that generated
		 * them, so `getActiveItem()` found nothing and the line's width was set to
		 * 0. Hovering a link still shows it; leaving the nav returns it to hidden.
		 */
		const current = $('[data-nav][aria-current="page"]');
		return current && current.getAttribute('href') !== '/' ? current : null;
	};

	requestAnimationFrame(() => moveTo(active()));
	window.addEventListener('resize', () => moveTo(active()), { passive: true });

	for (const link of links) {
		link.addEventListener('mouseenter', () => moveTo(link));
	}
	const list = $('.site-nav__list');
	if (list) list.addEventListener('mouseleave', () => moveTo(active()));
}

/* ------------------------------------------------------------------ *
 * Hero carousel
 * ------------------------------------------------------------------ */

/* Photo rotation pauses offscreen, in background tabs and during keyboard use. */
function initHero() {
	const hero = $('#hero');
	if (!hero) return;
	const media = window.matchMedia('(prefers-reduced-motion: reduce)');
	const slides = $$('[data-slide]', hero);
	const toggle = $('[data-motion-toggle]', hero);
	const bar = $('#hero-progress');
	const title = $('.hero__title', hero);
	let paused = media.matches;
	let visible = false;
	let focused = false;
	let current = 0;
	let timer;

	/* Replay the per-letter title entrance; `backwards` fill hands `transform`
	   back afterwards so the letter hover keeps working. */
	const animateTitle = () => {
		if (!title || media.matches) return;
		title.classList.remove('is-animating');
		void title.offsetWidth;
		title.classList.add('is-animating');
	};

	const show = (next) => {
		current = (next + slides.length) % slides.length;
		const count = $('[data-photo-count]', hero);
		if (count) count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
		for (const [i, slide] of slides.entries()) {
			slide.classList.toggle('is-active', i === current);
			slide.setAttribute('aria-hidden', String(i !== current));
		}
		animateTitle();
	};
	const sync = () => {
		window.clearInterval(timer);
		const running = !paused && !media.matches && visible && !focused && !document.hidden;
		hero.classList.toggle('is-motion-paused', !running);
		bar?.classList.remove('is-running');
		if (running) {
			void bar?.offsetWidth;
			bar?.classList.add('is-running');
			timer = window.setInterval(() => {
				show(current + 1);
				bar?.classList.remove('is-running');
				void bar?.offsetWidth;
				bar?.classList.add('is-running');
			}, Number(hero.dataset.interval) || 6000);
		}
		if (toggle) {
			toggle.textContent = media.matches ? 'Motion paused' : paused ? 'Resume motion' : 'Pause motion';
			toggle.setAttribute('aria-pressed', String(paused || media.matches));
			toggle.disabled = media.matches;
		}
	};
	if (toggle) {
		toggle.hidden = false;
		toggle.addEventListener('click', () => { paused = !paused; sync(); });
	}
	for (const button of $$('[data-hero]', hero)) {
		button.addEventListener('click', () => {
			show(current + (button.dataset.hero === 'next' ? 1 : -1));
			sync();
		});
	}
	hero.addEventListener('focusin', () => { focused = true; sync(); });
	hero.addEventListener('focusout', (event) => {
		if (!hero.contains(event.relatedTarget)) { focused = false; sync(); }
	});
	media.addEventListener('change', () => { paused = media.matches; sync(); });
	document.addEventListener('visibilitychange', sync);
	if ('IntersectionObserver' in window) {
		new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(hero);
	} else { visible = true; }

	initHeroControls(hero);
	initHeroSwipe(hero, (step) => {
		show(current + step);
		sync();
	});

	show(0);
	sync();
}

/* ------------------------------------------------------------------ *
 * Hero controls — appear only when the pointer is where they belong
 * ------------------------------------------------------------------ */

/**
 * The arrows hang at the container's edges and stay invisible until the pointer
 * is inside that edge; the counter and pause switch fade in only in the top-right
 * corner they occupy. Everything else keeps the photograph clean.
 *
 * Tracked from `mousemove` on the hero rather than with CSS edge strips: an
 * overlay big enough to catch the pointer would also swallow the per-letter
 * hover on the wordmark underneath it.
 */
function initHeroControls(hero) {
	const prev = $('.hero__arrow--prev', hero);
	const next = $('.hero__arrow--next', hero);
	if (!prev && !next) return;

	/** Minimum fraction of the width that counts as "at the edge". */
	const EDGE = 0.18;
	/** The corner the counter and pause switch live in. */
	const CONTROLS = { width: 340, height: 120 };

	/**
	 * Where each arrow's zone ends, measured from the hero's left edge.
	 *
	 * The zone cannot simply be a fraction of the width. The arrows sit at the
	 * container's edge — `max(gutter, (100% - 1140px) / 2)` — which on a wide
	 * viewport is *further in* than any fixed fraction: past roughly 1780px the
	 * arrow falls outside an 18% zone, so moving the pointer onto it left the
	 * zone and the arrow vanished. Deriving the boundary from the arrow's own
	 * rectangle, with the fraction as a floor, is correct at every width.
	 */
	let zone = { prev: 0, next: Number.POSITIVE_INFINITY };

	const measure = () => {
		const box = hero.getBoundingClientRect();
		const prevRect = prev?.getBoundingClientRect();
		const nextRect = next?.getBoundingClientRect();
		zone = {
			prev: prevRect ? Math.max(box.width * EDGE, prevRect.right - box.left + 48) : 0,
			next: nextRect
				? Math.min(box.width * (1 - EDGE), nextRect.left - box.left - 48)
				: Number.POSITIVE_INFINITY,
		};
	};

	let pointer = null;
	let frame = 0;

	const update = () => {
		frame = 0;
		if (pointer === null) {
			hero.classList.remove('is-near-controls');
			prev?.classList.remove('is-shown');
			next?.classList.remove('is-shown');
			return;
		}
		const box = hero.getBoundingClientRect();
		hero.classList.toggle(
			'is-near-controls',
			pointer.x > box.width - CONTROLS.width && pointer.y < CONTROLS.height,
		);
		prev?.classList.toggle('is-shown', pointer.x < zone.prev);
		next?.classList.toggle('is-shown', pointer.x > zone.next);
	};

	measure();
	window.addEventListener('resize', measure, { passive: true });

	hero.addEventListener(
		'mousemove',
		(event) => {
			const box = hero.getBoundingClientRect();
			pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
			if (!frame) frame = requestAnimationFrame(update);
		},
		{ passive: true },
	);
	hero.addEventListener('mouseleave', () => {
		pointer = null;
		update();
	});
}

/* ------------------------------------------------------------------ *
 * Hero swipe — the touch equivalent of the arrows
 * ------------------------------------------------------------------ */

/**
 * A horizontal drag steps the carousel; a vertical one is left alone so the page
 * still scrolls. 40px and a 1.4 ratio keep a slightly diagonal flick from firing
 * the carousel when the reader meant to scroll.
 */
function initHeroSwipe(hero, step) {
	let start = null;

	hero.addEventListener(
		'touchstart',
		(event) => {
			start =
				event.touches.length === 1
					? { x: event.touches[0].clientX, y: event.touches[0].clientY }
					: null;
		},
		{ passive: true },
	);

	hero.addEventListener(
		'touchend',
		(event) => {
			if (!start) return;
			const touch = event.changedTouches[0];
			const dx = touch.clientX - start.x;
			const dy = touch.clientY - start.y;
			start = null;
			if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
			step(dx < 0 ? 1 : -1);
		},
		{ passive: true },
	);

	hero.addEventListener('touchcancel', () => {
		start = null;
	});
}

/* ------------------------------------------------------------------ *
 * Floating tools — back to top, share menu
 * ------------------------------------------------------------------ */

function initTools() {
	const backToTop = $('#back-to-top');
	if (backToTop) {
		const onScroll = () => backToTop.classList.toggle('is-hidden', window.scrollY < 400);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		backToTop.addEventListener('click', () => {
			window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
		});
	}

	const shareToggle = $('#share-toggle');
	const shareMenu = $('#share-menu');
	if (shareToggle && shareMenu) {
		shareToggle.addEventListener('click', () => {
			const open = shareMenu.hidden;
			shareMenu.hidden = !open;
			shareToggle.setAttribute('aria-expanded', String(open));
		});
	}
}

/* ------------------------------------------------------------------ *
 * Search — reads /search.xml, no jQuery
 * ------------------------------------------------------------------ */

/**
 * News titles are stored as `#Headline@https://link`; the `#` and the URL are
 * addressing, not display text.
 */
function displayTitle(raw) {
	const title = (raw ?? '').trim();
	if (!title.startsWith('#')) return title;
	const [text] = title.split('@');
	return text.slice(1).trim() || title;
}

async function loadIndex() {
	const response = await fetch('/search.xml', { headers: { accept: 'application/xml' } });
	if (!response.ok) throw new Error(`search.xml: ${response.status}`);
	const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
	return [...xml.querySelectorAll('entry')].map((entry) => ({
		title: displayTitle(entry.querySelector('title')?.textContent),
		url: entry.querySelector('url')?.textContent?.trim() ?? '',
		content: (entry.querySelector('content')?.textContent ?? '').replace(/<[^>]+>/g, ' '),
	}));
}

function initSearch() {
	const overlay = $('#search-overlay');
	const openButton = $('#search-toggle');
	const closeButton = $('#search-close');
	const input = $('#search-input');
	const results = $('#search-results');
	if (!overlay || !openButton || !input || !results) return;

	let entries = null;
	let loading = false;

	const render = (html) => {
		results.innerHTML = html;
	};

	const escape = (value) =>
		value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

	const search = (rawQuery) => {
		const query = rawQuery.trim().toLowerCase();
		if (query.length === 0) {
			render('<p class="search-empty">Start typing to search the lab site.</p>');
			return;
		}
		if (!entries) return;

		const keywords = query.split(/[\s-]+/).filter(Boolean);
		const hits = [];

		for (const entry of entries) {
			const haystackTitle = entry.title.toLowerCase();
			const haystackBody = entry.content.toLowerCase();
			let score = 0;
			let snippetAt = -1;

			for (const keyword of keywords) {
				const inTitle = haystackTitle.includes(keyword);
				const at = haystackBody.indexOf(keyword);
				if (!inTitle && at === -1) {
					score = 0;
					break;
				}
				score += inTitle ? 3 : 0;
				score += at === -1 ? 0 : 1;
				if (snippetAt === -1 && at !== -1) snippetAt = at;
			}
			if (score > 0) hits.push({ entry, score, snippetAt });
		}

		hits.sort((a, b) => b.score - a.score);

		if (hits.length === 0) {
			render('<p class="search-empty">No results. Try a different word.</p>');
			return;
		}

		render(
			`<ul>${hits
				.slice(0, 25)
				.map(({ entry, snippetAt }) => {
					let snippet = '';
					if (snippetAt >= 0) {
						const start = Math.max(0, snippetAt - 60);
						snippet = escape(entry.content.slice(start, start + 180).trim());
						for (const keyword of keywords) {
							snippet = snippet.replace(
								new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
								'<span class="search-keyword">$1</span>',
							);
						}
					}
					return `<li class="search-result-item"><a href="${escape(entry.url)}">${escape(
						entry.title || 'Untitled',
					)}</a>${snippet ? `<p class="search-result-abstract">…${snippet}…</p>` : ''}</li>`;
				})
				.join('')}</ul>`,
		);
	};

	const open = async () => {
		// The overlay is always rendered (just `visibility: hidden`), so the class
		// alone drives the transition — no requestAnimationFrame needed, which
		// would leave it stuck invisible wherever rAF is throttled.
		overlay.classList.add('is-open');
		openButton.setAttribute('aria-expanded', 'true');
		input.focus();
		if (!entries && !loading) {
			loading = true;
			render('<p class="search-empty">Loading the index…</p>');
			try {
				entries = await loadIndex();
				search(input.value);
			} catch {
				render('<p class="search-empty">Search index unavailable.</p>');
			} finally {
				loading = false;
			}
		}
	};

	const close = () => {
		overlay.classList.remove('is-open');
		openButton.setAttribute('aria-expanded', 'false');
	};

	const isOpen = () => overlay.classList.contains('is-open');

	openButton.addEventListener('click', open);
	closeButton?.addEventListener('click', close);
	overlay.addEventListener('click', (event) => {
		if (event.target === overlay) close();
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && isOpen()) close();
		if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();
			open();
		}
	});

	let debounce;
	input.addEventListener('input', () => {
		window.clearTimeout(debounce);
		debounce = window.setTimeout(() => search(input.value), 120);
	});
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			const first = $('.search-result-item a', results);
			if (first) first.click();
		}
	});
}

/* ------------------------------------------------------------------ *
 * Scroll reveals
 * ------------------------------------------------------------------ */

function initReveals() {
	const targets = $$('.reveal');
	if (targets.length === 0) return;

	if (prefersReducedMotion || !('IntersectionObserver' in window)) {
		for (const target of targets) target.classList.add('is-visible');
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add('is-visible');
				observer.unobserve(entry.target);
			}
		},
		{ rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
	);

	// Stagger siblings so a grid sweeps in rather than popping at once.
	const groups = new Map();
	for (const target of targets) {
		const parent = target.parentElement;
		const seen = groups.get(parent) ?? 0;
		target.style.setProperty('--reveal-delay', `${Math.min(seen, 6) * 90}ms`);
		groups.set(parent, seen + 1);
		target.classList.add('is-pending');
		observer.observe(target);
	}
}

/* ------------------------------------------------------------------ */

initHeader();
initHero();
initTools();
initSearch();
initReveals();
