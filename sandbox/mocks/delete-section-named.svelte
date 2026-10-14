<!-- mock: 2F on a named section: how the strip's question reads, a long name cut with an ellipsis -->
<script>
  import { Compare, Variant, SectionCard, SECTIONS, sampleLive } from '../kit/index.js';
  import DeleteAsk from '../parts/DeleteAsk.svelte';
  const named = (name) => sampleLive(SECTIONS.map((s, i) => (i === 5 ? { ...s, name } : s)));
  const SHORT = 'Selected work';
  const LONG = 'Selected commissioned portrait work, 2019 to 2026';
  const short = named(SHORT);
  const long = named(LONG);
  const A = (n) => `Delete “${n}”?`;
  const B = (n) => `Delete Section 6 · ${n}?`;
  const ROWS = [
    ['open', short, SHORT, true],
    ['closed', short, SHORT, false],
    ['closed, a long name', long, LONG, false],
  ];
</script>

<Compare
  title="Delete a named section: the strip's question"
  note="2F (the trash in Delete, the rest under --c-card 65%); a long name ends in … so Cancel / Delete never move"
  cols={3}
>
  {#each ROWS as [row, live, name, open] (row)}
    <Variant
      label="Normal header, {row}"
      note={name === LONG
        ? 'Reference: the real header wraps a long name (the card grows)'
        : 'Reference: not confirming'}
    >
      <SectionCard {live} at={4} open={false} />
      <SectionCard {live} at={5} {open} />
    </Variant>
    {#each [['A', A(name), 'Delete “name”?: the name only, in quotes'], ['B', B(name), 'Delete Section N · name?: its number too']] as [label, text, note] (label)}
      <Variant label="{label}, {row}" {note}>
        <SectionCard {live} at={4} open={false} />
        <SectionCard {live} at={5} {open} red>
          {#snippet over()}
            {#if open}<div class="kit-over rest" aria-hidden="true"></div>{/if}
            <DeleteAsk bar strip={open} trash="button" {text} />
          {/snippet}
        </SectionCard>
      </Variant>
    {/each}
  {/each}
</Compare>

<style lang="scss">
  :global(.kit-card) > .rest {
    top: 47px;
    border-radius: 0 0 calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px);
    background: color-mix(in srgb, var(--c-card) 65%, transparent);
  }
</style>
