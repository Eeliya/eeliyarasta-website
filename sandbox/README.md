# Editor mock sandbox

Dev-only page for trying editor UI fast, with the editor's real styles (`editor.scss`, tokens,
fonts), Font Awesome icons and Svelte components. It is served by `npm run dev` at
`/edit/sandbox/` and never built (`vite.config.js` builds `index.html` only).

## A mock

`sandbox/mocks/<name>.svelte` (or `<name>.html`). Import real components from
`../../src/editor/svelte/…`; shared mock pieces go in `sandbox/parts/`. Example:
`mocks/block-row-a.svelte` (the four block-row variants, `parts/BlockRowCard.svelte`).

Open `/edit/sandbox/?mock=<name>` (`?mock=a,b,c` stacks several with their names,
`&width=N` sets the panel width, default `--panel-w`, `&bare=1` drops the panel). Without
`?mock` it lists them.

## Screenshot

    npm run mock -- <name> [<name> ...] [--width N] [--out path] [--bare]

Prints the PNG path: `/workspace/mocks/<name>.png` by default, or `<first>+N.png` for
several (stacked, labelled). It reuses a dev server on `MOCK_PORT` (5173) or starts one in
the background, and drives headless Chrome (`CHROME`, default `/usr/bin/google-chrome`) over
the DevTools protocol at 2x. About 2 s per call with the server up.
