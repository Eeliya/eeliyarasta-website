# Mock kit

Pieces for mocks, so a mock only writes the bit it changes. They use the real components from
`src/editor/svelte/` (Section, SectionSettings, Button, Tabs, ExplorerHead) and,
where the app's markup lives inside a component (App's toolbar and footer, SectionsList's
block rows), that component's own styles, read from its source and compiled in the browser
(`styles.js`). Nothing is copied, so the kit follows the app.

| Piece                                       | What it draws                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Panel`                                     | the side panel: tools row, mode tabs, page head (`page`), page tabs, scroll body, Save / Publish (`mode`, `tab`, `tabs`, `height`, `changes`) |
| `SectionCard`                               | a section card on the sample page: the real SectionCard.svelte (`at`, `selected`, `hover`, `open`, `hoverRow`, `changed`, `red`)              |
| `Ask`                                       | the old delete confirm for an `over` snippet (old mocks; `red` shows the real one)                                                            |
| `BlockCard`                                 | a block's row: the real BlockRow.svelte (`block`)                                                                                             |
| `Modal`                                     | a modal shell in place: `.modal__box` + ExplorerHead, body, `foot` snippet                                                                    |
| `Compare` / `Variant`                       | a title and labelled variants side by side (`cols`, `width`; `label`, `note`)                                                                 |
| `sampleLive()`, `SECTIONS`, `PAGES`, `FILE` | sample data: a six-section page in a real store / live state                                                                                  |
| `samplePage`, `block`                       | ready-made pages `short`, `full`, `states`: `sampleLive('full')` (indices in `sample.js`, `../MOCKUP-PROTOCOL.md`)                            |

## Example

```svelte
<!-- sandbox/mocks/my-idea.svelte -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  const live = sampleLive();
</script>

<Compare title="My idea" cols={2}>
  <Variant label="Now"><SectionCard {live} at={2} /></Variant>
  <Variant label="A" note="Selected, its blocks open, its delete confirm below">
    <SectionCard {live} at={2} selected open />
    <SectionCard {live} at={5} red />
  </Variant>
</Compare>
```

Then `npm run mock -- my-idea --bare` (see `../README.md`). `kit-demo` (`demo.svelte`) shows every piece.
