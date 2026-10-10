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
```

Visual editor (dev only): `http://localhost:5173/edit/` while `npm run dev` runs (see [Visual editor](#visual-editor-edit-dev-only)).

Requires Node 20.19+ (Vite 8).

### Linting

- **ESLint** (`eslint.config.js`): JS recommended + Svelte recommended (Svelte 5, a11y checks),
  browser globals in `src/`, Node globals in `scripts/` and configs. `console.log` warns in `src/`
  (`console.warn`/`error` are fine), anything goes in `scripts/`.
- **Stylelint** (`stylelint.config.mjs`): standard SCSS rules, relaxed (blank lines, alpha notation
  and vendor prefixes are free), BEM class names (`block__elem--mod`), Svelte `<style>` blocks too.
- **Editor-only rules** (`scripts/stylelint-4px.mjs`, for `src/editor/**`):
  `local/grid-4px`: padding, margin, gap, sizes, radius, offsets, inset and translate in multiples
  of 4px (0, 1px and 999px pills are fine; font sizes, line heights, borders and %/em/vw are not
  checked). `local/no-alpha-text-color`: no transparent text colors (`rgb(… / .5)`, `#rrggbbaa`);
  it can't see `opacity` on text or colors behind variables.
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
  pages/            ← one folder per page (its URL) with index.json in it (see "Pages and URLs")
  sources/          ← lists that grids pull from (people, places, projects): top level is an array,
                      plus <id>.schema.json: the fields of its items (see "Sources & schemas")
  settings/         ← site-wide settings (site.json, animations.json)
media/              ← source photos (jpg), committed
scripts/
  images.mjs        ← media/ → public/media/*.webp sizes + .generated/media.json
  content.mjs       ← loads content/<folder>/*.json + media manifest (Node)
  vite-plugin-static-site.mjs  ← the "static site builder" (dev render + build prerender)
  editor-server.mjs ← dev-only editor endpoints: load / save / status / publish / pages (localhost only)
  check-links.mjs   ← npm run check:links: every internal link in dist/ points at a file
src/
  site/             ← isomorphic templates (no Node APIs, run at build time AND in a browser)
    routes.js       ← list of pages, from the files in content/pages/
    render.js       ← renderRoute(route, content) → { head, body }
    helpers.js      ← html``, esc(), img() with srcset/LQIP, accent colours
    layout/         ← sections and blocks on the 24-column grid, ids (see "Layout")
    blocks/         ← the block registry: every block type (see "Layout")
    templates/      ← layout, header/menu, footer, partials
  client/           ← browser code
    main.js         ← boot: menu, router, per-page mount
    router.js       ← SPA navigation over the prerendered HTML
    anim/engine.js  ← reads content/settings/animations.json, wires every [data-anim]
    anim/types.js   ← animation types (reveal, split, parallax, scatter, …)
    modules/        ← album slider, project accordion, card hover, misc
    ui/             ← menu (click-only), clock
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
name; its text and an optional per-page `transition` live in the page's file `pages/<page>/index.json`,
or in the album's item in `sources/`), swaps `<main data-router-view>`, updates
title/meta/history, scrolls to top and re-mounts animations and page modules. Each page's tweens, ScrollTriggers, SplitTexts and listeners live
in one `gsap.context` and are reverted on leave. If anything fails it falls back to a normal
page load.

### Content

Content is split by kind, so a file name never means two things (a page called `site` and the
site settings can live side by side):

| file                               | what                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/settings/nav.json`        | the **menus**: header (nav pill, dropdowns, mobile menu) and footer links (see "Menu")                                                                                                                                                                                                                                                                                                       |
| `content/settings/site.json`       | name, the **SEO defaults** (`title`, `titleTemplate`, `description`, `ogImage`, `url`, `robots`, `lang`; see "SEO"), `forms` (where contact forms send, see "Contact form"), socials, email, the menu button and clock labels (`nav.menu`, `nav.close`, `nav.clock`), footer copy (`footer.note`, `footer.toTop`), `timezone` of the clock, `jobTitle` / `country` (structured data on home) |
| `content/settings/animations.json` | **every animation** (see below)                                                                                                                                                                                                                                                                                                                                                              |
| `content/pages/index.json`         | home: its `sections` of blocks (the hero first: the big name, its text and the **scattered hero photos**, position `x/y/w` in %, mobile `mx/my/mw`, `depth`, `layer` back/front), curtain text                                                                                                                                                                                               |
| `content/pages/<page>/index.json`  | the other pages: their `sections` of blocks (see "Layout"), curtain text, `meta`: its title, description, share image, `noindex`, canonical (see "SEO")                                                                                                                                                                                                                                      |
| `content/sources/people.json`      | models: `slug`, `name`, role, location, `accent`, `cover`, `images[]` (with credits)                                                                                                                                                                                                                                                                                                         |
| `content/sources/places.json`      | places, same shape                                                                                                                                                                                                                                                                                                                                                                           |
| `content/sources/projects.json`    | projects: title, kind, year, description, url, image; `linkOut: true` makes the menus link straight to its `url`                                                                                                                                                                                                                                                                             |
| `content/settings/redirects.json`  | **redirects** from old addresses: `[{ "from", "to", "status"? }]` (see "Redirects")                                                                                                                                                                                                                                                                                                          |
| `content/settings/photos.json`     | every photo's **alt text** (`{ "people/noor-vermeer/01.jpg": { "alt": "…" } }`, media/ paths and R2 keys alike) and the sizes of photos uploaded to R2; written by the editor's Media window and uploads                                                                                                                                                                                     |

| `content/pages/people/[slug].json` | the people pages: `config.source` and the labels they share (`section`, `next`); see "Pages and URLs" |

Add a person: drop photos into `media/people/<slug>/`, add an entry to `sources/people.json`, done.

Routes, menu, dropdowns, grids and sitemap update automatically.

### Sources & schemas

Each list in `content/sources/` can have a schema next to it, `<id>.schema.json`
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
  (a list of `{ "src", "credit"? }`), `link` (`https://…`, `/path/` or `mailto:`), `choice`
  (one of `options: ["a", "b"]`), `boolean`, `date` (`YYYY-MM-DD`).
- `width: "half"`: two half fields next to each other share a row in the editor (one column
  when the panel is narrow); `required`, `help` (a hint under the field), `list` (shown under
  the name in the Source Explorer's item list).
- Keys a schema doesn't name are kept as they are, not edited or checked (`imageCredit`,
  `transition`).

**Checks.** Save and `npm run build` check every source against its schema: required values,
types, choice options, links, dates, valid unique slugs, and photos that exist (in `media/` or
`content/settings/photos.json`). Save writes nothing and shows the problems
(`content/sources/people.json: item 1: "Name" is required`); the build stops with the list.

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
> recorded per image in the JSON and shown as a credit in the album view. Replace them with
> real shoots. The email `hello@eeliyarasta.com` is a placeholder too.
> Pages of items with `"placeholder": true` get `noindex` and are left out of `sitemap.xml`;
> remove the flag (or set it to `false`) when the item is real.

### Layout

Every page is an ordered list of **sections**, `sections` in its file (a `[slug].json` too), and
every section is a grid of **blocks** (`src/site/layout/`):

```json
{
  "id": "s-k3x9",
  "height": "auto",
  "rows": 12,
  "width": "contained",
  "spacing": { "top": 10, "bottom": 12 },
  "enabled": true,
  "blocks": [
    {
      "id": "b-7qpa",
      "type": "heading",
      "crumb": "Photography / People",
      "title": "People",
      "config": { "count": "people", "numbered": true },
      "pos": { "col": 1, "span": 24, "row": 1, "rows": 12 }
    },
    {
      "id": "b-2fq0",
      "type": "photo",
      "src": "people/noor/01.jpg",
      "pos": { "col": 13, "span": 12, "row": 4, "rows": 20 },
      "z": 1
    }
  ]
}
```

- **The grid:** 24 columns (with the page's gutter, `--gap`) and rows of `--grid-row`, **8px**,
  one CSS variable in `src/client/styles/_tokens.scss`. A row is at least that tall and grows
  when its content needs more (`minmax(var(--grid-row), auto)`), so text never spills out.
- **A section:** `height` is `auto` (its `rows`, growing with content) or `screen` (at least the
  screen's height, its content placed by `align`: `top`, `center` (default), `bottom` or
  `stretch`, filling it); `width` is `contained` (inside the page's side margins, `--pad`) or
  `full` (edge to edge); `spacing` is the empty rows above and below it; `enabled: false`
  hides it. A section's rows grow to fit its lowest block.
- **A block:** its `type` and content (below), `pos` (first column 1–24, columns, first row,
  rows; without one it is full width in row 1), `z` (its layer when blocks overlap) and an
  optional `mobile` area. **Below 760px** a section's blocks stack full width in their order;
  a block with a `mobile` area keeps the grid there (`.sec--mgrid`).
- **Ids:** every section and block has a stable id (`s-…`, `b-…`), given once when it is made
  (`src/site/layout/ids.js`) and kept when it moves or changes. The editor finds them in the
  preview by it (`data-sec`, `data-block`, dev only).
- **CSS:** positions are CSS variables on the elements (`--rows --pt --pb` on a section,
  `--c --s --r --rs --z` and `--mc --ms --mr --mrs` on a block), laid out by
  `src/client/styles/_layout.scss`. Blocks carry no outer spacing of their own: that is the
  section's.
- **Validation:** Save and the build check the layout (ids, enums, whole numbers, a block
  ending by column 24, no id twice on a page) and each block against its type (strings, lists,
  config values). An unknown block type isn't an error: it logs a build warning and is skipped.
- **Later (bindings, phase 2):** block fields are plain values now; a field will be able to
  hold a binding to a source item's field instead, without changing the shape above.

**Blocks.** The block types live in **one registry**, `src/site/blocks/` (`index.js` explains the
shape): the build renders with it, and the editor reads it for each block's fields and settings
and for **Add block**. A type is `{ type, label, icon, fields, config, defaults, render(block,
ctx, b) }`; `item` binds it to a `[slug]` page's item. A block's content sits next to its type,
how it works under `config` (`enabled`: on/off; the source, look, …):

| type       | what                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `heading`  | page heading: `crumb`, `title`, `intro`, `cta`; config `count` (a source's item count), `href`, `center`, `numbered` |
| `text`     | paragraphs (a blank line starts one) under an optional `title`                                                       |
| `photo`    | one photo (`src`) with an optional `caption`                                                                         |
| `button`   | a button: `label`; config `href` (a path or a full URL)                                                              |
| `form`     | a contact form (see "Contact form")                                                                                  |
| `hero`     | the home hero: `title` (one word per line), `eyebrow`, `subline`, scattered `photos`                                 |
| `intro`    | a statement (`text`)                                                                                                 |
| `grid`     | a head + tiles of a source; config `source`, `layout` (`staggered` / `even`); `places` shows cards                   |
| `albums`   | album cards of a source (the people/places index); config `source`, `layout` (`portrait` / `landscape`)              |
| `panels`   | big links to sources: `panels` `[{ source, title, unit }]` (photography)                                             |
| `projects` | the project accordion of a source; with a `title` it gets a head (home)                                              |
| `about`    | the about block: `image`, `crumb`, `headline`, `paragraphs`, `facts`, `emailLabel`                                   |
| `album`    | **item**: the item's album (slider, grid, info), only on a `[slug]` page                                             |

- **Numbering:** nothing is numbered by itself. A heading with config `numbered` starts its crumb
  with its number among the page's numbered headings that are on: (01), (02), …
- **Item pages:** a `[slug].json`'s blocks render once per item. A type marked `item` (the
  `album` block) reads the page's item, `ctx.route.album`. Other types render the same on every
  item page. Item types are only offered on `[slug]` pages.
- **Animations:** blocks keep their `data-anim` targets (`content/settings/animations.json`),
  so a new block animates like the others of its type.
- **A new type:** add it to a file in `src/site/blocks/` and to `BLOCK_TYPES` in `index.js`
  (and its styles); the editor shows it with no editor code.
- **Migration:** `scripts/migrate-layout.mjs` turned the old list of typed sections into this
  shape once (each old section became a section with it as one full-width block, its old
  padding the section's spacing); kept for reference, it changes nothing on migrated content.

### Menu

`content/settings/nav.json` holds the menus: `header` (the nav pill, its dropdowns and the
mobile menu) and `footer` (the footer's Index column). An item links to a page by its URL
(`page`, checked: a page that doesn't exist gives a `[nav]` build warning, and
`npm run check:links` fails on it) or anywhere else (`href`, opens in a new tab):

```json
{ "label": "About", "page": "/about/" }
{ "label": "Shop", "href": "https://shop.example.com" }
{ "label": "Photography", "page": "/photography/", "all": "All photography",
  "children": [{ "label": "People", "page": "/people/", "items": "people" }, …] }
{ "label": "Projects", "page": "/projects/", "all": "All projects", "items": "projects" }
```

A header item with `children` (one level deep) or `items` opens a dropdown on click; `all`
labels the link to the item's own page at its end. `items` names a source
(`content/sources/<id>.json`) and lists its items: with their photo and photo count when the
source has item pages (a `[slug].json` shows it), else by title and kind, linking to their spot
on the item's page (`/projects/#<slug>`) or, with `linkOut`, to their own site. Footer items are
plain links. The menu button and clock labels stay in `site.json` (`nav`).
`src/site/templates/header.js` renders it; `checkContent` validates its shape.

### Pages and URLs

Every page is a folder in `content/pages/`, and the folders are the URLs. A page's own file is
`index.json` in its folder; home's folder is `content/pages/` itself:

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
- **Templates:** `[slug].json` says which list it shows, `{ "config": { "source": "people" } }`,
  plus the labels its pages share (`"section": "People"`, the back link; `"next": "Next person"`).
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
  A template's is `album` (no footer). New pages start with a section holding a heading block.
- **Head:** title, description, share image and robots come from the page's `meta` and the
  site's defaults; see "SEO".
- Links to an item (menu dropdowns, grids, next) come from the routes, and a grid's "See all"
  goes to the page that shows its source (the folder of its `[slug]` page, else the first page
  with a block of it), so they follow a folder rename. A new page isn't in the menu by itself: add it in Settings > Menu (see "Menu").

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

`content/settings/redirects.json` is a list of `{ "from": "/old/", "to": "/new/", "status": 302 }`
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
  item pages with one pattern (`/people/:slug/` -> `/models/:slug/`). Links in all content to
  those paths (menus, buttons, hero photo links, any string that is such a path) are updated
  too; the toast says how many.
- **Delete a page**: its paths redirect to its parent page (the default), another page, or
  nowhere ("No redirect": the 404 page; links to it stay and the toast counts them). Links go
  to the page picked.
- **Change an item's slug** (Source Explorer; or its name, when it has no slug): Save adds a
  redirect from its old page and updates links to it, one undo step.
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

**Site defaults** (`content/settings/site.json`):

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
template; the description is the item's `summary`, else the template's `meta.description`, else
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

**Alt text belongs to the photo**, not to the page using it: one entry per photo in
`content/settings/photos.json` (`alt`), keyed by its `media/` path or R2 key, edited in the
editor's Media window. Every `<img>` takes it from there (`altOf()` / `img()` in
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

Each upload adds an entry to **`content/settings/photos.json`**: size, the keys of its widths,
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
}
```

The page scrolls natively (`src/client/scroll.js`); every ScrollTrigger reads the window's
scroll position.

The final spec for an element is
`preset ← target overrides ← element overrides ← data-anim-options`. Element overrides
(`elements`, keyed `"<page path>|<target>|<n>"`) are mostly written by the visual editor. With
`"trigger": "scroll"`, reveals play once at `start`, or follow the scrollbar between `start` and
`end` when `"scrub"` is `true` or a number (seconds of smoothing).
Types (`src/client/anim/types.js`): `reveal`, `split` (SplitText chars/words/lines, masked),
`scrub-words`, `parallax`, `scatter` (hero photo burst + endless drift + scroll depth), `hero-title`, `hover-preview`. New effect = new type function + preset.

`prefers-reduced-motion` is respected everywhere: no drift/parallax/splits,
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
files. `&pages=/people/` in the URL reopens it on that folder. There's also a mobile (390 px) preview toggle.

In the Content panel every **section** of the page is a box (Section 1, 2, … named by its first
text): ↑ / ↓ move it, **Duplicate** copies it below (new ids), **Delete** asks first, the switch
turns it on/off, and the caret folds it. Under the bar are its settings (Height: Rows with its
row count, or Fullscreen with where its content sits; Width; Space above and below, in rows)
and its **blocks**, in order (the order they stack in on phones), each with ↑ / ↓, Duplicate,
Delete and on/off; **Add block** adds one below the others, **Add section** at the end a
section (empty, or with a block). Clicking a block (or a text of it in the preview) opens the
**block inspector**: **Content** (its settings and fields, from the registry), **Layout**
(column, columns, row, rows; its layer with Down / Up) and **Motion** (its animated elements;
one opens in the Motion tab). **Sections** goes back. A list field (hero photos, about
paragraphs and facts, photography panels) has its items in boxes with ↑ / ↓ / Remove and an
**Add** button (a new photo opens the Media window). Each of these is one undo step.

**Arrange** (beside Sources) turns the preview into a layout canvas: a click picks a block
(the inspector opens on Layout), dragging moves it and the handles on its edges and corners
resize it, snapping to the section's columns and rows; the area shows while dragging, Esc
cancels, and a drag is one undo step. **Grid** shows every section's columns and rows. Both
live in the preview's own layer (`src/editor/overlay.js`, a Shadow DOM). The mobile preview
stacks blocks, so there is nothing to drag there.

The preview follows the section and block settings, places and on/off right away (classes
and CSS variables, `src/editor/layout-sync.js`). After a structure edit (a block or section
added, copied, moved or deleted, a setting that changes what a block shows) the dev server
renders just the sections it touched from the editor's copy of the page (`POST
/__editor/render`) and the preview swaps them in and mounts the page again, without a reload.
Other pages render from the unsaved edits too: the editor sends them to the dev server (`POST
/__editor/draft`, cleared on Save), which renders dev pages from them.

**Settings > Menu** edits `nav.json`: a box per menu (Header, Footer) with its items: label,
link (a page from the page tree, or External URL with its URL), ↑ / ↓ / Remove, **Add link**,
and in the header a dropdown: the items of a source, or **Dropdown links** (one level) and the
"all" link's label. The preview renders the menu again on each change; undo works as anywhere. On a `[slug]` page the **Item** dropdown next
to the page picks which item's page the preview shows.

The **Sources** button opens the Source Explorer on the files in `content/sources/` (with their
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
`Delay (s)`, like the curtain's rows. The list shows how many elements on this page use each animation and which `data-anim` names
use it on the site.

Older non-timing overrides on an element or `data-anim` name (e.g. a parallax `speed` in
`targets`) are listed in a notice in the element view: **Move to animation** copies them into
the animation (which changes it for every element using it), **Drop** removes them.

Shortcuts: **Ctrl/⌘+E** toggles edit mode, **Ctrl/⌘+S** saves, **Ctrl/⌘+Z** / **Shift+Ctrl/⌘+Z**
undo/redo, **Esc** deselects.

**How text maps to JSON.** Templates mark text with the `ed()` helper, e.g.
`<h2${ed('pages/about/index.json', ['sections', 0, 'blocks', 0, 'headline'])}>` (in a block type:
`b.ed('headline')`), which renders `data-edit="pages/about/index.json#/sections/0/blocks/0/headline"` (a
JSON Pointer). Use `ed(file, path, 'block')`
for multi-line text (`\n` ⇄ `<br>`), `'number'` for numbers and `'words'` for text rendered one
`<span>` per word (the hero name: edited as plain text, re-split into words and re-animated after the edit). Page copy (titles, intros) lives
in each page's `pages/<page>/index.json`, shared copy (nav, footer) in `settings/site.json`, for this reason. The editor only ever writes
existing JSON files in `content/pages/`, `content/sources/` and `content/settings/` (see
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
`/upload`, `/media`, `/pages`, `/publish`). They exist only on the dev server, accept **only requests from this machine**
(loopback address, localhost `Host`, same-origin `Origin`), and only touch the files listed in
`src/editor/config.js`. Git runs without a shell and never prompts in the terminal, so pushing
needs a working git login for GitHub on the machine running `npm run dev` (e.g. `gh auth login`
then `gh auth setup-git`).

All JSON is written by the same formatter (`src/editor/lib/json-format.js`), so saves only
change the lines that changed.

**Later:** adding, removing and reordering album photos isn't in the editor yet (replacing one is:
Change in its field, see the Media window above). Edit
`content/sources/*.json` by hand for that.

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
