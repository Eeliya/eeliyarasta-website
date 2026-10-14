<!-- mock: the two-row section header (the tools row full width), no line above the blocks, and
     the delete question over the whole card at its natural size -->
<script>
  import { Compare, Variant, SectionCard, SECTIONS, sampleLive } from '../kit/index.js';
  import DeleteAskCover from '../parts/DeleteAskCover.svelte';
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
  const card = { at: 5, rows: true, line: false, spread: 'left' };
</script>

<Compare
  title="Section header in two rows (2); delete over the card at its own size"
  note="Tools row full width (icons from the left, the switch at the right); no line above the blocks. Confirming: the full question and Cancel / Delete on a solid band, the rest under --c-card 65%, red border; the band scrolls if the card is shorter"
  cols={4}
>
  {#each CASES as [name, live, text, fields] (name)}
    {@const c = { ...card, live, fields, changed: name === 'Named' }}
    <Variant label="{name}: open"><SectionCard {...c} /></Variant>
    <Variant label="{name}: closed"><SectionCard {...c} open={false} /></Variant>
    <Variant label="{name}: confirming (was open)">
      <SectionCard {...c} red>{#snippet over()}<DeleteAskCover {text} />{/snippet}</SectionCard>
    </Variant>
    <Variant label="{name}: confirming (was closed)">
      <SectionCard {...c} open={false} red
        >{#snippet over()}<DeleteAskCover {text} />{/snippet}</SectionCard
      >
    </Variant>
  {/each}
  <Variant label="Tools row: left" note="Icons from the card's left edge, the switch at the right">
    <SectionCard {...card} live={CASES[1][1]} fields open={false} />
  </Variant>
  <Variant label="Tools row: even" note="Spread evenly across the card">
    <SectionCard {...card} live={CASES[1][1]} fields open={false} spread="even" />
  </Variant>
</Compare>
