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
npm test          # unit tests (R2 upload and delete against a local mock S3, ...)
npm run lint      # ESLint + Stylelint (npm run lint:fix fixes what it can)
npm run images    # media/ → public/media/*.webp sizes (dev and build run it first)
npm run check:links  # after a build: every internal link in dist/ points at a file
npm run mock -- <name>  # screenshot an editor UI mock (sandbox/README.md)
```

Visual editor (dev only): `http://localhost:5173/edit/` while `npm run dev` runs (see [Visual editor](#visual-editor-edit-dev-only)).

Requires Node `^20.19.0 || >=22.12.0` (Vite 8's engines). `npm run mock` passes
`--experimental-websocket`, which only Node 20 needs.

### Linting

- **ESLint** (`eslint.config.js`): JS recommended + Svelte recommended (Svelte 5, a11y checks),
  browser globals in `src/`, Node globals in `scripts/` and configs. `console.log` warns in `src/`
  (`console.warn`/`error` are fine), anything goes in `scripts/`.
- **Stylelint** (`stylelint.config.mjs`): standard SCSS rules, relaxed (blank lines, alpha notation
  and vendor prefixes are free), BEM class names (`block__elem--mod`), Svelte `<style>` blocks too.
- **Editor-only rules** (`scripts/stylelint-4px.mjs`, three, for `src/editor/**`):
  `local/grid-4px`: padding, margin, gap, sizes, radius, offsets, inset and translate in multiples
  of 4px (0, 1px and 999px pills are fine; font sizes, line heights, borders and %/em/vw are not
  checked). `local/no-alpha-text-color`: no transparent text colors (`rgb(… / .5)`, `#rrggbbaa`);
  it can't see `opacity` on text or colors behind variables. `local/no-raw-tokens`: no raw hex
  colours or px font sizes outside the token files.
- Prettier owns formatting; neither linter checks style.
- Disable a rule only inline, for one line, with the reason:
  `// eslint-disable-next-line no-console -- why` or `/* stylelint-disable-next-line local/grid-4px -- why */`.

**Pre-push hook:** `.githooks/pre-push` runs `npm run lint && npm test` before every `git push`.
`npm install` turns it on (the `prepare` script sets `git config core.hooksPath .githooks`), so
run `npm install` after pulling this. It works in Git for Windows' sh. Skip it once with
`git push --no-verify`.

---

## How it works

```
content/            ← all text, albums, projects, animation config (JSON)
 en/                ← one folder per language (only en so far; the site's lang is site.json "lang")
  pages/            ← one folder per page (its URL) with index.json in it (see "Pages and URLs")
  sources/          ← lists that grids pull from (people, places, projects): { version, items: [...] },
                      plus <id>.schema.json: the fields of its items (see "Sources & schemas")
  settings/         ← site-wide settings (site.json, nav.json, animations.json, photos.json, redirects.json)
                      and footer.json: the footer's sections (see "Footer")
  strings.json      ← UI text of the templates: the menu's Menu / Close / clock label
media/              ← source photos (jpg), committed
scripts/
  images.mjs        ← media/ → public/media/*.webp sizes + .generated/media.json
  content.mjs       ← loads content/en/<folder>/*.json and strings.json + media manifest (Node)
  image-variants.mjs ← the webp sizes (sharp), for images.mjs and r2.mjs
  r2.mjs            ← editor uploads: resized, stored in Cloudflare R2, listed in photos.json
  vite-plugin-static-site.mjs  ← the "static site builder" (dev render + build prerender)
  editor-server.mjs ← dev-only editor endpoints: content / save / draft / render / status /
                      upload / media / pages / publish (localhost only)
  git-env.mjs       ← git's environment without a hook's GIT_DIR & co. (Publish)
  contact-dev.mjs   ← the dev server's POST /api/contact (logs instead of sending)
  check-links.mjs   ← npm run check:links: every internal link in dist/ points at a file
  mock.mjs          ← npm run mock: screenshots of sandbox/mocks
  stylelint-4px.mjs ← the editor's local stylelint rules
  test-layout.mjs   ← shared test helpers
  *.test.mjs        ← the unit tests (node --test)
functions/api/contact.js ← the contact form's Cloudflare Pages Function (emails via Resend)
sandbox/            ← editor UI mocks (mocks/, kit/) and their harness; edit/sandbox/ serves it
src/
  site/             ← isomorphic templates (no Node APIs, run at build time AND in a browser)
    routes.js       ← list of pages, from the files in content/en/pages/
    render.js       ← renderRoute(route, content) → { head, body }
    helpers.js      ← html``, esc(), img() with srcset/LQIP, accent colours
    is.js           ← isObject, isExternal (a leaf module: anything can import it)
    files.js        ← the content files by kind, VERSION, contentFromFiles
    validate.js     ← checkContent: what the build and Save refuse
    defaults.js     ← default values, left out of saved files
    schemas.js      ← sources' schemas (fields of their items)
    seo.js          ← titles, descriptions, canonical, Open Graph
    redirects.js    ← redirects.json → _redirects, moved items
    hrefs.js        ← links to pages, items and anchors
    backdrop.js     ← a page's photo backdrop
    layout/         ← sections and blocks on the square 120-column grid, real rows, ids (see "Layout")
    blocks/         ← the block registry: every block type (see "Layout")
    templates/      ← layout, header/menu, footer (its sections), partials
  client/           ← browser code
    main.js         ← boot: menu, router, per-page mount
    router.js       ← SPA navigation over the prerendered HTML
    theme.js        ← the accent colour
    scroll.js       ← native scroll and ScrollTrigger
    anim/engine.js  ← reads content/en/settings/animations.json, wires every [data-anim]
    anim/types.js   ← animation types (reveal, split, parallax, scatter, …)
    modules/        ← real rows, album slider, project accordion, card hover, misc
    ui/             ← menu (click-only), clock
    styles/         ← SCSS (tokens, glass, chrome, home, pages, album)
  editor/           ← the visual editor app (/edit/), dev server only, never built or shipped
    config.js       ← content files the editor may write and publish
    store.js        ← in-memory content copies, dirty state, undo/redo, rebase
    bridge.js       ← talks to the site inside the iframe (text overrides, selection, replay)
    source.js       ← talks to the dev-server endpoints (load, save, status, publish)
    svelte/         ← the editor UI (Svelte 5): panels, fields, modals
    lib/            ← small editor helpers (pointers, diff, format, show-value, dialog)
index.html          ← HTML shell with <!--ssr-head--> / <!--ssr-body--> markers
edit/index.html     ← editor entry (served by `npm run dev` only)
```

**Content shape.** Every content file is a JSON object whose first key is `"version": 1`, the
shape version (`VERSION` in `src/site/files.js`; the build and Save refuse anything else). A file
whose data is a list or a map keeps it under one key next to it: a source's `"items"`,
redirects.json's `"redirects"`, photos.json's `"photos"`. A change of shape bumps the version and
converts the content in the same commit.

**Item ids.** Every source item has a stable `id` (`"p-k3x9"`, given once, never changed): blocks
and links point at items by it; its `slug` is only its URL and can change. A `cover` is the path
of one of the item's own photos (empty: the first).

### Build / prerender ("SSR but static")

`vite-plugin-static-site.mjs` is the whole builder (~200 lines):

- **dev**: a middleware renders any HTML request from the `content/en/` JSON files with `src/site/render.js`
  (through Vite's SSR loader, so template edits reload instantly). Unknown URLs get the 404 page.
- **build**: Vite bundles the client from `index.html` (hashed JS/CSS). Then, in `closeBundle`,
  every route from `routes.js` is rendered into that shell and written to
  `dist/<route>/index.html`, plus `dist/404.html`, `sitemap.xml`, `robots.txt` and `_redirects`.

Every page is real, crawlable HTML with its own `<title>`, description, canonical and Open Graph
tags, and works with JavaScript disabled.

### SPA behaviour

`src/client/router.js` intercepts internal link clicks, fetches the target's prerendered HTML
(prefetched on hover), runs the page-leave transition (a curtain showing the destination's
name; its text, `curtainText`, lives in the page's file `pages/<page>/index.json` or in the
item in `sources/`: missing, the page's title; `""`, no label. The curtain's timing is the
site's alone (settings/animations.json); a page's `transition` is only `{ "preset": "none" }`
(no curtain: a fade), on its `[slug].json` for every item page; missing: the site's curtain),
swaps `<main data-router-view>`, updates
title/meta/history, scrolls to top and re-mounts animations and page modules. Each page's tweens, ScrollTriggers, SplitTexts and listeners live
in one `gsap.context` and are reverted on leave. If anything fails it falls back to a normal
page load.

### Content

Content is split by kind, so a file name never means two things (a page called `site` and the
site settings can live side by side):

| file                                  | what                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/en/settings/nav.json`        | the **menus**: the header (nav pill, dropdowns, mobile menu; see "Menu")                                                                                                                                                                                                                                          |
| `content/en/settings/footer.json`     | the **footer**: `{ version, kind: "part", sections }`, sections and blocks exactly like a page's, under every page (see "Footer")                                                                                                                                                                                 |
| `content/en/strings.json`             | UI text of the templates: the menu button and clock labels (`nav.menu`, `nav.close`, `nav.clock`)                                                                                                                                                                                                                 |
| `content/en/settings/site.json`       | name, the **SEO defaults** (`title`, `titleTemplate`, `description`, `ogImage`, `url`, `robots`, `lang`; see "SEO"), `forms` (where contact forms send, see "Contact form"), socials, email, `timezone` of the clock, `jobTitle` / `country` (structured data on home)                                            |
| `content/en/settings/animations.json` | **every animation** (see below)                                                                                                                                                                                                                                                                                   |
| `content/en/pages/index.json`         | home: its `sections` of blocks (the hero first: the big name, its text and the **scattered hero photos**, position `x/y/w` in %, `phone` over them (`{ x?, y?, w? }`, `null`: hidden on phones), `depth`, `layer` back/front), curtain text                                                                       |
| `content/en/pages/<page>/index.json`  | the other pages: their `sections` of blocks (see "Layout"), curtain text, `meta`: its title, description, share image, `noindex`, canonical (see "SEO")                                                                                                                                                           |
| `content/en/sources/people.json`      | models: `id`, `slug`, `title`, role, `body`, location, `accent`, `cover` (the path of one of its photos), `images[]` (photo paths)                                                                                                                                                                                |
| `content/en/sources/places.json`      | places, same shape                                                                                                                                                                                                                                                                                                |
| `content/en/sources/projects.json`    | projects: title, type, year, body, url, image; `linkOut: true` makes the menus link straight to its `url`                                                                                                                                                                                                         |
| `content/en/settings/redirects.json`  | **redirects** from old addresses: `[{ "from", "to", "status"? }]` (see "Redirects")                                                                                                                                                                                                                               |
| `content/en/settings/photos.json`     | the **photo library**: every photo's `alt`, `credit` (`{ name, url?, source?, license? }`) and optional `focal` (`{ x, y }`, 0–100), keyed by media/ path or R2 key (`{ "people/noor-vermeer/01.jpg": { "alt": "…" } }`) and the sizes of photos uploaded to R2; written by the editor's Media window and uploads |

| `content/en/pages/people/[slug].json` | the people pages: `template.source` (the source with a page per item), then sections and blocks like any page; see "Pages and URLs" |

Add a person: drop photos into `media/people/<slug>/`, add an entry to `sources/people.json`, done.

Routes, menu, dropdowns, grids and sitemap update automatically.

### Sources & schemas

Each list in `content/en/sources/` can have a schema next to it, `<id>.schema.json`
(`people.schema.json`): what an item has, in a small format of its own (not JSON Schema),
shaped like the block registry's fields (`src/site/schemas.js`):

```json
{
  "label": "People",
  "title": "name",
  "slug": "slug",
  "fields": [
    { "key": "slug", "label": "Slug", "type": "text", "required": true, "help": "The page URL" },
    { "key": "name", "label": "Name", "type": "text", "required": true },
    { "key": "role", "label": "Role", "type": "text", "width": "half", "list": true },
    { "key": "year", "label": "Year", "type": "number", "width": "half" },
    { "key": "images", "label": "Photos", "type": "photos" }
  ]
}
```

- `title`: the field that names an item (the editor's lists, page titles, `<name> | People`);
  `slug`: the field with its URL slug (`/people/<slug>/`; empty: the title, slugified).
- `type`: `text`, `longtext` (lines), `number`, `photo` (a `media/` path or R2 key), `photos`
  (a list of photo paths), `link` (`https://…`, `/path/` or `mailto:`), `choice`
  (one of `options: ["a", "b"]`), `boolean`, `date` (`YYYY-MM-DD`).
- `width: "half"`: two half fields next to each other share a row in the editor (one column
  when the panel is narrow); `required`, `help` (a hint under the field), `list` (shown under
  the name in the Source Explorer's item list).
- Keys a schema doesn't name are kept as they are, not edited or checked (`transition`).

**Checks.** Save and `npm run build` check every source against its schema: required values,
types, choice options, links, dates, valid unique slugs, and photos that exist (in `media/` or
`content/en/settings/photos.json`). Save writes nothing and shows the problems
(`content/en/sources/people.json: item 1: "Name" is required`); the build stops with the list.

**No schema?** A source without one still works: its schema is inferred from its items, one
type per field across all of them (numbers, true/false, lists of photos, media paths, text with
line breaks or over ~80 characters as `longtext`, text under ~24 characters as half width;
objects and mixed values are left out). The title is `name`, else `title`, else the first text
field; the slug is `slug`. Write a schema file to give fields labels, order, help and checks.

The editor uses the schema everywhere: the Source Explorer's fields (labels, widgets, widths,
help), the item names and list lines, the slug field, a new item's empty fields; the Content
tab's labels and widgets for source fields. Schema files are not sources: pickers and the
Source Explorer don't list them. A new source is a new `<id>.json` (with its schema) by hand.

> ⚠️ **Placeholder content.** The two people (_Noor Vermeer_, _Daan Okafor_), the two places and
> the two DIY projects are placeholders (`"placeholder": true`, shown with a "Placeholder" tag).
> Their photos are free Unsplash images (Unsplash License); photographer and source URL are
> each photo's `credit` in `content/en/settings/photos.json` and shown as a credit in the album view. Replace them with
> real shoots. The email `hello@eeliyarasta.com` is a placeholder too.
> Pages of items with `"placeholder": true` get `noindex` and are left out of `sitemap.xml`;
> remove the flag (or set it to `false`) when the item is real.

### Layout

Every page is an ordered list of **sections**, `sections` in its file (a `[slug].json` too), and
every section is a grid of **blocks** (`src/site/layout/`):

```json
{
  "id": "s-k3x9",
  "name": "Our people",
  "height": "half",
  "blocks": [
    {
      "id": "b-7qpa",
      "type": "heading",
      "eyebrow": "Photography / People",
      "title": "People",
      "config": { "count": "people", "numbered": true },
      "layout": { "base": { "col": 1, "span": 120, "row": 1 } }
    },
    {
      "id": "b-2fq0",
      "type": "photo",
      "src": "people/noor/01.jpg",
      "size": "aspect",
      "aspect": "4:5",
      "layout": { "base": { "col": 61, "span": 60, "row": 4, "rows": 20 } },
      "z": 1
    },
    {
      "id": "b-c4pt",
      "type": "text",
      "text": "Noor, Amsterdam 2026",
      "layout": {
        "base": { "col": 61, "span": 40, "row": 26, "link": { "to": "b-2fq0", "gap": 1 } },
        "phone": null
      },
      "scale": { "on": true, "adjust": 90 }
    }
  ]
}
```

- **The grid (square):** **120 columns** and **real rows**, all
  one size, `--cell`, so **every cell is exactly square**, with no gaps either way (leave empty
  cells between blocks for a gutter: 2 cells ≈ 23px at 1440px). `src/client/modules/rows.js`
  measures each section's content width on load and sets `--cell` = width / 120 on it, floored
  to 1/64px (the browser's layout unit, so a column and a row lay out to exactly the same size;
  the under-2px left over is centred, `justify-content: center`); a ResizeObserver on every
  section and the window's `resize` keep it current (rAF-throttled, the resize itself at once).
  Before that runs (and without JS) `_layout.scss` uses `calc((100vw - 2 * var(--pad)) / 120)`
  (`100vw / 120` full width), within a fraction of a px of the measured cell; not container
  query units, because a size container would trap the fixed and fullscreen blocks. At 1440px
  a cell is 11.375px (12px full width), at 800px 6.3px. Rows never grow: every block spans a
  whole number of rows; when its content needs more, it spans more (see Real rows below), so
  text never spills out. The old `rowHeight` is ignored. On phones the grid has **60 columns**
  (below).
- **A section:** `height` is `custom`: exactly `rows.min` rows of square cells (1–999, only
  with `custom`), its blocks at their rows **from the top** (not centred), so the rows below
  the last block are empty space under it; never shorter than its content (when a block
  grows, the section is its content's rows, the empty rows don't stack on top). Phones can
  have a height of their own, `phone.height` (any of the five, set only in the editor's phone
  preview, where a reset beside it goes back to following the desktop); unset, the desktop's.
  When the phone height is custom its rows are `phone.rows.min`, or else (the desktop custom
  too) half the desktop rows, rounded up, the way a block's desktop area is halved there.
  `width` is shared. In the editor a
  line on its bottom edge drags its rows (the phone's in the phone preview, never below its
  content), and a block dragged or resized past its bottom makes its rows its content's
  (they only grow that way: moving the block back up leaves empty rows). Or `height` is a **minimum** with the rows
  centred: `fit` (default: its content, i.e. its rows),
  `third`, `half` or `full` (at least 1/3, 1/2 or all of the screen's height: `min-height`
  33.333svh / 50svh / 100svh; a custom one `.sec--h-custom`, its `--rows` at least
  `--minrows`, `--mminrows` on phones, kept so by `rows.js`). Its rows are always down to its lowest block (uniform square
  cells, no row count of its own); when the section is taller than them they are **centred
  vertically** (`align-content: center`), and content taller than the minimum makes the
  section taller. `width` is `contained` (inside the page's side margins, `--pad`) or `full`
  (edge to edge); `enabled: false` turns it off: the public page leaves it out, the editor's preview
  renders it hidden (so the switch shows it again at once). A section has **no space above or below**: the
  space between sections is empty rows (cells: a block placed lower leaves rows above it), so
  it scales with the width like everything else (the side margins, `--pad`, stay).
- **Contained width** (`site.json` `"layout": { "containedCols": 115 }`, Settings › Layout, 60–120):
  a contained section is that many columns of the full-width grid's cell (window width / 120)
  wide, centred, and never nearer the window's edges than the side margins (`--pad`). Its
  content is still the 120-column grid, its cells smaller, so blocks keep their columns and a
  narrower setting scales the layout down like a narrower window (rather than N columns of the
  full-width cell, which would cut off blocks placed past column N). The default, 115, is the
  look before the setting (up to 1920px the margins are the narrower; wider, 115/120 of the
  width). Settings shows the resulting px at 1280, 1366, 1440, 1536 and 1920 wide, and the
  preview follows as you type. Phones: the full 60-column grid inside the side margins. On the
  page it is `--contain` on `:root` (only when not the default), read by `_layout.scss`
  (`--cpad`); `src/site/layout/contain.js`.
- **A section's name (its anchor):** optional `name`, slugified into the section's HTML `id`
  (`"Our People"` → `id="our-people"`), so `/page/#our-people` links to it. It lands just below
  the fixed header (`scroll-margin-top: var(--header-h)`), with native scrolling, on a link on
  the same page (the router's `router:hash`: a smooth scroll, a jump with reduced motion) and
  when the page opens with the hash: `src/client/modules/anchors.js` keeps the section in place
  for a moment while `rows.js`, fonts and images settle the layout above it (until you scroll).
  Validation: the name's slug must start with a letter (a number is an album photo's hash), not
  be one of the page's own ids (`main`, `portal`, `page-curtains`, `accent-init`,
  `mobile-menu`), and be unique on the page; a clash with another id on the rendered page (a
  project row's slug, say) is a build warning (`[anchors]`). Without a name: no id.
- **A page** has no grid setting: the page grid is always 120 columns (a `grid` key is
  refused).
- **A block:** its `type` and content (below), `layout` (below), `z` (its layer when blocks
  overlap), `size`, `scale` (text blocks, below) and an optional `motion`
  (`{ "anim": "fade-scrub", "start": "top 70%" }`: an animation from the library plus its own
  timing, see Animations).
- **Size** (`size`): `auto` (**default**: as tall as its content), `aspect` (its width, from its
  columns, × `aspect`: `1:1 4:5 3:4 2:3 3:2 16:9 21:9` or any `"w:h"`; photos fill it, cropped
  (`object-fit: cover`)) or `rows` (exactly its `layout.base.rows`, fixed). An aspect or auto
  block spans the rows its height needs at the page's width. Only `aspect` and `rows` blocks
  store `rows`; an auto block's rows are never stored: the page's script measures them (before
  it runs an auto block spans one row).
- **Layout** (`layout`, `src/site/layout/grid.js`): `{ "base": { col, span, row, rows?, link? },
"phone"?: { …the same keys… } | null }`. `base`: its area on the 120-column grid
  (first column 1–120, columns, first row; without a layout it is full width in row 1), and its
  `link`. `phone`: only what changes on phones, over what it would show there (its
  base area halved, its base link with the gap halved); `null`: hidden on phones.
  The same rule as hero photos (`x/y/w` plus `phone`).
- **Free blocks and links** (`src/site/layout/links.js`): blocks are **free**: each stays at
  the row it was placed on whatever the blocks above it do, and blocks may overlap (`z` orders
  them). A block can **follow** another block of its section instead,
  `layout.base.link`, `{ "to": "b-2fq0", "gap": 1 }`: its top is that block's bottom plus `gap` cells
  (negative: they overlap, e.g. a caption over a photo's bottom edge), so when the leader grows
  or shrinks (text wrapping at another width, an aspect photo) its followers move with it, and
  theirs with them. One leader per block, any number of followers per leader, chains; no loops
  and no links to another section (validation rejects both, and a link to a block that isn't
  there). New blocks start free; the editor links them (Visual editor).
- **Real rows** (`src/site/layout/flow.js`, applied by `src/client/modules/rows.js`): on the
  page, every auto or aspect block is measured (its content, or its width × ratio) and spans the
  whole rows that needs (a fixed-rows block keeps its rows). Then the links are resolved in their
  order (a leader before its followers): a follower's first row is its leader's last row now + 1
  - its gap (at least row 1); free blocks stay at their stored row. The section has the rows its
    lowest block reaches now. This runs in the
    same measure pass as `--cell`: when the page mounts, at once on a window resize (and again on
    the next frame), when a block's content changes size (ResizeObserver: images, fonts) and when
    the editor changes a layout; it sets `--fr` / `--frs` on the blocks and `--frows` on the
    section, over the stored `--r` / `--rs` / `--rows` (the phone grid's likewise). Links reach the
    page as `data-link="<id> <gap>"` and `data-mlink` (the phone's) on the block. In a section
    with a minimum height a block that fits in it gets the whole rows that fit (rows stay square, so up to a cell
    short; its content is still screen-high), centred. Without JavaScript the stored areas apply
    as they are (the editor keeps a follower's stored row at its leader's stored bottom + gap).
- **Scaled text** (`src/site/layout/type.js`): a text block (`heading`, `text`, `button`) with
  `"scale": { "on": true, "adjust": 90 }` sizes its text in cells, so it grows and shrinks with
  the grid; `adjust` is its % of its styles (default 100). The styles are set once in
  `site.json` `typography` (Settings › Typography), each in cells of the 120-column grid:
  `{ "paragraph": { "size": 1.4, "line": 1.75, "tracking": 0, "min": 14 } }`: font size (cells),
  line height (× the size), letter spacing (em) and a minimum font size (px, so text stays
  readable on phones). Defaults: title 19 (a heading's title), heading 3 (a text's title),
  paragraph 1.4 (text, a heading's body), label 1 (a heading's eyebrow, a button), ≈ the fixed
  sizes at 1440px. On phones a style's cell is half a 60-column cell (the 120 grid's), so the
  text scales like the layout and the minimum takes over. Off (default): the style's normal
  fixed size from the stylesheets.
- **Phones** (below 760px): every section is a **60-column** square grid (`--cell` = width /
  60, ~6px at 390px; its rows `--mrows`). Nothing stacks: a block without a phone area of its
  own shows its **desktop area halved** (columns and rows, rounded to the cells it covers:
  `grid.js` `halfArea`), so a phone starts as the desktop layout scaled down, and its desktop
  link comes along with the gap halved. A block's `layout.phone` changes that:
  `{ "col": 1, "span": 60, "row": 1, "rows": 20, "link": { "to": "b-…", "gap": 2 } }`: its own
  phone area and its own phone link (desktop and phone links are separate once it has a phone
  area). Why 60: half of 120, so halving is exact; 120 columns on a 390px screen
  would be 3px cells.
- **Ids:** every section and block has a stable id (`s-…`, `b-…`), given once when it is made
  (`src/site/layout/ids.js`) and kept when it moves or changes. The editor finds them in the
  preview by it (`data-sec`, `data-block`, dev only).
- **CSS:** positions are CSS variables on the elements (`--rows --mrows` on a section, its
  height preset a class: `.sec--h-third`, `.sec--h-half`, `.sec--h-full`,
  `--c --s --r --rs --z --ar --tk` and
  `--mc --ms --mr --mrs` on a block), links as `data-link` / `data-mlink`, size and scaled text
  as classes (`.blk--aspect`, `.blk--auto`, `.blk--scale`), laid out by
  `src/client/styles/_layout.scss`. Blocks carry no outer spacing of their own, and neither do
  sections (above and below): empty rows are the space.
- **Validation:** Save and the build check the layout (ids, enums, whole numbers, a block
  ending by column 120 (60 on the phone), links within their section to a block that is
  there and without loops, `scale` on text blocks only, `typography` styles, no id twice on a page,
  section names unique on their page and valid anchors (above), no section `aspect` /
  `spacing` / `mobile` / `rows` / `align`, which are gone) and each block against its type (strings, lists,
  config values). An unknown block type isn't an error: it logs a build warning and is skipped.
- **Bindings:** a block's field can show a source item's value instead of its own (below).

**Blocks.** The block types live in **one registry**, `src/site/blocks/` (`index.js` explains the
shape): the build renders with it, and the editor reads it for each block's fields and settings
and for **Add block**. A type is `{ type, label, icon, fields, config, defaults, render(block,
ctx, b) }`; `item` binds it to a `[slug]` page's item. A block's content sits next to its type,
how it works under `config` (`enabled`: on/off; the source, look, …):

| type       | what                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `heading`  | page heading: `eyebrow`, `title`, `body`, `cta`; config `count` (a source's item count), `link`, `center`, `numbered` |
| `text`     | `body`: paragraphs (a blank line starts one) under an optional `title`                                                |
| `photo`    | one photo (`src`) with an optional `caption`                                                                          |
| `button`   | a button: `label`; config `link` (see Links)                                                                          |
| `form`     | a contact form (see "Contact form")                                                                                   |
| `hero`     | the home hero: `title` (one word per line), `eyebrow`, `body`, scattered `photos`                                     |
| `intro`    | a statement (`body`)                                                                                                  |
| `grid`     | a head + tiles of a source; config `source`, `layout` (`staggered` / `even`); `places` shows cards                    |
| `albums`   | album cards of a source (the people/places index); config `source`, `layout` (`portrait` / `landscape`)               |
| `panels`   | big links to sources: `panels` `[{ source, title, unit }]` (photography)                                              |
| `projects` | the project accordion of a source; with a `title` it gets a head (home)                                               |
| `about`    | the about block: `image`, `eyebrow`, `title`, `body` (paragraphs), `facts`, `emailLabel`                              |
| `album`    | **item**: the item's album (slider, grid, info), only on a `[slug]` page: `title`, `meta` (facts), `body`             |

- **Numbering:** nothing is numbered by itself. A heading with config `numbered` starts its eyebrow
  with its number among the page's numbered headings that are on: (01), (02), …
- **Item pages:** a `[slug].json`'s blocks render once per item. A type marked `item` (the
  `album` block) reads the page's item, `ctx.route.album`, for its photos; its texts, like any
  block's, are bindings to the item (below), so every block shows the page's item through them.
  Item types are only offered on `[slug]` pages.
- **Animations:** a block's `motion` picks its animation (a new block gets its type's default
  from the registry, e.g. text `lines-up`, photo `image-reveal`, grid `grid-reveal`). Composite
  blocks (hero, heading, about, album, section heads) keep `data-anim` **parts** inside them
  for their own pieces (see Animations).
- **A new type:** add it to a file in `src/site/blocks/` and to `BLOCK_TYPES` in `index.js`
  (and its styles); the editor shows it with no editor code.

### Bindings

Any text, long text, photo or link field of a block (and a link in its config, `link`) can show a
value of a **source item** instead of its own (`src/site/layout/bindings.js`):

```json
{
  "type": "heading",
  "eyebrow": "Featured",
  "title": { "bind": "title" },
  "body": { "bind": "role", "format": "{value} in Amsterdam" },
  "item": { "source": "people", "id": "p-qw7b" }
}
```

- **Custom:** a plain value, as before.
- **`{ "bind": "<field>" }`:** the item's whole value. Its type must fit the field's (a text field
  takes `text`, `choice`, `number`, `date`, `link`; a long text also `longtext`; a photo
  `photo`; a link `link`; a list of photos (`[{ src }]`) `photos`; see `BIND_TYPES`).
- **`"format"`** (text fields only, also a list's texts like the album's facts): text around
  the value, `{value}` marks where it goes, e.g. `"{value} photos"`. An empty value leaves the
  whole field empty. There is no `{{field}}` syntax: one field, one binding.
- **The item:** a block's own `item: { source, id }`, else, on a `[slug]` page, the page's
  item. Without one its bound fields render empty (a build warning).
- **Rendering:** one resolver, `resolveBlock()`, swaps the values in before every block renders
  (`src/site/layout/index.js`), so blocks don't know about bindings; values are escaped as
  always. A block without bindings renders exactly as before.
- **Checks:** Save and the build check their shape (`validate.js`) and, against the sources'
  schemas, `bindingProblems()`: a `{ bind }` to a field the source doesn't have or of a type
  that doesn't fit, or an item from a source that isn't one, is an error (Save refuses, the
  build stops; a changed schema that breaks a page's binding too). A binding without an item and an item that isn't in its source are build
  warnings (`[bindings] …`) and render empty.
- **The `[slug]` pages** are built this way: the album block's title is `{ "bind": "title" }`, its
  facts are `{ "label": "Role", "value": { "bind": "role" } }`, … (a fact whose value is empty is left
  out; the photo count comes last), its body `{ "bind": "body" }`. Their output is the
  same as before. A new `[slug]` page binds the source's title field, its list fields as facts
  and its first long text.
- **In the editor:** bound values aren't typed in the preview; a click selects them and opens
  their block on the field. Each bindable field has a **Source** switch in its label row: on,
  it shows a Select of the item's fields that fit (the title field first); off, the field
  gets what it showed as its own text. A bound text has a **format** input under it
  (`{value}` and the text around it). The block's Content tab starts with **Item from** (a source, or none /
  this page's item) and **Item**. The preview shows the values of the item it shows; what can't
  be filled shows dimmed as `{{title}}` there (only there). Editing a source renders the
  sections that show it again.

### Menu

`content/en/settings/nav.json` holds the menu: `header` (the nav pill, its dropdowns and the
mobile menu). An item is a link (see Links) with a
label: to a page by its id (`page`), to an item's page (`item`), or anywhere else (`href`,
opens in a new tab). A page or item that isn't there gives a `[links]` build warning and `#`:

```json
{ "label": "About", "page": "pg-lyos" }
{ "label": "Noor", "item": { "source": "people", "id": "p-qw7b" } }
{ "label": "Shop", "href": "https://shop.example.com" }
{ "label": "Photography", "page": "pg-evsk", "all": "All photography",
  "children": [{ "label": "People", "page": "pg-yzuw", "items": "people" }, …] }
{ "label": "Projects", "page": "pg-cwyg", "all": "All projects", "items": "projects" }
```

### Footer

`content/en/settings/footer.json` is the footer: `{ "version": 1, "kind": "part", "sections": [] }`.
Pages and the footer are one document type (`src/site/files.js` `docKindOf`, `docOf`): `"kind"` is
`"page"` in a page file and `"part"` (a site part: only `sections`) here, and must match the file.
Its sections are blocks exactly like a page's (the same grid, blocks, phone layout and motion; validated and tidied
like a page's), rendered under every page by `src/site/templates/footer.js`. It starts empty
(nothing shows). It sits outside the page's view, right after `<main>`, so page transitions swap
the page and leave the footer be; it is in the view's layer (`.site-footer`: z-index 2, between
`#backdrop` and `#portal`; the curtain covers it). Its rows, animations and block scripts mount
with each page (`src/client/main.js`).

In the editor the footer is **Footer** in the page menu, or click it in the preview: a locked
footer (a dashed outline on hover, its label) picks nothing inside; the first click opens it
(a solid outline, the Footer is the target) and its sections and blocks are picked and dragged
like a page's, while the page's are locked. Esc with nothing picked, or a click outside it,
locks it again. An empty footer shows a 96px placeholder in the editor to click.

### Links

A link in the content says what it points at; its URL is made at build time
(`src/site/hrefs.js`, `hrefOf()`), so renaming or moving a page or changing an item's slug
never breaks one: `{ "page": "pg-k3x9" }` (a page by its id, the `"id"` in its file),
`{ "item": { "source": "people", "id": "p-k3x9" } }` (an item's page) or
`{ "href": "https://…" }` (a full URL, `mailto:`, `#anchor`). Block settings (a button's,
a heading's `link`), hero photos and the menus use them; the editor picks them from one list
(pages, items, the block's item fields, External URL). Redirects stay paths: they are for
URLs from outside.

A header item with `children` (one level deep) or `items` opens a dropdown on click; `all`
labels the link to the item's own page at its end. `items` names a source
(`content/en/sources/<id>.json`) and lists its items: with their photo and photo count when the
source has item pages (a `[slug].json` shows it), else by title and type, linking to their spot
on the item's page (`/projects/#<slug>`) or, with `linkOut`, to their own site. The menu button and clock labels are in `strings.json` (`nav`).
`src/site/templates/header.js` renders it; `checkContent` validates its shape.

### Pages and URLs

Every page is a folder in `content/en/pages/`, and the folders are the URLs. Each page file is a
document of `"kind": "page"` (see "Footer") with a stable `"id"` (`"pg-k3x9"`, given when the page is made): links point at it, so the folder can
move. A page's own file is
`index.json` in its folder; home's folder is `content/en/pages/` itself:

| file                                    | URL                                                            |
| --------------------------------------- | -------------------------------------------------------------- |
| `pages/index.json`                      | `/` (home)                                                     |
| `pages/404/index.json`                  | `404.html` (not in the sitemap)                                |
| `pages/people/index.json`               | `/people/`                                                     |
| `pages/people/whatever/index.json`      | `/people/whatever/`                                            |
| `pages/people/whatever/deep/index.json` | `/people/whatever/deep/` (any depth)                           |
| `pages/people/[slug].json`              | `/people/<slug>/` for **every item** of its source: a template |

- **Ids:** code names a page by its folder path: `home`, `people`, `people/whatever`,
  `people/[slug]` (`pageFile(id)` / `pageIdOf(file)` in `src/site/files.js`). Nothing else is a
  page file: `pages/about.json` or `pages/people/x.json` are ignored.
- **Templates:** `[slug].json` says which list it shows, `{ "template": { "source": "people" } }`,
  and nothing else: its pages are sections and blocks like any page (the album's back link
  names the folder's page, its heading's title).
  An item's slug is its `slug` field, else its name (or title) slugified (`Noor Vermeer` ->
  `noor-vermeer`). Items without one, with an invalid one or with a duplicate get no page and a
  build warning (`[routes] ...`). A template page is an album (the person/place look):
  `route.album` is the item, like before. A folder can have one `[slug].json`; there is none at
  the root.
- **Fixed beats template:** `pages/people/noor-vermeer/index.json` replaces the template's page for
  that item (it is a normal page then).
- **Views:** a page is its sections of blocks. Its view name (`view--<name>` on `<main>`, `data-page` on
  `<html>`, for styles and scripts) is its `view` field, else its own name for the built-in
  pages (`home`, `photography`, `people`, `places`, `projects`, `about`, `404`), else `page`.
  A template's is `album`. New pages start with a section holding a heading block.
- **Head:** title, description, share image and robots come from the page's `meta` and the
  site's defaults; see "SEO".
- Links to an item (menu dropdowns, grids, next) come from the routes, and a grid's "See all"
  goes to the page that shows its source (the folder of its `[slug]` page, else the first page
  with a block of it), so they follow a folder rename. A new page isn't in the menu by itself: add it in Content › Header (see "Menu").

`npm run build` prints every route with its file. `npm run check:links` (after a build) checks
that every internal `href` / `src` in `dist/` points at a file.

### Contact form

A **Contact form** block (Add block > Contact form; `src/site/blocks/form.js`): title,
intro, its fields, the button and the messages are content, edited in the Content panel. Each
field: label, placeholder, name (what the email calls it; `name`, `email` and `phone` get the
browser's autofill), type (text, email, phone, long text, choice), required, and a choice's
options (comma-separated). A form needs a field named `email` of type email: replies go
there. `checkContent` checks the fields.

**Where it sends** (Settings > Forms, `site.json` `forms`; a form can pick its own under
"Sends to"):

| target                        | how                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `function` (default)          | POST `/api/contact`: the Cloudflare Pages Function `functions/api/contact.js`, which emails it (Resend) |
| `endpoint` + `forms.endpoint` | POST to a form service's URL (Formspree and the like)                                                   |
| `email`                       | the visitor's mail app (`mailto:` the site `email`); also used when `endpoint` has no URL               |

The page works without JavaScript (a plain `<form method="post">`; the function answers with a
small page and a link back). With it (`src/client/modules/form.js`): messages under each field
(the block's "required" / "invalid" texts), the button disabled with a spinner while sending,
and the block's success or error message in a live region that gets the focus.

**The function** checks the email address and lengths, drops spam without telling (a hidden
`website` field people leave empty, and less than 3 s between showing the form and sending),
checks Cloudflare Turnstile when `TURNSTILE_SECRET_KEY` is set, then sends through Resend's
HTTP API. Nothing secret is in the site or the content: the keys and the recipient live in the
Cloudflare project's variables. Without them it answers 500 and logs which ones are missing.

**In `npm run dev`** the dev server answers `/api/contact` with the same function, but only
logs the message in the terminal (`[contact] would send: …`); add `?contact-fail` to the page's
URL to see the error message. Nothing is sent, no keys needed.

**Setup, once hosting is on Cloudflare Pages:**

1. Resend (resend.com): create an account, **Domains > Add domain** (e.g. `eeliyarasta.com`),
   add the DNS records it shows (in Cloudflare DNS) and wait for "Verified".
2. Resend **API Keys > Create API key**, permission "Sending access", that domain.
3. Cloudflare dashboard > Workers & Pages > the site's project > **Settings > Variables and
   Secrets**, for Production (and Preview if wanted):
   - `RESEND_API_KEY`: the key (type Secret)
   - `CONTACT_TO`: the address that receives messages (comma-separated for several)
   - `CONTACT_FROM`: e.g. `Website <contact@eeliyarasta.com>`, on the verified domain
4. Redeploy (variables apply to new deployments). Pages finds `functions/` in the repo by
   itself; the build output stays `dist`.
5. Send a test message from the live site. Problems show in the project's **Functions > Logs**
   (`[contact] …`).
6. Optional spam check: Cloudflare **Turnstile > Add widget** for the domain; its site key goes
   in Settings > Forms (public), its secret key in the variable `TURNSTILE_SECRET_KEY`.

Another host: pick "External endpoint" (e.g. a Formspree form's URL) or "Email link" in
Settings > Forms; `functions/` is then simply unused.

### Redirects

`content/en/settings/redirects.json` is a list of `{ "from": "/old/", "to": "/new/", "status": 302 }`
(`status` 301, moved for good, is the default and left out). `from` is a path, or a pattern for
item pages (`/old/:slug/` -> `/new/:slug/`); `to` is a page of the site or an `https://` URL.
The build writes them to `dist/_redirects` (Cloudflare Pages and Netlify read it: one
`from to status` line, plus the same without the trailing slash); the dev server ignores them.
It warns (`[redirects]`) about a redirect to no page, and leaves out one from a path that is a
page (it would hide it). `checkContent` checks the shape: `from` starts with `/`, no two from
the same path, `to` a path or URL, status 301 or 302. `npm run check:links` stays strict: links
in the site must point at pages, not at redirects.

The editor keeps them up to date by itself (`src/site/redirects.js`):

- **Rename a page** (Pages window): every path of its folder redirects to the new one, its
  item pages with one pattern (`/people/:slug/` -> `/models/:slug/`). Links by id need
  nothing; an `href` that is such a path is updated; the toast says how many.
- **Delete a page**: its paths redirect to its parent page (the default), another page, or
  nowhere ("No redirect": the 404 page; links to it stay and the toast counts them). Page links
  to it go to the page picked; item links to a deleted `[slug]` page's items stay (broken, the
  build warns).
- **Change an item's slug** (Source Explorer; or its name, when it has no slug): Save adds a
  redirect from its old page; links by its id need nothing.
- No chains: a redirect to a moved path follows it (A -> B, B renamed C: A -> C). A redirect to
  itself goes, and one from a path that is a page again (a new page, a rename back) is
  removed, with a note.

**Settings > Redirects** lists them: from, to (a page, or External URL), status; add, move,
remove, every change one undo step.

### SEO

What `<head>` says about a page: `src/site/seo.js` (`seoOf`), from the site's defaults and the
page's own `meta`. Edited in the editor: Settings > SEO (the defaults) and Content > SEO (the
page in the preview; collapsed, below its sections, with a search-result and a share-card
preview and the 60/160 character counts).

**Site defaults** (`content/en/settings/site.json`):

| key             | what                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `title`         | home's title, in full                                                                              |
| `titleTemplate` | every other page's title: `{page}` is its own title, `{site}` the site `name` (`{page} \| {site}`) |
| `description`   | the description of pages without their own                                                         |
| `ogImage`       | the share image of pages without their own (a media/ path or R2 key)                               |
| `url`           | the site's address: canonical links, `og:url`, `og:image`, `sitemap.xml`                           |
| `robots`        | `index` (default) or `noindex`: keeps the whole site out of search engines                         |
| `lang`          | `<html lang>` (default `en`)                                                                       |

**A page's own** (`"meta"` in its `index.json`), every key optional: `title` (else its first
heading's title, else its folder name), `description`, `image` (share image), `noindex: true`
(not in search, not in `sitemap.xml`), `canonical` (a path or URL, when the page copies
another; else its own URL).

**Item pages** (`[slug].json`), least magic: the title is `<item name> | <section>` in the
template; the description is the item's `body`, else the template's `meta.description`, else
the site's; the share image is the item's cover, else the template's `meta.image`, else the
site's. The template's `meta.noindex` hides every item page; an item with `"placeholder": true`
gets `noindex` too. 404 is always `noindex`.

**Output:** `<title>`, `description`, `canonical`, `og:title` / `description` / `url` / `type`,
`og:image` (absolute: the R2 address or the site URL + the local path, the 960px size, with its
`width` / `height` from the photo's sizes and `og:image:alt` from its alt text), `twitter:card`
(`summary_large_image` with an image, else `summary`), `robots` when noindex, and the JSON-LD on
home (a Person: `name`, `url`, `jobTitle`, `country`). `npm run build` prints `[seo]` warnings
for indexable pages without a description (and no site default), titles over ~60 characters and
descriptions over ~160. `checkContent` validates `meta` and the defaults.

Pages are never placeholders: About is a normal page, indexed unless its `meta.noindex` is set.
Only source items can be placeholders.

### Images

`scripts/images.mjs` (runs before `dev` and `build`) converts every file in `media/` into
480/960/1600 px WebP files in `public/media/` and writes `.generated/media.json` with sizes,
a tiny blurred placeholder (LQIP) and the image's most vivid colour. Templates use it for
`srcset`, `width/height` (no layout shift) and lazy loading. Unchanged images are skipped.
Photos load lazily, except the first ones at the top of a page (`firstPhotos(i)` in
`src/site/helpers.js`, by template position): the first hero photo, people/places card and
photography panel gets `loading="eager" fetchpriority="high"`, the next two `loading="eager"`.
Album pages load their first two slides eagerly, and About its photo.
If `sharp` is missing, originals are copied and the site still works. Both output folders are
generated, so they're git-ignored. Sizes, format and quality are in `scripts/image-variants.mjs`,
shared with photos uploaded to R2 (below).

**Alt text and credits belong to the photo**, not to the page using it: one entry per photo in
`content/en/settings/photos.json` (`alt`, `credit`, `focal`), keyed by its `media/` path or R2
key, edited in the editor's Media window. Everything else refers to a photo by its path only
(a source's `images` is a list of paths, `cover` and `image` are paths). Every `<img>` takes it from there (`altOf()` / `img()` in
`src/site/helpers.js`); thumbnails and repeats are `decorative` (`alt=""`). A photo without
alt text renders `alt=""` and the build warns.

### Photos on Cloudflare R2

The editor's **Media window** uploads photos (its Upload button, or drop files anywhere on it,
several at a time; JPEG, PNG, WebP, AVIF, GIF or TIFF, up to 60 MB). The dev server treats each like a photo in
`media/`: auto-rotated from EXIF, metadata stripped (no GPS or camera data), WebP at 480, 960
and 1600 px (never wider than the original). Each size goes to the R2 bucket as
`photos/<name>-<hash>-<width>.webp` (the hash of the original bytes: the same photo gets the
same keys, uploads nothing the second time, and is cached forever). The original is not kept:
the largest size is the fallback `src`, and the key the content stores (e.g.
`photos/noor-01-3f9a0c1b2d-1600.webp`). Each tile shows "Uploading N%" then "Resizing…".

Each upload adds an entry to **`content/en/settings/photos.json`**: size, the keys of its widths,
the blurred placeholder and the accent colour. The build renders `srcset`, `width/height` and
the placeholder from it, exactly like for `media/` photos, without downloading anything from R2.
Publish commits it with the content (Save never writes it: uploads, alt text and deletes in the
Media window write it right away). A key missing from it renders as a plain `<img>` and the
build warns. **Delete** in the Media window (only for photos nothing uses) removes every size
from R2 (`deletePhoto`, a SigV4 `DELETE` per key) and the entry.

The content stores keys, not URLs: `mediaUrl()` / `photoOf()` (`src/site/helpers.js`) turn a
value into URLs when the page is rendered. A path that is in `media/` stays local, a full
`https://` URL is used as is, anything else is `site.json` `mediaUrl` + `/` + key (Settings >
Photos). So the photo domain can change in one place, and existing photos keep working.

The keys live in `.env.local` (git-ignored; template: `.env.example`). Only the dev server reads
them (`loadEnv` in `scripts/vite-plugin-static-site.mjs`, R2_* only); nothing reaches the
browser or `dist/`. Uploads and deletes: `scripts/r2.mjs` (SigV4 via `aws4fetch`, tested
against a mock S3 by `npm test`). Without keys they say "R2 not configured: add keys to
.env.local".

Setup, once:

1. Cloudflare dashboard > **R2** > **Create bucket**, e.g. `eeliyarasta-photos` (location:
   automatic).
2. The bucket > **Settings** > **Public access** > **Custom Domains** > **Connect Domain**, e.g.
   `photos.eeliyarasta.com` (the domain's DNS must be on Cloudflare; it adds the record). Leave
   the r2.dev URL off: it is rate-limited and meant for testing.
3. **R2** overview > **Manage API tokens** > **Create API token**: permission **Object Read &
   Write**, **Apply to specific buckets only**: the bucket above. Copy the **Access Key ID** and
   **Secret Access Key** (shown once) and the **Account ID** (R2 overview).
4. Copy `.env.example` to `.env.local` and fill in `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`.
5. Restart `npm run dev`.
6. Editor > Settings > **Photos**: set the photo address to `https://photos.eeliyarasta.com`,
   Save.

No CORS rule is needed: the dev server uploads, and pages only show the photos.

### Album accent colours

Each person/place can set `"accent": "#hex"`. Without one, the accent is derived from the
cover's vivid colour (greyscale covers fall back to the site accent). When you open an album,
GSAP tweens the CSS variable `--accent`, which tints the glass UI and the background glow.

### Animations: one config, one engine

Markup only says **what** an element is: `data-anim="hero.title"`. All the **how** lives in
`content/en/settings/animations.json`:

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
      "drift": { "amplitudePx": 14 },
      "scroll": { "distanceVh": 55 },
    },
  },
  "targets": {
    "hero.title": { "preset": "hero-title" },
    "page.title": { "preset": "split-chars", "trigger": "load", "delay": 0.1 },
  },
  "interactions": { "...": "card cycle, album wheel/drag thresholds" },
  "transitions": { "...": "page curtain, accent tween, album slide, menu" },
}
```

**No defaults, no comments.** A value equal to its default is left out
(`src/site/defaults.js`): a section's `enabled: true`, `width: "contained"`, `height: "fit"`; a
block's `size: "auto"` and `config.enabled: true`; a hero photo's `layer: "back"`. Validation
reports a stored default, and the editor's save strips them. Keys starting with `_` (comments)
are refused anywhere in content: this README documents the shape. The animation library is the
exception: each animation carries every value it uses (there is no global layer below it).
Eases are GSAP's names (`power2.out`, `expo.out`, `none`, …) everywhere.

**Units in key names.** A number that isn't a GSAP property says its unit in its key:
`containedCols`, `speedPct`, `amplitudePx`, `rotationDeg`, `minDurationSec`, `distanceVh`,
`xPct`, `glideSec`, `intervalSec`, `wheelThresholdPx`, `wheelLockSec`, `dragThresholdPx`. GSAP's
own keys (`duration`, `delay`, `stagger` in seconds, `x`/`y` in px, `yPercent`, `scale`,
`autoAlpha`) keep GSAP's names and units.

The page scrolls natively (`src/client/scroll.js`); every ScrollTrigger reads the window's
scroll position.

The final spec for an element is
`preset ← target overrides ← its block's part overrides ← data-anim-options`. Part overrides
are a block's `motion.parts` (`{ "<target>": { … } }`), written by the visual editor. With
`"trigger": "scroll"`, reveals play once at `start`, or follow the scrollbar between `start` and
`end` when `"scrub"` is `true` or a number (seconds of smoothing).
Types (`src/client/anim/types.js`): `reveal`, `split` (SplitText chars/words/lines, masked),
`scroll` (from → to tied to the scrollbar between `start` and `end`, always scrubbed, linear by
default), `scrub-words`, `parallax`, `scatter` (hero photo burst + endless drift + scroll depth),
`hero-title`, `hover-preview`. New effect = new type function + preset. Entrance animations
(reveal/split, played once on load or when scrolled to) and scroll-linked ones (scroll,
scrub-words, parallax, or any reveal with `scrub`) are all just presets: the library has e.g.
`fade-up`, `lines-up`, `grid-reveal`, `list-up`, and for scroll motion `parallax-y` (y 80 → -80
while it crosses the screen), `fade-scrub` (fades in from `top 95%` to `top 55%`) and
`scale-scrub` (0.85 → 1).

**Block motion.** A block (Layout, above) picks its animation in its own content:

```json
{ "id": "b-2fq0", "type": "photo", "motion": { "anim": "parallax-y", "end": "bottom 20%" } }
```

`anim` is a preset id; every other key is a timing override (`TIMING_KEYS` in
`src/site/layout/motion.js`: duration, ease, delay, stagger, trigger, start, end, scrub). What
the animation does (type, from/to, split, …) only comes from the library. The block renders
`data-motion="parallax-y"` and `data-motion-options` (its timing), and the engine
(`src/client/anim/engine.js`) builds it as `preset ← motion`. It animates the block's
**content** (its children, or the preset's `children` selector, e.g. `[data-prow]` for
`list-up`), never the block element itself; scroll positions are measured on that content.
Only the types that work on any markup can go on a block (`BLOCK_ANIM_TYPES`: reveal, split,
scroll, scrub-words, parallax); `scatter`, `hero-title` and `hover-preview` stay on their
`data-anim` parts.

`data-anim` is still used for what is not a block (curtain, header, menu) and for the
**parts** of composite blocks (hero photos/title/meta, a heading's title and intro, about,
album, section heads). The old per-element hooks blocks replace (text, photo, form title,
intro, grids, album grids/panels, projects list) are gone: their targets were removed from
`animations.json`.

**Validation.** A block's `motion` must have that shape (`checkMotion`); an animation id that
isn't in the library (or a markup-only type) is a **Save error** in the editor and fails the
build (`motionProblems`). Saving `animations.json` checks every page, so removing an animation
that blocks still use is refused.

`prefers-reduced-motion` is respected everywhere: no block motion, drift/parallax/splits or
scroll scrubs (content is simply shown), instant album slides, a quick crossfade
between pages.

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
dropdown (grouped by folder; a `[slug]` template is one entry, `/people/[slug]`, with an item
picker next to it for which person to show), or click links in Browse mode.

**Pages window** (the sitemap button next to the page dropdown): the page folders, like the
Source Explorer. A folder shows its own page first (the row `/` at the root, `/people/` in
people), then a folder row per page in it (click to go in), then its `[slug]` page. Every
folder has **Add page** (title -> URL name: a new folder with its `index.json`) and **Add
[slug]** (a template with a source; one per folder, none at the root). Select a folder's own row
to show it in the preview, rename it (the whole folder moves) or delete it (asks first, listing
everything inside, and where its address should redirect). Both keep links and redirects up
to date (see "Redirects") and say so in a toast. Names are slugs (a-z, 0-9, dashes);
home and 404 can't be renamed or deleted. These write to disk right away through the dev server
(`POST /__editor/pages`), and the dropdown and preview follow without a reload. Renaming or
deleting a page with unsaved edits asks for Save first. Publish commits the new and removed
files. `&pages=/people/` in the URL reopens it on that folder. There's also a phone (390 px) preview toggle.

In the Content panel every **section** of the page is a box (Section 1, 2, …, with its name
under it when it has one): ↑ / ↓ move it, **Duplicate** copies it below (new ids), **Delete** asks first, the switch
turns it on/off, and the caret folds it. Under the bar are its settings (**Name**, the whole row, empty by
default, with the `#anchor` it makes shown under it, or what's wrong with it: taken by another
section on the page, …; then side by side **Height**, five quiet icon buttons with tooltips: custom
(a **Rows** number field appears below: the section's rows, the ones below its last block
empty space; picking it starts from the section's rows), fit
content, 1/3, 1/2 or the full screen, each icon the screen with that share filled (the content
is always centred), and **Width**, two such buttons: contained (a centred band in the screen)
or full width (a band edge to edge)) and its **blocks**, in order, each with ↑ / ↓, Duplicate,
Delete and on/off; **Add block** adds one below the others, **Add section** at the end a
section (empty, or with a block). Clicking a block (or a text of it in the preview) opens the
**block inspector**: **Content** (its settings and fields, from the registry), **Layout**
(see below) and **Motion** (the block's animation and timing, the same view as in the Motion
tab). Its head row is the quiet ← (back to the sections) and the block's name. A list field (hero photos, about
paragraphs and facts, photography panels) has its items in boxes with ↑ / ↓ / Remove and an
**Add** button (a new photo opens the Media window). Each of these is one undo step. Typing in
a field (a number in Layout too) is one undo step until you leave it, press Enter or pause for a
second. A field's **Source** switch binds it to an item (see "Bindings").

While the **Content** tab is open the preview is a layout canvas (always; there is no toggle):
a **click** picks a block (its inspector opens; a click on another block switches to it), a
**click on empty space** (no block, handle, circle or link line) or **Esc** drops the
selection (the panel shows the sections again), **dragging** moves it and the **handles** on
its edges and corners resize it, snapping to the section's columns and its real rows; Esc
cancels, and a drag is one undo step. A drag starts from where the block is shown and also
stores where the section's other blocks are now (their real rows, see Layout), so what you see
is what is stored. An aspect or auto block's rows follow its width: only its sides resize. A
**double click** on a text edits it in place (until you click elsewhere, press Esc or Enter in
a one-line text); a double click on a photo or a bound value opens its field in the panel.
Links, buttons and forms in the preview don't act on clicks (Alt+click follows a link).
**Links:** the selected and the hovered block show a small circle above their top edge and one
below their bottom edge. Drag a block's **top circle onto another block's bottom circle** (the
blocks it may follow show theirs while you drag: its section's, none that would make a loop)
to link it: it follows that block from then on, staying where it is (the gap is the rows
between them now, negative when they overlap). Drop the circle anywhere else to unlink it (it
stays on the row it shows). A
line joins each leader's bottom to its followers' tops (with the gap next to the selected
block's); click a line to select that link and press **Delete** (or Backspace) to remove it.
Dragging a linked block up or down keeps the link and changes its gap (its label shows it), and
the blocks that follow it move along live. A filled top circle marks a block that follows one.
**The grid** shows by itself, only while a block is selected (or dragged or resized), and only
for that block's section: its square cells as faint white lines (6%, every 5th 12%; the accent
is for the selection, the circles and the link lines). Nothing selected: no grid. The canvas lives in the preview's own layer (`src/editor/overlay.js`,
a Shadow DOM). In the **phone preview** a drag edits the block's phone area on the 60-column
grid, snapping to its cells, and links are the phone's: a block without a phone area starts
from its desktop area halved, and its first phone drag or link gives it its own (its desktop
link comes along, the gap halved). The Motion tab picks animated elements instead (no
dragging); Browse uses the site normally.

The **Layout** tab (`LayoutTab.svelte`) holds only what can't be dragged, for the layout the
preview shows (switch it with the phone toggle in the panel's head). At the top, read only,
where it is in cells (`col 61 · row 12 · 40 × 18`: its column, the row it shows, its width and
the rows it spans, the phone's in the phone preview) and its link (`follows <block>, gap -10`,
or free); links and gaps are dragged in the preview. Then **Size** as buttons (Auto | Aspect |
Rows; with Aspect its ratio as buttons: 1:1 … 21:9 or Custom "w:h"), for text blocks **Scale
text with the grid** and its **Text size (%)**,
the layer with Down / Up (desktop) and **Reset phone** (phone), which removes every phone area
and link of the section's blocks (they show their desktop layout halved again).
**Settings › Typography** sets the text styles of scaled text (size and minimum, line height,
tracking; the preview follows as you type).

**Buttons:** action buttons (Save, Publish, Delete, Add, …) are pills. Utility toggles and tools
(phone view, undo / redo, back, close, and Sources / Pages / Media beside the page
menu, each with its tooltip) are the quiet icon-only variant of
`Button.svelte` (`iconOnly`): no pill, a little dim, brighter on hover (nothing moves), the
accent (`--ed-accent`, #33ccff) while a toggle is on (`aria-pressed`), the focus ring kept.

The preview follows the section and block settings, places and on/off right away (classes
and CSS variables, `src/editor/layout-sync.js`). After a structure edit (a block or section
added, copied, moved or deleted, a setting that changes what a block shows) the dev server
renders just the sections it touched from the editor's copy of the page (`POST
/__editor/render`) and the preview swaps them in and mounts the page again, without a reload.
Other pages render from the unsaved edits too: the editor sends them to the dev server (`POST
/__editor/draft`, cleared on Save), which renders dev pages from them.

**Content › Header** (a site part: the page picker's **Site** group, or click the header in the
preview) edits `nav.json` and the header's labels (`strings.json` `nav`: the menu and close
buttons, the clock). The menu with its items: label,
link (a page from the page tree, or External URL with its URL), ↑ / ↓ / Remove, **Add link**,
and a dropdown: the items of a source, or **Dropdown links** (one level) and the
"all" link's label. The preview renders the menu again on each change; undo works as anywhere. On a `[slug]` page the **Item** dropdown next
to the page picks which item's page the preview shows.

The **Sources** button (the database icon next to the page dropdown, before Pages and Media) opens the Source Explorer on the files in `content/en/sources/` (with their
item counts): click one to edit its items, **←** goes back to the files. A grid's Source edit
button, or a click on a person/place/project in the preview, opens straight into that item. In
the Content tab, a group whose texts come from a source (a person on their page) shows its file
(`people.json`) as a button in its bar (beside each field only when a group mixes sources): it
opens the explorer on that item (with a field highlighted: `&field=` in the URL). What the
explorer shows comes from the source's schema (see "Sources & schemas").

Fields come in rows: two `half` fields (a schema's or a block type's `width: "half"`) share
one, a lone half takes the row, and a panel under ~340px shows one column. The bar of the
section you are scrolling through stays on top of the panel. The footer sums up what's left in
one line (`Unsaved changes`, `2 changes to publish`, `All published`); its tooltip has the
details (files, commits not pushed, the last save).

**Photo fields** show the photo (64 px), its file name and sizes (`1600×2000 · 3 sizes · R2`,
`1280×1600 · local`); no text input. The thumbnail or **Change** opens the **Media window**
(also the images button in the toolbar): every photo, R2 and local, filtered All / R2 / Local,
with Upload (see [Photos on Cloudflare R2](#photos-on-cloudflare-r2)). The selected photo shows
its sizes, where the content uses it (click to go there) and its alt text. Opened from a field,
**Use this photo** puts it in the field (one undo step). **Delete** is offered only for photos
nothing uses: an R2 photo loses all its sizes, a local one its file in `media/` (Publish only
commits `content/`, so commit that removal yourself). `&media=<key>` (and `&pick=<field>`)
in the URL reopens it.

**Refresh** keeps your place. The URL holds the page, the tab, Menu/Footer and the open Source
Explorer item, so a shared link opens the same view:
`/edit/?path=/people/&tab=content&source=people&item=noor-vermeer` (`tab`: browse, content,
motion, settings; `view`: menu, footer; `motion=animations`: the Motion tab's Animations sub-tab; `anim`: the animation open there). Open/closed sections, the selected field or Motion
element and the scroll positions are kept per browser tab in sessionStorage. See
`src/editor/svelte/persist.js`.

| mode        | what it does                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browse**  | Use the site normally. Shows unsaved changes per file, plus _Discard all_.                                                                                                                                                                                                                                                                                                                                                                    |
| **Content** | Animations pause. The preview is a layout canvas: click a block to open it, drag it and its handles to move and resize it, double-click a text to type in it (Enter ends a single-line field; multi-line fields take Enter as a line break). The panel lists the same fields as inputs, and both stay in sync.                                                                                                                                |
| **Motion**  | Click a block or an animated element (or pick one from the Elements list). Pick its animation and set its own timing (duration, ease, delay, stagger, trigger, scroll start/end/scrub); what the animation does (from/to properties, type-specific values) is shown read-only and edited in the Animations sub-tab. Changes replay live. **Replay** runs that block (or the page) again, and the **Scroll** slider moves the page through it. |

In the edit modes, clicks select instead of following links (in Content no link, button or
form acts). Hold **Alt** to click through.

In the editor a preset is called an **animation** (`presets` in `animations.json`). The
Motion tab's **Elements** list is the page's **blocks**, grouped by section (each with its
animation or "none", and the `data-anim` parts inside it nested below), then **Outside the
blocks** (curtain, header…). Selecting a block in the preview selects it in the list
and the other way round; a block selected in the Content tab is the one shown when you switch
to Motion. A **block** shows its Animation (none or any block animation; the edit button opens
it in the library), its timing (Custom switches, stored in the block's `motion`) and **Use the
animation's timing** (drops all its overrides); **Replay** plays just that block. A **part**
or global element is edited as before; choose where its edits go:

- **This block**: the block's `motion.parts["<target>"]` in the page file, e.g.
  `"motion": { "parts": { "hero.title": { "preset": "stagger-up" } } }`. Only the parts with
  that `data-anim` name inside this block. This is how you give a block's part a different
  animation without touching templates (`preset`, plus timing only). A block with only parts
  has no `anim`. Parts outside the blocks (header) only have **All**.
- **All "target"**: `targets["about.headline"]`. Every element with that `data-anim`.

Timing fields (`TIMING_KEYS` in `src/editor/svelte/motion.js`) each have a **Custom**
switch. Off (a faint "inherit" before it): the field's control shows the inherited value,
dimmed and inert (no clicks, no focus); nothing is stored. On: the inherited value is copied
to the chosen scope as a start and can be edited; switching off removes it (one undo step). Everything else
the animation does is read-only here.

The Motion tab has two sub-tabs: **Elements** (the curtain, the page's animated elements and
the picked element) and **Animations**, the library, inline in the panel so the preview stays
in view while you edit (the edit button next to an element's Animation opens it there; picking
an element in the preview goes back to Elements). It is the only place that defines what an animation
does: pick an animation to edit `presets["fade-up"]`, every value including timing, and add
or remove from/to properties. There is no global default layer: each animation carries every
value it uses, so what you see in the library is what it does. Edits play in the preview at
once; **Replay** runs them again. Seconds are in the labels: `Duration (s) / ease`,
`Delay (s)`, like the curtain's rows. The list shows how many blocks and elements on this page use each animation and which `data-anim` names
use it on the site.

Older non-timing overrides on an element or `data-anim` name (e.g. a parallax `speedPct` in
`targets`) are listed in a notice in the element view: **Move to animation** copies them into
the animation (which changes it for every element using it), **Drop** removes them.

Shortcuts: **Ctrl/⌘+E** toggles edit mode, **Ctrl/⌘+S** saves, **Ctrl/⌘+Z** / **Shift+Ctrl/⌘+Z**
undo/redo, **Esc** deselects (a dialog first, then the selected link, then the block).

**How text maps to JSON.** Templates mark text with the `ed()` helper, e.g.
`<h2${ed('pages/about/index.json', ['sections', 0, 'blocks', 0, 'headline'])}>` (in a block type:
`b.ed('headline')`), which renders `data-edit="pages/about/index.json#/sections/0/blocks/0/headline"` (a
JSON Pointer). Use `ed(file, path, 'block')`
for multi-line text (`\n` ⇄ `<br>`), `'number'` for numbers and `'words'` for text rendered one
`<span>` per word (the hero name: edited as plain text, re-split into words and re-animated after the edit). Page copy (titles, intros) lives
in each page's `pages/<page>/index.json`, shared copy (nav) in `settings/site.json`, for this reason. The editor only ever writes
existing JSON files in `content/en/pages/`, `content/en/sources/` and `content/en/settings/` (see
`src/editor/config.js`); only the Pages window creates or deletes files, and only page files.
These editor markers (`data-edit`, `data-edit-type`, `data-sec`, `data-block`,
`data-curtain-edit`) are only rendered by the dev server; `npm run build` leaves them out
(`renderRoute(route, content, { editable })`), which makes the built HTML about 9% smaller.

**Save and Publish**

- **Content checks** (`src/site/validate.js`): broken JSON in a content file stops the build and
  the dev server with the file, line and column (the editor shows the same error). Save checks
  the shape of every file first (pages are objects, a `[slug]` page names its source, sources
  are lists of objects, `site.json` has `name` and `url`, `animations.json` has `presets`,
  `targets` and `transitions`) and writes nothing when one is wrong; files are written to a
  temporary file and renamed, so a crash never leaves half a file.
- **Save** (**Ctrl/⌘+S**) writes the changed files to `content/en/` on disk. That's a **draft**:
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

The endpoints live in `scripts/editor-server.mjs` (`/__editor/content`, `/save`, `/draft`,
`/render`, `/status`, `/upload`, `/media`, `/pages`, `/publish`). They exist only on the dev server, accept **only requests from this machine**
(loopback address, localhost `Host`, same-origin `Origin`), and only touch the files listed in
`src/editor/config.js`. Git runs without a shell and never prompts in the terminal, so pushing
needs a working git login for GitHub on the machine running `npm run dev` (e.g. `gh auth login`
then `gh auth setup-git`).

All JSON is written by the same formatter (`src/editor/lib/json-format.js`), so saves only
change the lines that changed.

**Later:** adding, removing and reordering album photos isn't in the editor yet (replacing one is:
Change in its field, see the Media window above). Edit
`content/en/sources/*.json` by hand for that.

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

**Cloudflare Pages** (likely): connect the repo, Build command `npm run build`, Output directory
`dist`. It reads `dist/_redirects` and runs `functions/` (the contact form: set its variables,
see "Contact form").

**Vercel**: import the repo, Framework preset **Other**, Build command `npm run build`,
Output directory `dist`. Unknown URLs get `404.html` automatically. Pushes from the
editor's Publish button trigger a normal redeploy. (Netlify, Cloudflare Pages
and GitHub Pages work the same way.)
