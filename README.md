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

Visual editor: `/edit/` (see [Visual editor](#visual-editor-edit)).

Requires Node 20.19+ (Vite 8).

---

## How it works

```
content/            ← all text, albums, projects, animation config (JSON)
media/              ← source photos (jpg), committed
scripts/
  images.mjs        ← media/ → public/media/*.webp sizes + .generated/media.json
  content.mjs       ← loads content/*.json + media manifest (Node)
  vite-plugin-static-site.mjs  ← the "static site builder" (dev render + build prerender + editor endpoints)
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
  editor/           ← the visual editor app (/edit/), never loaded by the public site
    config.js       ← repo/branch/content files the editor may write
    store.js        ← in-memory content copies, dirty state, undo/redo, rebase
    bridge.js       ← talks to the site inside the iframe (text overrides, selection, replay)
    github.js       ← token storage + one-commit-for-all-files via the git data API
    ui/             ← text panel, motion panel, ease picker, fields
index.html          ← HTML shell with <!--ssr-head--> / <!--ssr-body--> markers
edit/index.html     ← editor entry (noindex)
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
| `content/site.json` | name, SEO description, socials (Instagram, YouTube, GitHub), email, About page, page titles/intros (`pages`), footer copy |
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

The final spec for an element is
`defaults ← preset ← target overrides ← element overrides ← data-anim-options`. Element overrides
(`elements`, keyed `"<page path>|<target>|<n>"`) are mostly written by the visual editor. With
`"trigger": "scroll"`, reveals play once at `start`, or follow the scrollbar between `start` and
`end` when `"scrub"` is `true` or a number (seconds of smoothing).
Types (`src/client/anim/types.js`): `reveal`, `split` (SplitText chars/words/lines, masked),
`scrub-words`, `parallax`, `scatter` (hero photo burst + endless drift + mouse depth + scroll
depth), `hero-title`, `hover-preview`. New effect = new type function + preset.

`prefers-reduced-motion` is respected everywhere: no smooth scroll, no drift/parallax/splits,
instant album slides, a quick crossfade between pages.

### Visual editor (`/edit/`)

A WYSIWYG editor for **text and animations** ships as a second Vite entry (`edit/index.html` →
`src/editor/`). It's not linked anywhere, has `noindex`, and `/edit/` is disallowed in
`robots.txt`. The public bundle contains **no editor code**: the site only exposes a small
`window.__site` API and connects to the editor when it runs inside its iframe.

**Open it:** `http://localhost:5173/edit/` while running `npm run dev`, or
`https://eeliyarasta.com/edit/` on the live site. Shortcut: **Ctrl/⌘ + Shift + E** on any page
of the site opens that page in the editor (and from the editor goes back to the live page).

Layout: the real site in a same-origin iframe, with a glass side panel. Pick a page from the
dropdown, or click links in Browse mode. There's also a mobile (390 px) preview toggle.

| mode | what it does |
| --- | --- |
| **Browse** | Use the site normally. Shows unsaved changes per file, plus *Discard all*. |
| **Text** | Animations pause. Every editable text gets an outline: click it and type (Enter ends a single-line field; multi-line fields take Enter as a line break). The panel lists the same fields as inputs, and both stay in sync. |
| **Motion** | Click an animated element (or pick one from the list). Edit its preset, duration, delay, stagger, ease (picker with curves), trigger (load / scroll), scroll start/end/scrub, from/to properties (distance, scale, rotation, opacity, clip-path…) and type-specific values (hero scatter, parallax speed, word scrub…). Changes replay live. **Replay** runs the page again, and the **Scroll** slider moves the page through the element. |

In the edit modes, clicks on editable or animated elements select them instead of following
links. Hold **Alt** to click through.

Every value in Motion can be written at one of three **scopes**:

* **This element**: `animations.json → elements["<path>|<target>|<n>"]`, e.g.
  `"/about/|about.headline|0"`. Only this element on this page. This is how you give one
  element a different preset without touching templates.
* **All "target"**: `targets["about.headline"]`. Every element with that `data-anim`.
* **Preset**: `presets["fade-up"]`. Every target using that preset.

Badges show where each value comes from (element / target / preset / default), and ↺ resets a
value at the current scope.

Shortcuts: **Ctrl/⌘+E** toggles edit mode, **Ctrl/⌘+S** saves, **Ctrl/⌘+Z** / **Shift+Ctrl/⌘+Z**
undo/redo, **Esc** deselects.

**How text maps to JSON.** Templates mark text with the `ed()` helper, e.g.
`<h2${ed('home.json', ['sections', 'people', 'title'])}>`, which renders
`data-edit="home.json#/sections/people/title"` (a JSON Pointer). Use `ed(file, path, 'block')`
for multi-line text (`\n` ⇄ `<br>`) and `'number'` for numbers. Page copy (titles, intros,
footer) lives in `site.json → pages / footer` for this reason. The editor only ever writes
`content/*.json` (the files listed in `src/editor/config.js`).

**Saving**

* **Dev** (`npm run dev`): *Save* writes the changed files to `content/` through a small dev
  endpoint in the Vite plugin (`POST /__editor/save`, same-origin only, whitelisted file names).
  Then review and commit with git as usual.
* **Live site**: *Commit* makes **one commit** containing all changed files on
  `Eeliya/eeliyarasta-website@main` (repo and branch are in `src/editor/config.js`), with your
  message. Before committing, the editor fetches the branch head and the latest versions of the
  changed files and re-applies your edits on top, so commits made elsewhere aren't overwritten
  (if the branch moves mid-commit it retries once). The success message links to the commit.
  **The live site updates after Vercel redeploys** (usually about a minute). Until you connect
  GitHub, the editor shows the content snapshot from the last build (`/edit/content/`) and can't
  save.

All JSON is written by the same formatter (`src/editor/lib/json-format.js`), so saves only
change the lines that changed.

#### One-time setup: GitHub token for the live editor

1. Go to GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens
   → Generate new token** (<https://github.com/settings/personal-access-tokens/new>).
2. Name it e.g. `eeliyarasta editor` and pick an expiration.
3. **Repository access → Only select repositories →** `Eeliya/eeliyarasta-website`.
4. **Permissions → Repository permissions → Contents: Read and write**. Leave everything else
   unset (Metadata: read-only gets added automatically).
5. Generate it, copy it, open `https://eeliyarasta.com/edit/`, click **Connect GitHub to save**
   and paste it.

The token is stored **only in that browser's `localStorage`** (key
`eeliyarasta-editor:github-token`). It is never committed and only ever sent to
`https://api.github.com` (the client refuses any other host). **Sign out** in the panel footer
deletes it. If it leaks, revoke it on the same GitHub page. It can only touch this one
repository's contents.

**Later:** swapping and reordering album photos (upload to `media/`, edit `images[]`) isn't in
the editor yet. Edit `people.json` / `places.json` and `media/` by hand for now.

### Design notes

* Black background, off-white type. Display: **Momo Trust Display**; UI/body: **DM Mono**
  (Google Fonts, `display=swap` with serif/monospace fallbacks).
* Glass UI (`.glass`): blur + saturation backdrop filter, a flat translucent fill (faintly
  tinted by the album accent, no gradient), a thin inner highlight border and a soft shadow. The blur lives on `::before`, so glass nested in glass (nav pill →
  dropdown) still blurs the page behind it.
* Navigation opens on **click only** (never hover): Photography (People, Places with names),
  Projects, About, Home. Small screens get a full-screen glass menu.
* Inspiration: Gregor Collienne and Hannah Miles (home hero), Faint Film (album slider/grid),
  House of Yellow (a proper website with sections and a big footer).

## Deploy

Any static host works: upload `dist/`.

**Vercel**: import the repo, Framework preset **Other**, Build command `npm run build`,
Output directory `dist`. Unknown URLs get `404.html` automatically. Commits made by the
visual editor trigger a normal redeploy. (Netlify, Cloudflare Pages
and GitHub Pages work the same way.)
