<!-- mock: list cards without settings (title row, tools row, blocks); the delete question
     straight on the 65% dim over the card at its own size -->
<script>
  import { Compare, Variant, SectionCard, SECTIONS, sampleLive } from '../kit/index.js';
  import DeleteAskCover from '../parts/DeleteAskCover.svelte';
  const named = (name) =>
    sampleLive(SECTIONS.map((s, i) => (i === 5 && name ? { ...s, name } : s)));
  const LONG =
    'Selected commissioned portrait and editorial work for magazines, brands and private clients, 2019 to 2026, and a few personal projects along the way';
  const CASES = [
    ['Unnamed', named(''), 'Delete Section 6?'],
    ['Named', named('Selected work'), 'Delete “Selected work”?'],
    ['Very long name', named(LONG), `Delete “${LONG}”?`],
  ];
  const card = { at: 5, rows: true, line: false, spread: 'left', fields: false };
</script>

<Compare
  title="Section cards (4): delete on an 80% dim, Cancel / Delete pinned at the bottom"
  note="Title row (wraps) / tools row (icons left, switch right) / blocks, + Add block. Confirming: --c-card at 80%, 8px padding all round, the question at the top, Cancel / Delete at the bottom, red border, the card at its own size"
  cols={4}
>
  {#each CASES as [name, live, text] (name)}
    {@const c = { ...card, live, changed: name === 'Named' }}
    <Variant label="{name}: open"><SectionCard {...c} /></Variant>
    <Variant label="{name}: closed"><SectionCard {...c} open={false} /></Variant>
    <Variant label="{name}: confirming (was open)">
      <SectionCard {...c} red
        >{#snippet over()}<DeleteAskCover {text} pinned dim={80} pad="8px" />{/snippet}</SectionCard
      >
    </Variant>
    <Variant label="{name}: confirming (was closed)">
      <SectionCard {...c} open={false} red
        >{#snippet over()}<DeleteAskCover {text} pinned dim={80} pad="8px" />{/snippet}</SectionCard
      >
    </Variant>
  {/each}
</Compare>
