# Editor mock sandbox

Dev-only page for trying editor UI fast, with the editor's real styles (`editor.scss`, tokens,
fonts), Font Awesome icons and Svelte components. Never built (`vite.config.js` builds
`index.html` only).

What is in git: the builder (this folder's `main.js`, `Viewer.svelte`, `sandbox.scss`, the kit
in `kit/` with its demo `kit/demo.svelte`, `scripts/mock-serve.mjs`, `scripts/mock-api.mjs`,
`scripts/mock.mjs`). What is not: the mocks themselves. `sandbox/mocks/` (and
`sandbox/history/`, `sandbox/thumbs/`) are git-ignored and live only on the machine that makes
them.

## Serve

    npm run mock:serve

The same on Windows, macOS and Linux (plain Node, no shell). A Vite dev server with HMR on
`MOCK_PORT` (default **5174**, so it runs next to `npm run dev` on 5173). It prints the URL:
**http://localhost:5174/edit/sandbox/**. `npm run dev` serves the sandbox too, at
`/edit/sandbox/` on its own port.

## The viewer

`/edit/sandbox/` lists the mocks newest first (name, last changed), plus the kit's demo
(`kit-demo`, tracked). Click one to open it live. A new `sandbox/mocks/*.svelte` appears by
itself, and edits to an open mock hot-reload. Each mock has a delete button, and **Delete older
than N days** removes every mock last changed before then (both ask first).

Deletes go through `POST /__mocks/delete` (dev server only, `scripts/mock-api.mjs`): JSON only,
this page's origin only, and only a plain `<name>.svelte` / `.html` directly in
`sandbox/mocks/`. The path is resolved and checked, so `../`, absolute paths, subfolders and
other files are refused.

## A mock

`sandbox/mocks/<name>.svelte` (or `<name>.html`). Build it from the real components
(`../../src/editor/svelte/…`: Section, Field, Button, Select, …, or the kit: `../kit/index.js`)
with made-up props, and copy only the piece the mock changes, so it can't drift from the
editor.

Open `/edit/sandbox/?mock=<name>` (`?mock=a,b,c` stacks several with their names,
`&width=N` sets the panel width, default `--panel-w`, `&bare=1` drops the panel).

## Screenshot (optional)

    npm run mock -- <name> [<name> ...] [--width N] [--out path] [--bare]

Prints the PNG path: `$MOCK_DIR/<name>.png` (default `../mocks`, next to the checkout), or
`<first>+N.png` for several (stacked, labelled). It reuses a dev server on `MOCK_PORT` (5173;
set `MOCK_PORT=5174` to use `mock:serve`'s) or starts one in the background, and drives
headless Chrome over the DevTools protocol at 2x. Chrome: `CHROME`, else its usual install path
on Windows or macOS, else `/usr/bin/google-chrome`. About 2 s per call with the server up.
