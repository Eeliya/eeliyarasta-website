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

Visual editor (dev only): `http://localhost:5173/edit/` while `npm run dev` runs (see [Visual editor](#visual-editor-edit-dev-only)).

Requires Node 20.19+ (Vite 8).

---

## How it works

```
content/            ← all text, albums, projects, animation config (JSON)
  pages/            ← one file per page (home, photography, people, places, projects, about, 404)
  sources/          ← lists that grids pull from (people, places, projects): top level is an array
  settings/         ← site-wide settings (site.json, animations.json)
media/              ← source photos (jpg), committed
scripts/
  images.mjs        ← media/ → public/media/*.webp sizes + .generated/media.json
  content.mjs       ← loads content/<folder>/*.json + media manifest (Node)
  vite-plugin-static-site.mjs  ← the "static site builder" (dev render + build prerender)
  editor-server.mjs ← dev-only editor endpoints: load / save / status / publish (localhost only)
src/
  site/             ← isomorphic templates (no Node APIs, run at build time AND in a browser)
    routes.js       ← list of pages, derived from content
    render.js       ← renderRoute(route, content) → { head, body }
    helpers.js      ← html``, esc(), img() with srcset/LQIP, accent colours
    templates/      ← layout, header/menu, footer, home, album, pages, partials
  client/           ← browser code
    main.js         ← boot: smooth scroll, menu, router, per-page mount
    router.js       ← SPA navigation over the prerendered HTML
    anim/engine.js  ← reads content/settings/animations.json, wires every [data-anim]
    anim/types.js   ← animation types (reveal, split, parallax, scatter, …)
    modules/        ← album slider, project accordion, card hover, misc
    ui/             ← menu (click-only), NL clock
    styles/         ← SCSS (tokens, glass, chrome, home, pages, album)
  editor/           ← the visual editor app (/edit/), dev server only, never built or shipped
    config.js       ← content files the editor may write and publish
    store.js        ← in-memory content copies, dirty state, undo/redo, rebase
    bridge.js       ← talks to the site inside the iframe (text overrides, selection, replay)
    source.js       ← talks to the dev-server endpoints (load, save, status, publish)
    ui/             ← text panel, motion panel, ease picker, fields
index.html          ← HTML shell with <!--ssr-head--> / <!--ssr-body--> markers
edit/index.html     ← editor entry (served by `npm run dev` only)
```

### Build / prerender ("SSR but static")

`vite-plugin-static-site.mjs` is the whole builder (~100 lines):

- **dev**: a middleware renders any HTML request from the `content/` JSON files with `src/site/render.js`
  (through Vite's SSR loader, so template edits reload instantly). Unknown URLs get the 404 page.
- **build**: Vite bundles the client from `index.html` (hashed JS/CSS). Then, in `closeBundle`,
  every route from `routes.js` is rendered into that shell and written to
  `dist/<route>/index.html`, plus `dist/404.html`, `sitemap.xml` and `robots.txt`.

Every page is real, crawlable HTML with its own `<title>`, description, canonical and Open Graph
tags, and works with JavaScript disabled.

### SPA behaviour

`src/client/router.js` intercepts internal link clicks, fetches the target's prerendered HTML
(prefetched on hover), runs the page-leave transition (a curtain showing the destination's
name; its text and an optional per-page `transition` live in the page's file `pages/<page>.json`,
or in the album's item in `sources/`), swaps `<main data-router-view>`, updates
title/meta/history, scrolls to top and re-mounts animations and page modules. Each page's tweens, ScrollTriggers, SplitTexts and listeners live
in one `gsap.context` and are reverted on leave. If anything fails it falls back to a normal
page load.

### Content

Content is split by kind, so a file name never means two things (a page called `site` and the
site settings can live side by side):

| file                               | what                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `content/settings/site.json`       | name, SEO description, socials (Instagram, YouTube, GitHub), email, nav labels, footer copy                                                                  |
| `content/settings/animations.json` | **every animation** (see below)                                                                                                                              |
| `content/pages/home.json`          | hero name (`hero.title`, the big title), hero text and the **scattered hero photos** (position `x/y/w` in %, mobile `mx/my/mw`, `depth`, `layer` back/front) |
| `content/pages/<page>.json`        | the other pages: `crumb`, `title`, `intro` (404 also `cta`; about: `headline`, `image`, `paragraphs`, `facts`), curtain text                                 |
| `content/sources/people.json`      | models: `slug`, `name`, role, location, `accent`, `cover`, `images[]` (with credits)                                                                         |
| `content/sources/places.json`      | places, same shape                                                                                                                                           |
| `content/sources/projects.json`    | projects: title, kind, year, description, url, image                                                                                                         |

Add a person: drop photos into `media/people/<slug>/`, add an entry to `sources/people.json`, done.

**Home sections** are an ordered list in `pages/home.json → sections`; the page renders them in
that order and numbers the headed ones (01), (02), … automatically. Each item has a `type`, its
text, and settings under `config`:

```json
{ "type": "intro", "text": "…", "config": { "enabled": true } }
{ "type": "grid", "label": "People", "title": "Models I've worked with", "cta": "All people",
  "config": { "enabled": true, "source": "people", "layout": "staggered" } }
{ "type": "projects", "label": "Projects", "title": "Things I build", "cta": "All projects",
  "config": { "enabled": true } }
```

A grid fills itself from `content/sources/<source>.json` (a top-level array) and links each
tile to `/<source>/<slug>/`. `config.layout` is `"staggered"` (default: offset columns) or `"even"`
(every row lines up). The source picks the tile look: `places` shows landscape cards, any other
list shows photo tiles (4 photos per item). A missing or non-array source logs a build warning and renders an
empty grid.
Routes, menu, dropdowns, grids and sitemap update automatically.

> ⚠️ **Placeholder content.** The two people (_Noor Vermeer_, _Daan Okafor_), the two places and
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
`content/settings/animations.json`:

```jsonc
{
  "presets": {
    "fade-up": {
      "type": "reveal",
      "from": { "autoAlpha": 0, "y": 40 },
      "to": { "autoAlpha": 1, "y": 0 },
      "duration": 1.1,
      "ease": "expo.out",
      "trigger": "scroll",
      "start": "top 85%",
    },
    "split-chars": {
      "type": "split",
      "split": "chars",
      "mask": "chars",
      "from": { "yPercent": 110 },
      "to": { "yPercent": 0 },
      "stagger": 0.035,
    },
    "scatter-drift": {
      "type": "scatter",
      "drift": { "amplitude": 14 },
      "scroll": { "distance": 55 },
    },
  },
  "targets": {
    "hero.title": { "preset": "hero-title" },
    "page.title": { "preset": "split-chars", "trigger": "load", "delay": 0.1 },
  },
  "interactions": { "...": "card cycle, album wheel/drag thresholds" },
  "transitions": { "...": "page curtain, accent tween, album slide, menu" },
  "smoothScroll": true,
}
```

`smoothScroll` turns GSAP ScrollSmoother on (default) or off (native scrolling); it is always off
for visitors who prefer reduced motion. Switch it in the editor's Settings tab.

The final spec for an element is
`preset ← target overrides ← element overrides ← data-anim-options`. Element overrides
(`elements`, keyed `"<page path>|<target>|<n>"`) are mostly written by the visual editor. With
`"trigger": "scroll"`, reveals play once at `start`, or follow the scrollbar between `start` and
`end` when `"scrub"` is `true` or a number (seconds of smoothing).
Types (`src/client/anim/types.js`): `reveal`, `split` (SplitText chars/words/lines, masked),
`scrub-words`, `parallax`, `scatter` (hero photo burst + endless drift + scroll depth), `hero-title`, `hover-preview`. New effect = new type function + preset.

`prefers-reduced-motion` is respected everywhere: no smooth scroll, no drift/parallax/splits,
instant album slides, a quick crossfade between pages.

### Visual editor (`/edit/`, dev only)

A WYSIWYG editor for **text and animations** (`edit/index.html` → `src/editor/`). It only exists
while **`npm run dev`** runs: `npm run build` bundles just the public site, so `dist/` has no
`/edit/` page, no editor code and no editor endpoints, and the editor shortcut isn't in the
public bundle either (the code that connects the site to the editor sits behind
`import.meta.env.DEV`).

**Open it:** `http://localhost:5173/edit/` while running `npm run dev`. Shortcut: **Ctrl/⌘ +
Shift + E** on any page of the dev site opens that page in the editor (and from the editor goes
back to the page).

Layout: the real site in a same-origin iframe, with a glass side panel. Pick a page from the
dropdown, or click links in Browse mode. There's also a mobile (390 px) preview toggle.

On the home page, every section box in the Content panel has ↑ / ↓ buttons that reorder
`pages/home.json → sections` (one undo step each) and an On/Off switch. Grid sections also show a
**Source** dropdown (the files in `content/sources/`) and a **Layout** dropdown (Staggered, Even).
The preview follows reorders, on/off and layout right away; a grid switched to another source
shows up in the preview after Save.

The **Sources** button opens the Source Explorer on the files in `content/sources/` (with their
item counts): click one to edit its items, **←** goes back to the files. A grid's Source edit
button, or a click on a person/place/project in the preview, opens straight into that item.

**Refresh** keeps your place. The URL holds the page, the tab, Menu/Footer and the open Source
Explorer item, so a shared link opens the same view:
`/edit/?path=/people/&tab=content&source=people&item=noor-vermeer` (`tab`: browse, content,
motion, settings; `view`: menu, footer; `motion=animations`: the Motion tab's Animations sub-tab; `anim`: the animation open there). Open/closed sections, the selected field or Motion
element and the scroll positions are kept per browser tab in sessionStorage. See
`src/editor/svelte/persist.js`.

| mode       | what it does                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browse** | Use the site normally. Shows unsaved changes per file, plus _Discard all_.                                                                                                                                                                                                                                                                                                                                                  |
| **Text**   | Animations pause. Every editable text gets an outline: click it and type (Enter ends a single-line field; multi-line fields take Enter as a line break). The panel lists the same fields as inputs, and both stay in sync.                                                                                                                                                                                                  |
| **Motion** | Click an animated element (or pick one from the Elements list). Pick its animation and set its own timing (duration, ease, delay, stagger, trigger, scroll start/end/scrub); what the animation does (from/to properties, type-specific values) is shown read-only and edited in the Animations sub-tab. Changes replay live. **Replay** runs the page again, and the **Scroll** slider moves the page through the element. |

In the edit modes, clicks on editable or animated elements select them instead of following
links. Hold **Alt** to click through.

In the editor a preset is called an **animation** (`presets` in `animations.json`). The
Motion tab lists the page's animated **Elements**; pick one and choose where its edits go:

- **This element**: `elements["<path>|<target>|<n>"]`, e.g. `"/about/|about.headline|0"`.
  Only this element on this page. This is how you give one element a different animation
  without touching templates.
- **All "target"**: `targets["about.headline"]`. Every element with that `data-anim`.

Timing fields (`TIMING_KEYS` in `src/editor/svelte/motion.js`) each have an **Inherit /
Custom** switch. Inherit shows the field's control with the inherited value, dimmed and
inert (no clicks, no focus); it stores nothing. Custom stores the value at
the chosen scope, and switching back to Inherit removes it (one undo step). Everything else
the animation does is read-only here.

The Motion tab has two sub-tabs: **Elements** (the curtain, the page's animated elements and
the picked element) and **Animations**, the library, inline in the panel so the preview stays
in view while you edit (the edit button next to an element's Animation opens it there; picking
an element in the preview goes back to Elements). It is the only place that defines what an animation
does: pick an animation to edit `presets["fade-up"]`, every value including timing, and add
or remove from/to properties. There is no global default layer: each animation carries every
value it uses, so what you see in the library is what it does. Edits play in the preview at
once; **Replay** runs them again. Seconds are in the labels: `Duration (s) / ease`,
`Delay (s)`, like the curtain's rows. The list shows how many elements on this page use each animation and which `data-anim` names
use it on the site.

Older non-timing overrides on an element or `data-anim` name (e.g. a parallax `speed` in
`targets`) are listed in a notice in the element view: **Move to animation** copies them into
the animation (which changes it for every element using it), **Drop** removes them.

Shortcuts: **Ctrl/⌘+E** toggles edit mode, **Ctrl/⌘+S** saves, **Ctrl/⌘+Z** / **Shift+Ctrl/⌘+Z**
undo/redo, **Esc** deselects.

**How text maps to JSON.** Templates mark text with the `ed()` helper, e.g.
`<h2${ed('pages/home.json', ['hero', 'eyebrow'])}>`, which renders
`data-edit="pages/home.json#/hero/eyebrow"` (a JSON Pointer). Use `ed(file, path, 'block')`
for multi-line text (`\n` ⇄ `<br>`), `'number'` for numbers and `'words'` for text rendered one
`<span>` per word (the hero name: edited as plain text, re-split into words and re-animated after the edit). Page copy (titles, intros) lives
in each page's `pages/<page>.json`, shared copy (nav, footer) in `settings/site.json`, for this reason. The editor only ever writes
existing JSON files in `content/pages/`, `content/sources/` and `content/settings/` (see
`src/editor/config.js`); it never creates files.

**Save and Publish**

- **Save** (**Ctrl/⌘+S**) writes the changed files to `content/` on disk. That's a **draft**:
  the preview (and Browse mode) shows it, and nothing leaves your machine. Only the preview
  reloads; the editor keeps its tab, scroll, open groups, selection and undo history.
- **Edits outside the editor** (your IDE, a `git checkout`) are picked up too: the preview
  reloads, and the editor takes the files on disk with your unsaved edits on top (a "Changed
  on disk" note; undo history starts over for that change).
- **Publish** commits **all saved content changes in one commit** and pushes it, so you can
  batch many edits into one publish. The dialog lists the changed files (status, number of
  changes, `+/-` lines) and any earlier commits on the branch that aren't pushed yet, and asks for a
  commit message. If you have unsaved edits it offers to **save them first** and include them.
  It then runs `git add` + `git commit` for **only the changed content JSON files** (other
  staged or modified files are never committed) and `git push origin <current branch>`. On
  success it links to the commit on GitHub. If the push fails (e.g. git has no GitHub login on
  this machine), the commit stays local, the error output is shown, and **Retry push** pushes it
  later.
- The panel footer always shows how many **saved changes aren't published** yet (and commits
  not pushed).

The endpoints live in `scripts/editor-server.mjs` (`/__editor/content`, `/save`, `/status`,
`/publish`). They exist only on the dev server, accept **only requests from this machine**
(loopback address, localhost `Host`, same-origin `Origin`), and only touch the files listed in
`src/editor/config.js`. Git runs without a shell and never prompts in the terminal, so pushing
needs a working git login for GitHub on the machine running `npm run dev` (e.g. `gh auth login`
then `gh auth setup-git`).

All JSON is written by the same formatter (`src/editor/lib/json-format.js`), so saves only
change the lines that changed.

**Later:** swapping and reordering album photos (upload to `media/`, edit `images[]`) isn't in
the editor yet. Edit `content/sources/*.json` and `media/` by hand for now.

### Design notes

- Black background, off-white type. Display: **Momo Trust Display**; UI/body: **DM Mono**
  (Google Fonts, `display=swap` with serif/monospace fallbacks).
- Glass UI (`.glass`): blur + saturation backdrop filter, a flat translucent fill (faintly
  tinted by the album accent, no gradient), a thin inner highlight border and a soft shadow. The blur lives on `::before`, so glass nested in glass (nav pill →
  dropdown) still blurs the page behind it.
- The normal system cursor everywhere (no custom cursor), and nothing follows the mouse: the hero
  photos only drift and react to scrolling, and the project list preview sits next to the hovered row.
- Navigation opens on **click only** (never hover): Photography (People, Places with names),
  Projects, About, Home. Small screens get a full-screen glass menu.
- Inspiration: Gregor Collienne and Hannah Miles (home hero), Faint Film (album slider/grid),
  House of Yellow (a proper website with sections and a big footer).

## Deploy

Any static host works: upload `dist/`.

**Vercel**: import the repo, Framework preset **Other**, Build command `npm run build`,
Output directory `dist`. Unknown URLs get `404.html` automatically. Pushes from the
editor's Publish button trigger a normal redeploy. (Netlify, Cloudflare Pages
and GitHub Pages work the same way.)
