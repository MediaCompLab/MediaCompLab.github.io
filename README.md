# mediacomplab.github.io

The Media Comprehension Lab website — [mediacomplab.com](https://mediacomplab.com) — built with
[Astro](https://astro.build).

The site began as a like-for-like port of the lab's old Hexo theme, and was then redesigned (2026)
into its current form: a quiet, editorial academic look — Inter for everything, white surfaces, GSU
Blue (`#0039A6`) for the masthead, the footer and things you can click, one shape (the rectangle),
hairlines instead of boxes, and motion that never lifts, bounces or pops.

```
WEB_LAB/
├── hexo/                     ← the original Hexo site, kept as an archive
└── mediacomplab.github.io/   ← this project
```

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/   (runs the content check first)
npm run preview    # serve dist/ locally
npm run check      # type-check the .astro and .ts sources
npm run verify     # compare dist/ against the reference build
npm run snapshot   # make the current build the reference
```

On Windows you can double-click **`update-site.bat`**, which builds, verifies, commits and pushes.

---

## Design system

Visual styles live in **`src/styles/site.css`** — one stylesheet, organised in numbered sections:

| | |
|---|---|
| Palette | GSU Blue `#0039A6` (plus `--blue-700/500/300/100`), near-black ink, cool greys, white surfaces. **No second deep colour**: the masthead and the footer are both GSU Blue, so the page is bookended by one brand colour rather than by two navies that never quite match |
| Shape | **one** — `--radius: 0`. Rectangles only: no pills, no circles, no rounded panels |
| Type | **Two faces, no more.** Inter 400–700 for every piece of text on the site; Fredoka for the lab wordmark alone. A third face — Source Serif 4 on the display headings — was removed because it read as a different site. Fluid display sizes via `clamp()` |
| Surfaces | 1px `--line` borders and hairline rules; boxes and shadows are rare (search panel, floating tools) |
| Width | **one container, 1140px, on every page.** A `container--narrow` (780px) once wrapped publications, post pages and the Virginia profile, which made those pages visibly narrower than people/research/news. It has been removed rather than left unused |
| Motion | One easing curve (`--ease`) and three durations; opacity-led scroll reveals, a sliding nav indicator, a slow photographic drift and crossfades. Hover is quiet everywhere except two deliberate signatures: the hero letters hop on hover, and People cards lift while the bio panel slides over them |

Three rules keep it coherent:

* **Colour is blue or grey.** The only other colour in the UI is the GSU lockup itself.
* **One shape.** Everything is a rectangle; hairline rules and spacing do the organising. If you
  ever want softness back, `--radius` in the token block is the only value to change — every
  `border-radius` in the stylesheet points at it.
* **Motion collapses** under `prefers-reduced-motion` — see the last block of the stylesheet.

Two CSS traps worth knowing about, both of which cost real debugging time:

* An `animation-fill-mode: forwards` animation keeps ownership of the properties it animates and
  silently beats a later `:hover` transform on the same element. Entrance animations here use
  `backwards` for that reason: the entrance plays once, then the animated properties are handed
  back to normal cascade.
* `visibility` is a discrete property; putting it in a `transition` makes it depend on
  interpolation. Flip it instantly and delay it with `visibility 0s linear <duration>` instead
  (see `.search-overlay`).

There is no Bootstrap, no jQuery and no icon font. Site chrome is inline SVG (`src/components/Icon.astro`);
Font Awesome is loaded only for brand marks (GitHub, LinkedIn, ResearchGate, X, Facebook).

---

## Layout of the source

```
astro.config.mjs               site url, markdown pipeline, integrations
integrations/
  hexo-external-links.mjs      adds target/rel to outbound links, as the old site did
  doi-link-text.mjs            relabels bare-DOI anchors in bibliographies as "Full text"
src/
  styles/site.css              the whole design system
  scripts/site.js              shared browser behaviour and hero motion controller
  consts.ts                    site + theme config (a port of the old _config.yml files)
  content.config.ts            collections and front matter schema
  content/
    posts/                     news items
    pages/                     home, people, publications, research, tags, virginia
  layouts/BaseLayout.astro     the shell
  components/
    SiteHeader.astro           sticky header: GSU lockup, lab name, nav with sliding indicator
    SiteFooter.astro           footer, on the same GSU Blue as the masthead
    Hero.astro                 photo-first home carousel and a separate lab identity band
    PostList.astro             news / archive list (optionally grouped by year)
    EntryRow.astro             one row of that list
    SearchOverlay.astro        search dialog, fed by /search.xml
    Tools.astro                floating search / share / back-to-top
    Icon.astro                 inline SVG icons
    Comments.astro             Valine, from the old theme
  pages/                       routes
scripts/
  check-content.mjs            guards the Markdown/HTML indentation trap (see below)
  postbuild.mjs                flattens source pages to <name>.html like Hexo did
  verify-against-hexo.mjs      compares dist/ against the reference build
  snapshot.mjs                 writes .baseline/ for that comparison
  visual-diff.mjs              renders two builds in headless Chrome and compares them
  hover-preview.mjs            screenshots a card page with the hover panel open
  touch-preview.mjs            renders the @media (hover: none) layout
public/                        css, js, plugins, images, CNAME, robots.txt
```

### Routes

| URL | File |
|---|---|
| `/` | `src/pages/index.astro` — hero + `src/content/pages/index.md` |
| `/people/`, `/publications/`, `/research/` | `src/pages/[...slug].astro` |
| `/people/virginia` | `src/pages/[...slug].astro` + `scripts/postbuild.mjs` |
| `/2023/05/19/<slug>/` | `src/pages/[year]/[month]/[day]/[...slug].astro` |
| `/tags/` (the NEWS tab), `/tags/<Tag>/` | `src/pages/tags/**` |
| `/default-index/` | kept for parity with the Hexo build, not linked |
| `/search.xml`, `/sitemap.xml`, `/sitemap.txt`, `/baidusitemap.xml` | `src/pages/*.js` |

`/archives/` and its year/month sub-pages were **removed**. The Hexo theme generated thirteen of
them, but nothing on the site ever linked to them and none was in the sitemap — they were orphaned
in the original too, reachable only by typing the URL. The news index lists every update and the tag
pages filter them, so the set earned nothing but build time. Those URLs now 404; `verify --hexo`
counts them as *dropped on purpose* rather than missing, and the `theme.navbar` entry that pointed at
the route went with them so nobody can re-enable a link to a page that no longer exists.

---

## Editing the site

**A news item** — add a file to `src/content/posts/`. The file name becomes the URL slug:

```markdown
---
title: Gal Kaldes won the X from the American Educational Research Association
date: 2023-05-19 21:17:40
tags: Recent awards and accolades
---
```

A title of the form `#Headline@https://example.com` renders as an external link and is shown without
the `#`; that is how the lab has always entered awards and media appearances. The home page, the
live index and the tag pages all understand it.

**A lab member** — `src/content/pages/people/index.md` holds two card grids: current members, then a
divider and the Alumni section. Copy a `<article class="person">` block and change the photo, name,
role, blurb and links.

* Put the headshot in `public/images/` and reference it as `/images/<name>.jpg`. The card crops it to
  a square from the top, so a portrait or square photo works best.
* Hovering (or keyboard-focusing) a card lifts it and slides the biography panel over the bleached
  portrait. On touch devices the panel rests open below the name, so nothing is ever hidden.

**A research area** — `src/content/pages/research/index.md` is a stack of `<details class="accordion">`
blocks. Copy one, and use `<h3>` for a sub-topic and `<ul class="pub-list">` for its publications.

**Publications** — `src/content/pages/publications/index.md` is plain Markdown grouped under
`<h2 class="pub-year">` headings. `***Name***` renders a lab member in bold italic; the bullet is
drawn by CSS, so do not type a leading `*`.

### The one Markdown trap

These pages are Markdown files whose bodies are mostly raw HTML. In CommonMark:

* a line indented by **four or more spaces after a blank line** starts an *indented code block*, and
* a **blank line ends an HTML block**, after which the rest is re-parsed as Markdown.

So raw HTML in `src/content/pages/*.md` must sit flush at column 0, and a block must not contain a
blank line. Get this wrong and a whole section renders as a syntax-highlighted code block.
`scripts/check-content.mjs` runs before every build and fails with the exact file and line.

---

## Verifying a change

```bash
npm run build && npm run verify     # against .baseline/ if it exists, else the Hexo archive
npm run visual-diff                 # renders both builds and compares them region by region
npm run snapshot                    # accept the current build as the new reference
```

* **`verify`** compares `dist/` against a reference build. `<style>`, `<script>` and `<title>`
  contents are compared byte for byte; other markup is compared as a normalised token stream so that
  framework formatting does not drown out real differences. Static assets are byte compared.
  It defaults to `.baseline/` (a snapshot you bless with `npm run snapshot`) and falls back to the
  archived Hexo output, where page markup is reported as *redesigned* rather than compared.
* **`visual-diff`** is the belt-and-braces check: the pages animate, so it takes several screenshots
  of each build and reports the smallest difference per region. Static regions must come out at
  exactly 0 pixels.
* **`hover-preview`** opens the hover panel on the People cards so a long blurb can be checked.

If you change anything cosmetic, run `build`, `verify` and `visual-diff`. Byte-level comparison alone
once missed a UTF-8 BOM pasted into a `<style>` block, which made the browser drop a whole CSS rule;
only rendering both builds caught it.

---

## Deploying

**Pushing to `main` is the whole procedure.** `.github/workflows/deploy.yml` runs `npm ci` and
`npm run build` on a GitHub runner, uploads `dist/` as a Pages artifact, and publishes it. Nothing is
built locally for a deploy, and `update-site.bat` is just a convenience wrapper around
`git add -A && git commit && git push`.

The repository has already been set up:

* Pages **Source** is *GitHub Actions* (`build_type: workflow`). It used to be *Deploy from a branch*
  with the Hexo output committed at the repo root; that output is now the previous commit rather
  than the working tree, so this branch holds source.
* `mediacomplab.com` is the Pages custom domain, and `public/CNAME` carries the same name so the
  artifact keeps it. **Both are needed** — the file alone is not enough with Actions-based Pages.
* DNS for `mediacomplab.com` sits behind Cloudflare, which proxies to GitHub Pages. Cloudflare
  terminates TLS at the edge, so the site is served over HTTPS even while GitHub is issuing its own
  certificate for the domain.

> **If the custom domain ever goes missing**, the symptom is `mediacomplab.com` returning 404 while
> `mediacomplab.github.io` still serves fine — the artifact is deployed but the domain is not
> attached to it. Re-add it and re-run the workflow:
>
> ```bash
> gh api -X PUT repos/MediaCompLab/MediaCompLab.github.io/pages -f cname=mediacomplab.com
> gh workflow run "Deploy to GitHub Pages"
> ```
>
> Changing `build_type` clears the custom domain, and `https_enforced` with it; the latter can only
> be turned back on once GitHub has issued the certificate, which takes a few minutes.

The old `hexo deploy` flow is retired — `hexo/` is no longer built, and pushing its output to this
branch would now be published as source, not as a site.

---

## Notes for maintainers

* **Dates are rendered in UTC.** Front matter is written the way Hexo wrote it
  (`2023-05-19 21:17:40`, no timezone), which the YAML parser reads as UTC; using the UTC components
  reproduces the original output and makes the build independent of the machine's timezone.
* **`public/css/*` and `public/js/*` are leftovers from the Hexo theme.** Nothing links them any
  more; they are kept only so the Hexo archive comparison still has something to check. They can be
  deleted once you stop running `npm run verify -- --hexo`.
* **MathJax was dropped.** The theme loaded a 1 MB MathJax bundle on every post page and no content
  uses maths. `public/plugins/mathjax/` is still there if you want it back.
* **Comments** are Valine, carried over unchanged; they appear on post pages when
  `THEME.comments.valine.enable` is true in `src/consts.ts`.
* **`src/templates/`** holds the original nunjucks sitemap and search templates, still used by
  `src/utils/templates.ts`, so the feed formats stay recognisable to anyone who edited them before.
* The home hero photos are listed in `src/components/Hero.astro`; the fifth one is the only place
  `/images/genre_study.jpg` is used.


## Hexo behaviours carried over

Four things are deliberately kept as the Hexo theme had them, rather than redesigned.
`hexo/themes/oranges/layout/home.ejs` and `.../_partial/navigation_avatar.ejs` are the references.

**The hero.** The mark and the wordmark sit on one row, which is exactly what the theme's
`#lab-name` was — a flex row of `icon_white.png` and the `<h1>`. The block is laid over the photos
rather than parked beneath them (`position: absolute`, white Fredoka, the theme's own
`text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.2)`), and a gradient — transparent through to
`rgba(5, 12, 26, 0.82)` — fades the picture into the text so the two do not meet at a hard edge.

**The carousel controls stay out of the picture.** At rest the photographs carry nothing at all.
Each arrow appears only when the pointer is inside that arrow's edge, and the counter and pause
switch only when the pointer is in the top-right corner they occupy. `site.js` tracks this from
`mousemove` on the hero rather than with CSS edge strips, because an overlay wide enough to catch the
pointer would also swallow the per-letter hover on the wordmark underneath it. `:focus-visible`
reveals an arrow for keyboard users regardless.

> **The arrow zones are measured, not assumed.** The arrows sit at the container's edge —
> `max(gutter, (100% - 1140px) / 2)` — while the hero spans the full viewport. Past roughly 1780px
> the container edge is *further in* than any fixed fraction of the width, so an 18%-of-width zone
> no longer contains the arrow: moving the pointer onto it left the zone and the arrow vanished.
> It only reproduced on a wide monitor. The boundary is therefore derived from the arrow's own
> rectangle, with the fraction as a floor — and `scripts`-style checks need to run at 1900px and
> 2560px, not just at a laptop width.

On touch there is no pointer to place, so the arrows are hidden at every width below 620px and a
**swipe steps the carousel** instead: a horizontal drag of 40px or more, and at least 1.4× the
vertical travel, so a slightly diagonal flick scrolls the page rather than turning the photos.

> **`touch-action: pan-y pinch-zoom` on `.hero` is load-bearing.** Without it, a rightward swipe is
> claimed by the browser as back-navigation and the reader leaves the site — which is exactly what
> happened when this was first wired up, and it is invisible in a desktop browser. Vertical panning
> and pinch-zoom are deliberately left enabled.

**The masthead.** One deep-blue bar carrying both the college lockup and the nav, which is the Hexo
header folded into a single row: the theme stacked a `#0039A6` school banner (white lockup at
`height: 100px`) above a beige navbar. The background is that same GSU Blue, and the lockup is the
white `cehd-white2.png` the theme put on it.

It **condenses as you scroll**. At the top of a page it is 100px with an 88px lockup, which is what
keeps a 1900px-wide window from looking like it has a thin strip of a header; it reaches 68px with a
56px lockup after about 180px of scrolling.

The collapse is **interpolated, not switched**. `site.js` writes a `--condense` value from 0 to 1 as
the page scrolls, and the height is `calc()`-ed from it. The first attempt toggled a class at
`scrollY > 8`, which fired the whole collapse the instant the page moved and read as the header
snapping shut; tying it to the scroll position instead makes it move with the reader, and needs no
transition because the value already tracks the scroll frame by frame. `CONDENSE_DISTANCE` in
`site.js` is the one number to change for a slower or quicker collapse. The shadow still arrives
immediately (`is-stuck` past 8px) — that is what separates the bar from the page, and it should be
there the moment they overlap.

Because the row is bottom-aligned, the panel collapses from the top and the lockup and nav stay
pinned to its base.

Only above 960px. On a phone the bar keeps its compact 68–80px height, because the open nav drawer
is positioned from `--header-h` and a header that resized underneath it would leave the drawer
hanging in the wrong place. That is also why `--header-h` is the *compact* value: it is the one
scroll-margin and the drawer need, with `--header-h-large` for the resting desktop height.

**No invented copy.** The redesign had added four lines the theme never had — a wordmark beside the
masthead logo, a line of small caps over the wordmark ("Understanding how we understand."), and a
college affiliation line under the hero and again in the footer. All four are gone; the footer
carries the copyright line alone, as `theme.footer.more` did. If you add straplines back, put them
somewhere they earn their space — the page is deliberately quiet.

**The wordmark.** "Media Comprehension Lab" is set in Fredoka, not Inter, with the leading capital
of every word — and all of "Lab" — at weight 600. Letters hop on hover:
`translateY(-15px) scale(1.3) rotate(5deg)` on `all 0.2s ease`, the theme's own values. The entrance
stagger is an addition on top; it runs once per photo change via the `is-animating` class.

The lockup beside it animates too, and on **different** values — the theme gave the two separate
rules: the image lifts `translateY(-20px) scale(1.1)` on a much bouncier
`transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)`, so the mark springs while the letters
snap. `pointer-events: auto` is re-enabled on the image because the Hexo `#lab-name` wrapper had it
off. The theme also set `cursor: pointer` on a mark that is not a link and does nothing on click;
the cursor is left alone rather than promising an action that does not exist.

The mark is sized **against the bar, not on a curve of its own**:
`calc(var(--bar-h) - var(--bar-pad))` — the panel's live height less its 12px of breathing room — so
it is as large as the panel allows rather than leaving a band of empty blue above it. It reads
larger than the theme's ratio (a 100px mark beside a 4.6rem headline, of which 20px was padding)
because a near-square mark looks smaller than a line of type of the same height: the type fills its
box and the mark does not.

**The nav rule.** The current item is marked by a 3px GSU red (`#cc0000`) segment hung *below* the
blue panel — `bottom: -3px`, the theme's own value — sliding between items on
`cubic-bezier(0.25, 0.8, 0.25, 1)` over 0.3s. `site.js` computes only its horizontal position,
exactly as `activeNav.js` did. The nav sits on the floor of the bar (`align-items: flex-end`) so its
label shares a bottom edge with the college lockup.

Two details are easy to "fix" by accident, so they are spelled out:

* **No rule on the home page.** The theme's `activeNav.js` only marked items carrying `data-path`,
  and HOME was hard-coded outside the loop that generated them — so `getActiveItem()` returned null
  on `/` and set the line's width to 0. `site.js` reproduces that: every link except Home counts as
  an active item. Hovering still brings the rule out, and leaving the nav hides it again.
* **Separated by a shadow, not a stripe.** The header carries the theme's `.navbar-box-shadow`
  (`0 2px 3px rgba(0,0,0,.1), 0 2px 2px rgba(0,0,0,.4)`), deepened once the bar is stuck. A full-width
  bright base rule was tried first to give the indicator a light track; it worked, but it added a
  second stripe of colour to the panel for no reason. Hanging the rule *outside* the bar solves the
  contrast instead: red against the white page below is **5.9:1**, where red on the blue panel was
  only **1.67:1**.

Centring the nav in the bar instead strands the rule in the middle of the panel, far from the text.

**The People card.** Geometry and interaction are the theme's:

| | |
|---|---|
| Card | 392px tall, holding one full-bleed portrait with the type on top of it |
| Portrait | fills the card (`position: absolute; inset: 0`), `object-position: top`; on hover it dims to 0.5 opacity and scales to 1.06 |
| Name | white, over a dark scrim across the foot of the picture. On hover the scrim grows to the full card height and carries the name up to 60px from the top |
| Biography | parked at `bottom: -100%`; on hover it slides to `bottom: 0`, rising over the darkened picture in white |
| Social icons | the theme's brand colours — ResearchGate `#34ebcf`, LinkedIn `#069` — popping to `scale(1.2)` |

Three notes, all of them things that look like they could be simplified and cannot:

* **The plate's `padding-top` is doing the positioning, not `top`.** It is anchored to the card's
  bottom edge (`inset: auto 0 0 0`), so as its height animates from 150px to 100% the plate grows
  upward and carries the name with it — from the foot of the picture to 60px below the top. A
  `justify-content` switch could not interpolate that, and a shorthand `padding` in a media query
  would drop the name upward out of place.
* **Both backgrounds are gradients, at the same angle and stop count.** Two gradients interpolate; a
  gradient and a flat colour do not, and the change would snap.
* **The hover sheet is dark, not white.** The Hexo card opened a white sheet over the portrait and
  put the name and biography in ink on it. That cannot survive white type on a full-bleed picture:
  the sheet has to stay dark, and the biography is white instead. The mechanic — the plate growing
  to fill the card while the biography rises from below — is the theme's.

### Spacing in the research panels is written out on purpose

`.accordion__body` does not use a `* + *` rhythm rule, and should not go back to one. Universal
selectors carry **no specificity**, so `.accordion__body > * + *` scores only (0,1,0) — while a reset
like `.accordion__body p { margin: 0 }` scores (0,1,1) and silently wins, flattening the spacing
between every sub-heading and the paragraph under it. The panel's contents run
`h3 → p → p.body-label → ul`, repeated, so each of those four transitions is stated explicitly with
enough specificity to survive the resets.

Shapes stay square here too, so the brand-coloured icon buttons are rectangles rather than the
theme's circles. Keyboard focus (`:focus-within`) opens the same state as hover.

Everything else — the carousel, the reveals, the search — follows the design system above. The
controller in `src/scripts/site.js` pauses photo motion and automatic rotation when the hero is
offscreen, the tab is hidden, or keyboard focus is inside the hero, and visitors can pause it
explicitly. `prefers-reduced-motion` switches off the drift, the letter entrance and automatic
rotation; manual photo navigation remains available.

### `prefers-reduced-motion` shortens transitions, it does not remove them

The usual boilerplate — `* { transition-duration: 0.01ms !important }` — makes every hover, focus,
menu and card expansion snap instantly, which reads as "the site is broken" rather than "the site is
calm". The Hexo theme had no reduced-motion handling at all, so anyone with the preference set saw
the old site animate and this one appear dead.

So the block is split by intent: **animations** (the drift, the letter entrance, the reveals, the
progress bar) are switched off outright, because those are the looping and sweeping movements the
preference exists to stop; **transitions** are capped at `0.12s` instead, because they are short,
bounded, and answer something the reader just did. If someone wants the full experience back, that
is a one-value change in the last block of `src/styles/site.css`.

On devices without hover the card lays out flat — square portrait, then name, role, the full
biography and the links — so touch users never lose the research interests. Phones show one
complete profile per row.

### Checking the card states

```bash
npm run hover-preview -- people     # every card forced into its hovered end state
npm run touch-preview -- people     # the @media (hover: none) layout, at 420px
```

Both shoot a throwaway copy of `dist/`, so the real build is never touched. `touch-preview` exists
because Chrome will not emulate `hover`/`pointer` in headless mode — not through
`Emulation.setEmulatedMedia`, not through `--blink-settings` — so it rewrites that one media query
to an always-true one and renders the real declarations inside it.

Validate with `npm run check` and `npm run build`, then inspect desktop and mobile layouts, manual
photo navigation, keyboard links and reduced-motion rendering.
