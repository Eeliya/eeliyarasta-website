# Mockup protocol (for any agent or bot)

Read this once, then make mocks right away. Everything you need is here: rules, where files go,
how to push them, the kit's every prop, a copy-paste template and reference screenshots.

## 1. What a mockup is

- **"mup"** in a request = mockup only. A mock is a throwaway `.svelte` page in the sandbox that
  shows 2+ design options side by side. **Never build it in the app** (`src/`) until Eeliya
  approves a variant. ("jex" = explain only, build nothing.)
- Mocks are **local only**: `sandbox/mocks/<name>.svelte` is git-ignored. Never commit, push or
  copy them into the repo's history. (The kit, viewer, scripts and this doc are tracked.)
- Make them **on the PC Eeliya is using**, not on your own machine:
  - Home PC (Windows): repo at `S:\eeliyarasta-website` → `S:\eeliyarasta-website\sandbox\mocks\`
  - Work PC (WSL): repo at `~/work/eeliyarasta-website` inside WSL (commands start in Windows
    PowerShell) → `~/work/eeliyarasta-website/sandbox/mocks/`
- Don't touch Eeliya's uncommitted work on those PCs (e.g. untracked `content/pages/`).

## 2. Push in one command

Pack the mock files as a base64 tar.gz on your side:

    tar czf - section-cards-a.svelte section-cards-b.svelte | base64 -w0

**Work PC (WSL)** (from PowerShell; `sandbox/mock-push.sh` writes, checks the server, prints timings):

```powershell
wsl.exe bash -lc 'cd ~/work/eeliyarasta-website && echo <b64> | bash sandbox/mock-push.sh'
wsl.exe bash -lc 'cd ~/work/eeliyarasta-website && echo <b64> | bash sandbox/mock-push.sh --rm old-a,old-b'
```

Why base64: PowerShell rewrites `$…` and strips double quotes inside the command before WSL sees
it. Base64 has neither, so the payload arrives intact; wrap the command in **single** quotes and
put no `$` or `"` in it. Plain commands go as they are, e.g.
`wsl.exe bash -lc 'curl -s localhost:5199/__mocks/list'`.

**Windows PC** (plain PowerShell, no bash): write each file from its own base64 (no quoting
problems either), one command for all files:

```powershell
$d='S:\eeliyarasta-website\sandbox\mocks'; [IO.File]::WriteAllBytes("$d\section-cards-a.svelte",[Convert]::FromBase64String('<b64 of the file>')); Remove-Item "$d\old-a.svelte" -ErrorAction SilentlyContinue; (Invoke-WebRequest -UseBasicParsing http://localhost:5199/__mocks/list).Content
```

Output of `mock-push.sh`: `wrote: …`, `deleted: …`, `server: all listed` (or `missing …` / `not
running`), `delete=…ms write=…ms check=…ms`. Overwriting a same-named mock is fine; `--rm` is
optional (only when asked to redo or clear mocks).

## 3. View and screenshot

    npm run mock:serve          # Vite on port 5199 (MOCK_PORT), HMR; new mocks appear by themselves

- List: `http://localhost:5199/sandbox/` · one mock: `…/?mock=<name>` · stacked:
  `?mock=a,b` · panel width `&width=N` · no panel `&bare=1` · `/__mocks/list` (JSON).
- Send Eeliya the links: `http://localhost:5199/sandbox/?mock=<name>`.
- Screenshot (headless Chrome, 2x): `MOCK_PORT=5199 npm run mock -- <name> [--bare] [--width N]
[--out file.png]` → `$MOCK_DIR/<name>.png` (default `../mocks/` next to the checkout).
  Chrome: `CHROME`, else the usual install path (`/usr/bin/google-chrome` on Linux).

## 4. Template (copy, rename, change the variants)

```svelte
<!-- mock: section cards: at rest vs hovered and open -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  const live = sampleLive('short');
</script>

<Compare title="Section cards" note="At rest vs hovered with its widgets open" cols={2}>
  <Variant label="At rest (current)">
    <SectionCard {live} at={0} />
    <SectionCard {live} at={1} />
  </Variant>
  <Variant label="Hovered, open">
    <SectionCard {live} at={0} />
    <SectionCard {live} at={1} hover open hoverRow={0} />
  </Variant>
</Compare>
```

![The template mock](docs/template-mock.png)

## 5. Kit cheat sheet

Import everything from `'../kit/index.js'` (from a mock). Real editor components, if you need
one the kit lacks: `'../../src/editor/svelte/<Name>.svelte'` (Button, Section, Field, Select,
Tabs, ExplorerHead, …). `{live}` is required wherever listed.

**Compare** — the mock's frame: title, note, a grid of variants.

| prop    | type       | default          | meaning                                                                  |
| ------- | ---------- | ---------------- | ------------------------------------------------------------------------ |
| `title` | string     | `''`             | one-line title                                                           |
| `note`  | string     | `''`             | a line under it                                                          |
| `cols`  | number     | `3`              | columns                                                                  |
| `width` | CSS length | `var(--panel-w)` | each column's width (a container: the editor's container queries see it) |

**Variant** — one labelled cell (label in accent, note muted, children stacked 12px apart).

| prop    | type   | default | meaning                                                        |
| ------- | ------ | ------- | -------------------------------------------------------------- |
| `label` | string | `''`    | e.g. `"Left (current)"`, `"A"`                                 |
| `note`  | string | `''`    | what it is, 1–2 lines (its 32px space is kept even when empty) |

**SectionCard** — a page section's card: the real `SectionCard.svelte` (title row: changed dot,
title, eye, pen; count row: "N widgets ⌄", + Add widget, ↑, ↓, Duplicate, Delete; its widgets
inside when open).

| prop       | type         | default  | meaning                                                        |
| ---------- | ------------ | -------- | -------------------------------------------------------------- |
| `live`     | sampleLive() | required | the page state (one per mock, shared by the cards)             |
| `at`       | number       | `0`      | the section's index in that page                               |
| `selected` | bool         | `false`  | the selected card: border white 70%, its buttons 100%          |
| `hover`    | bool         | `false`  | drawn hovered: border white 40%, its buttons 100%              |
| `open`     | bool         | `false`  | its widgets open inside the card (the card grows)              |
| `hoverRow` | number       | `-1`     | that widget row drawn hovered (its buttons 100%)               |
| `changed`  | bool         | `false`  | the 6px accent dot before the title                            |
| `red`      | bool         | `false`  | its real delete confirm: over the card at its size, border red |

As built: not collapsible, no caret; the pen (`pen-to-square`) at the title row's right end
(in a mock it does nothing). Title: the section's `name`, else "Section N", one line (…), muted
when hidden. ↑/↓ disable at the first/last section; "No widgets" is faint and inactive.

**Ask** — the old delete confirm for an `over` snippet (old mocks). The card's `red` now shows
the real confirm.

| prop       | type   | default                  | meaning             |
| ---------- | ------ | ------------------------ | ------------------- |
| `question` | string | `'Delete this section?'` | the line at the top |

**WidgetCard** — one widget row: the real `WidgetRow.svelte` (its type, its title under it in the
link colour, eye, Duplicate, Delete; no grip, no order). Put it in a `<ul>`.

| prop     | type                       | default  | meaning                                                     |
| -------- | -------------------------- | -------- | ----------------------------------------------------------- |
| `widget` | `{id,type,title?,config?}` | required | `config.enabled === false` = hidden (eye-slash, faint name) |

**Panel** — the editor's side panel around your cards.

| prop       | type                                            | default                     | meaning                                                             |
| ---------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| `mode`     | `'text'`\|`'motion'`\|`'settings'`\|`'preview'` | `'text'`                    | active mode tab (`text` = "Content"; `preview`: ▶ on, no mode tabs) |
| `tab`      | `'sections'`\|`'transitions'`\|`'seo'`          | `'sections'`                | page tab (only in `text`)                                           |
| `tabs`     | bool                                            | `true`                      | `false` hides the page tabs                                         |
| `height`   | CSS length                                      | `'844px'`                   | panel height (body scrolls)                                         |
| `changes`  | number                                          | `0`                         | unsaved count: "Unsaved changes", Save · N, Undo on                 |
| `pending`  | string                                          | `'Everything is published'` | footer line when no changes                                         |
| `children` | snippet                                         | —                           | the scroll body                                                     |

**Modal** — a modal shell drawn in place (`.modal__box` + real ExplorerHead).

| prop               | type        | default                | meaning                          |
| ------------------ | ----------- | ---------------------- | -------------------------------- |
| `title`            | string      | required               | header title                     |
| `icon`             | `'fa-…'`    | `'fa-window-maximize'` | header icon                      |
| `crumbs`           | `[{label}]` | `[]`                   | header crumbs                    |
| `width` / `height` | CSS length  | `'720px'` / `'480px'`  | box size                         |
| `children`         | snippet     | —                      | body (16px padding, scrolls)     |
| `foot`             | snippet     | —                      | footer row (56px, space-between) |

**Sample data** (`sample.js`)

- `sampleLive(name | sections?)` → a fresh live editor state. `sampleLive()` = `SECTIONS`;
  `sampleLive('short' | 'full' | 'states')` = a `samplePage`; `sampleLive([...])` = your own.
- `samplePage.short`: 0 unnamed (intro) · 1 "Work" (grid "People", button)
- `samplePage.full`: 0 unnamed (intro) · 1 "Work" (grid, button) · 2 "Albums" (albums) ·
  3 "Selected portrait and editorial work from the last three years" (projects, grid "Places") ·
  4 unnamed (projects, button)
- `samplePage.states`: 0 "Work" (grid, button) · 1 "Contact" hidden (button) · 2 unnamed, no widgets
- `SECTIONS`: the six-section home page · `PAGES`: the page menu items · `FILE`: `'pages/index.json'`
- `widget(id, type, title?)` builds a widget; `labelOf(widget)` its editor name. Widget types:
  `hero`, `intro` ("Statement"), `grid` ("Photo grid"), `button`, `albums`, `projects` ("Project list"), …
  (`src/site/widgets/index.js`).

Own data: `sampleLive([{ id: 's-1', name: 'Work', enabled: false, widgets: [widget('b-1', 'grid', 'People')] }])`.

## 6. Design rules

- Real editor styles and icons only (they load inside a mock): tokens like `var(--space-2)`,
  `var(--c-card)`, `var(--c-accent)`, Font Awesome `fa-solid fa-…`, the real `Button`. No new look.
- Controls 32px (bar buttons `size="small"`), everything on a 4px grid (`--space-1` = 4px).
- At most 5 classes per element, so the markup never looks like Tailwind (no long utility-class chains; style in SCSS instead); accent **#33ccff** (`--c-accent`).
- Repeated declaration groups are SCSS mixins, not classes (`src/editor/styles/_mixins.scss`:
  `row`, `stack`, `muted`, `ellipsis`, `focus-ring`; `@use '../styles/mixins' as *;` in a
  `<style lang="scss">`). Only those five: don't add more for a mock.
- **No layout shifts, ever**: hints, markers, dots, red borders and confirms must not push or
  resize anything (overlay them, reserve their space, or use a border that already exists).
- Each mock compares **2+ variants side by side**; the current version is labelled **"(current)"**.
- Name: `<area>-<topic>.svelte` (e.g. `section-cards-noline`); first line a one-line
  `<!-- mock: what it compares -->` comment.
- Show realistic cases: unnamed, short and very long names, changed, empty (the sample pages have them).

### The current section card (decided, built)

`<SectionCard {live} at={i} />`

- Not collapsible. Title row: the changed dot, the title (one line), eye, pen. Count row:
  "N widgets ⌄" (text only; "No widgets" faint, inactive), + Add widget (always), then ↑, ↓,
  Duplicate, Delete (24px icon buttons). 12px inside: every icon ends and all text starts on
  those edges.
- The count opens the widgets inside the card (the card grows): 48px rows 4px apart, bleeding
  4px into the card's padding, text 12px in on two 20px lines (type, then its title in the
  link colour), eye, Duplicate, Delete; no grip, no order (widgets are placed in the preview).
  A row opens that widget's settings, as a click on the widget in the preview does.
- A click on the card selects it (white 70% border, its section shown in the preview); a
  double click or the pen opens its settings (one level: ← Back, Locate, the settings card).
  Hovered: a 40% white border. The title never changes colour.
- Buttons rest at 30%: the card's at 100% on its hover, selection or a focus in it; a widget
  row's on that row's hover or focus. An eye-slash (hidden) always 100%; the count not dimmed.
- Hidden: the title muted, its widgets at 55%. Changed: a 6px `#33ccff` dot, no shift.
- Delete: over the card at its size and 12px corners, opaque, red border, the question (one
  line) at the top, Delete (an icon-only red trash) then Cancel at the bottom left, both 24px
  with 8px corners, 8px in on every side (never scrolls). A widget's: one line over its 48px row,
  its 8px corners, the question 12px in, the buttons 12px from the top, bottom and right.
- Cards: top level (section, Settings, pages list rows) `--radius-lg` 12px; nested (widget
  rows) `--radius-md` 8px. A collapsible card's caret is at its bar's right end.

![Section card states](docs/section-card-states.png)
![Delete confirm](docs/section-card-delete.png)
![The kit demo (kit-demo)](docs/kit-demo.png)

## 7. Speed

- Don't look anything up: this sheet has every prop. Write the whole mock in one go from the template.
- Use a `samplePage` instead of writing sample data.
- One push command per round (pack all files, `--rm` in the same call), no separate checks:
  `mock-push.sh` already confirms the server lists them.
- Reply with the viewer links and one line per variant.
