<!-- mock: the section header in two rows (the title wraps in full, the tools under it) and the
     delete confirm with the full question, the card a fixed height while it asks -->
<script>
  import { Compare, Variant, SectionCard, SECTIONS, sampleLive } from '../kit/index.js';
  import DeleteAskStack, { CARD_H } from '../parts/DeleteAskStack.svelte';
  const named = (name) =>
    sampleLive(SECTIONS.map((s, i) => (i === 5 && name ? { ...s, name } : s)));
  const LONG =
    'Selected commissioned portrait and editorial work for magazines, brands and private clients, 2019 to 2026, and a few personal projects along the way';
  const CASES = [
    ['Unnamed', named(''), 'Delete Section 6?', true],
    ['Named', named('Selected work'), 'Delete “Selected work”?', true],
    ['Very long name', named(LONG), `Delete “${LONG}”?`, true],
    ['No settings fields', named('Footer links'), 'Delete “Footer links”?', false],
  ];
</script>

<Compare
  title="Section header in two rows; delete with the full question"
  note="Title row (changed dot, caret, title: wraps in full) / tools row. Confirming: the card a fixed {CARD_H} (3 lines, then the question scrolls), red border, Cancel / Delete pinned at the bottom, the rest under --c-card 65%"
  cols={4}
>
  {#each CASES as [name, live, text, fields] (name)}
    <Variant label="{name}: open">
      <SectionCard {live} at={5} rows {fields} changed={name === 'Named'} />
    </Variant>
    <Variant label="{name}: closed">
      <SectionCard {live} at={5} rows {fields} open={false} changed={name === 'Named'} />
    </Variant>
    <Variant label="{name}: confirming (was open)">
      <SectionCard {live} at={5} rows {fields} red height={CARD_H}>
        {#snippet over()}<DeleteAskStack {text} />{/snippet}
      </SectionCard>
    </Variant>
    <Variant label="{name}: confirming (was closed)">
      <SectionCard {live} at={5} rows {fields} open={false} red height={CARD_H}>
        {#snippet over()}<DeleteAskStack {text} />{/snippet}
      </SectionCard>
    </Variant>
  {/each}
</Compare>
