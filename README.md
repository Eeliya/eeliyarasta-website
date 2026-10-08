# eeliyarasta.com

Personal site of **Eeliya Rasta**: portrait & editorial photography (Fujifilm X100V) first,
websites and DIY projects second.

A deliberately small stack: **vanilla JS (ES modules) + SCSS + Vite + GSAP**. No framework.
Content lives in JSON, templates are plain JavaScript functions, every page is prerendered to
static HTML at build time, and the browser then takes over as a single-page app with GSAP
page transitions.

```bash
npm install
npm run dev       # http://localhost:5173 – pages rendered on the fly, hot reload
npm run build     # → dist/ (one index.html per route + 404.html, sitemap.xml, robots.txt)
npm run preview   # serve dist/ on http://localhost:4173
```

Requires Node 20.19+ (Vite 8).

---

## How it works

```
content/            ← all text, albums, projects, animation config (JSON)
media/              ← source photos (jpg), committed
scripts/
  images.mjs        ← media/ → public/media/*.webp sizes + .generated/media.json
  content.mjs       ← loads content/*.json + media manifest (Node)
  vite-plugin-static-site.mjs  ← the "static site builder" (dev render + build prerender)
src/
  site/             ← isomorphic templates (no Node APIs, run at build time AND in a browser)
    routes.js       ← list of pages, derived from content
    render.js       ← renderRoute(route, content) → { head, body }
    helpers.js      ← html``, esc(), img() with srcset/LQIP, accent colours
    templates/      ← layout, header/menu, footer, home, album, pages, partials
  client/           ← browser code
    main.js         ← boot: smooth scroll, menu, cursor, router, per-page mount
    router.js       ← SPA navigation over the prerendered HTML
    anim/engine.js  ← reads content/animations.json, wires every [data-anim]
    anim/types.js   ← animation types (reveal, split, parallax, scatter, …)
    modules/        ← album slider, project accordion, card hover, misc
    ui/             ← menu (click-only), custom cursor, NL clock
    styles/         ← SCSS (tokens, glass, chrome, home, pages, album)
index.html          ← HTML shell with <!--ssr-head--> / <!--ssr-body--> markers
```

### Build / prerender ("SSR but static")

`vite-plugin-static-site.mjs` is the whole builder (~100 lines):

* **dev**: a middleware renders any HTML request from `content/*.json` with `src/site/render.js`
  (through Vite's SSR loader, so template edits reload instantly). Unknown URLs get the 404 page.
* **build**: Vite bundles the client from `index.html` (hashed JS/CSS). Then, in `closeBundle`,
  every route from `routes.js` is rendered into that shell and written to
  `dist/<route>/index.html`, plus `dist/404.html`, `sitemap.xml` and `robots.txt`.

Every page is real, crawlable HTML with its own `<title>`, description, canonical and Open Graph
tags, and works with JavaScript disabled.

### SPA behaviour

`src/client/router.js` intercepts internal link clicks, fetches the target's prerendered HTML
(prefetched on hover), runs the page-leave transition (a curtain showing the destination's
name), swaps `<main data-router-view>`, updates title/meta/history, scrolls to top and re-mounts
animations and page modules. Each page's tweens, ScrollTriggers, SplitTexts and listeners live
in one `gsap.context` and are reverted on leave. If anything fails it falls back to a normal
page load.

### Content

| file | what |
| --- | --- |
| `content/site.json` | name, SEO description, socials (Instagram, YouTube, GitHub), email, About page |
| `content/home.json` | hero text and the **scattered hero photos** (position `x/y/w` in %, mobile `mx/my/mw`, `depth`, `layer` back/front) |
| `content/people.json` | models: `slug`, `name`, role, location, `accent`, `cover`, `images[]` (with credits) |
| `content/places.json` | places, same shape |
| `content/projects.json` | projects: title, kind, year, description, url, image |
| `content/animations.json` | **every animation** (see below) |

Add a person: drop photos into `media/people/<slug>/`, add an entry to `people.json`, done.
Routes, menu, dropdowns, grids and sitemap update automatically.

> ⚠️ **Placeholder content.** The two people (*Noor Vermeer*, *Daan Okafor*), the two places and
> the two DIY projects are placeholders (`"placeholder": true`, shown with a "Placeholder" tag).
> Their photos are free Unsplash images (Unsplash License); photographer and source URL are
> recorded per image in the JSON and shown as a credit in the album view. Replace them with
> real shoots. The email `hello@eeliyarasta.com` is a placeholder too.

### Images

`scripts/images.mjs` (runs before `dev` and `build`) converts every file in `media/` into
480/960/1600 px WebP files in `public/media/` and writes `.generated/media.json` with sizes,
a tiny blurred placeholder (LQIP) and the image's most vivid colour. Templates use it for
`srcset`, `width/height` (no layout shift) and lazy loading. Unchanged images are skipped.
If `sharp` is missing, originals are copied and the site still works. Both output folders are
generated, so they're git-ignored.

### Album accent colours

Each person/place can set `"accent": "#hex"`. Without one, the accent is derived from the
cover's vivid colour (greyscale covers fall back to the site accent). When you open an album,
GSAP tweens the CSS variable `--accent`, which tints the glass UI and the background glow.

### Animations: one config, one engine

Markup only says **what** an element is: `data-anim="hero.title"`. All the **how** lives in
`content/animations.json`:

```jsonc
{
  "defaults": { "duration": 1.1, "ease": "expo.out", "trigger": "scroll", "start": "top 85%" },
  "presets": {
    "fade-up":   { "type": "reveal", "from": { "autoAlpha": 0, "y": 40 }, "to": { "autoAlpha": 1, "y": 0 } },
    "split-chars": { "type": "split", "split": "chars", "mask": "chars", "from": { "yPercent": 110 }, "to": { "yPercent": 0 }, "stagger": 0.035 },
    "scatter-drift": { "type": "scatter", "drift": { "amplitude": 14 }, "mouse": { "strength": 34 }, "scroll": { "distance": 55 } }
  },
  "targets": {
    "hero.title":  { "preset": "hero-title" },
    "page.title":  { "preset": "split-chars", "trigger": "load", "delay": 0.1 }
  },
  "interactions": { "...": "cursor follow, card cycle, album wheel/drag thresholds" },
  "transitions":  { "...": "page curtain, accent tween, album slide, menu" }
}
```

The final spec for an element is `defaults ← preset ← target overrides ← data-anim-options`.
Types (`src/client/anim/types.js`): `reveal`, `split` (SplitText chars/words/lines, masked),
`scrub-words`, `parallax`, `scatter` (hero photo burst + endless drift + mouse depth + scroll
depth), `hero-title`, `hover-preview`. New effect = new type function + preset.

`prefers-reduced-motion` is respected everywhere: no smooth scroll, no drift/parallax/splits,
instant album slides, a quick crossfade between pages.

### Visual editor (planned)

The config file is the single source of truth on purpose, so a WYSIWYG editor can be added
without touching templates:

1. An `?edit` overlay lists every `[data-anim]` on the page (`window.__site.animations` and
   `window.__site.resolve(id)` are already exposed).
2. Clicking an element shows its target/preset values (duration, ease, stagger, delay, from/to,
   hero photo positions from `home.json`) with live preview via `window.__site.remount()`.
3. **Save** commits the changed `content/animations.json` / `content/home.json` to GitHub
   (GitHub API with a token, or a small serverless function), and the host rebuilds.

### Design notes

* Black background, off-white type. Display: **Momo Trust Display**; UI/body: **DM Mono**
  (Google Fonts, `display=swap` with serif/monospace fallbacks).
* Glass UI (`.glass`): blur + saturation backdrop filter, translucent accent-tinted fill, inner
  highlight and soft shadow. The blur lives on `::before`, so glass nested in glass (nav pill →
  dropdown) still blurs the page behind it.
* Navigation opens on **click only** (never hover): Photography (People, Places with names),
  Projects, About, Home. Small screens get a full-screen glass menu.
* Inspiration: Gregor Collienne and Hannah Miles (home hero), Faint Film (album slider/grid),
  House of Yellow (a proper website with sections and a big footer).

## Deploy

Any static host works: upload `dist/`.

**Vercel**: import the repo, Framework preset **Other**, Build command `npm run build`,
Output directory `dist`. Unknown URLs get `404.html` automatically. (Netlify, Cloudflare Pages
and GitHub Pages work the same way.)
