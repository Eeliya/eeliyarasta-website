# Mock kit

Pieces for mocks, so a mock only writes the bit it changes. They use the real components from
`src/editor/svelte/` (Section, SectionSettings, Button, PageMenu, Tabs, ExplorerHead) and,
where the app's markup lives inside a component (App's toolbar and footer, SectionsList's
block rows), that component's own styles, read from its source and compiled in the browser
(`styles.js`). Nothing is copied, so the kit follows the app.

| Piece                                       | What it draws                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Panel`                                     | the side panel: page menu, tools row, mode tabs, page tabs, scroll body, Save / Publish (`mode`, `tab`, `tabs`, `height`, `changes`)                                                                          |
| `SectionCard`                               | a section card on the sample page: real Section + SectionSettings, its blocks, Add block (`at`, `open`, `red`, `fields`, `rows`, `height`, `changed`, `line`, `spread`, snippets `tools`, `over`, `children`) |
| `BlockCard`                                 | a block's row (`block`, snippet `tools`)                                                                                                                                                                      |
| `Modal`                                     | a modal shell in place: `.modal__box` + ExplorerHead, body, `foot` snippet                                                                                                                                    |
| `Compare` / `Variant`                       | a title and labelled variants side by side (`cols`, `width`; `label`, `note`)                                                                                                                                 |
| `sampleLive()`, `SECTIONS`, `PAGES`, `FILE` | sample data: a six-section page in a real store / live state                                                                                                                                                  |

## Example

```svelte
<!-- sandbox/mocks/my-idea.svelte -->
<script>
  import { Compare, Variant, Panel, SectionCard, sampleLive } from '../kit/index.js';
  const live = sampleLive();
</script>

<Compare title="My idea" cols={2}>
  <Variant label="Now"><SectionCard {live} at={5} /></Variant>
  <Variant label="A" note="The card red, a strip over its header">
    <SectionCard {live} at={5} red>
      {#snippet over()}<div class="kit-over kit-over--bar">…</div>{/snippet}
    </SectionCard>
  </Variant>
</Compare>
```

Then `npm run mock -- my-idea --bare` (see `../README.md`). `kit-demo` (`demo.svelte`) shows every piece.
