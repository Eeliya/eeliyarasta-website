<!-- mock: 2E: the solid delete strip, the rest of the card faded into the card's own colour (--c-card) -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  import DeleteAsk from '../parts/DeleteAsk.svelte';
  const live = sampleLive();
  const V = [
    ['2E 50%', "The rest of the card under the card's own colour (--c-card), 50%", 'dim', '50%'],
    ['2E 65%', '--c-card at 65%', 'dim', '65%'],
    ['2E 80%', '--c-card at 80%', 'dim', '80%'],
  ];
</script>

<Compare
  title="Delete a section: 2E"
  note="The card's own border red; Cancel / Delete 32px; no blur"
  cols={3}
>
  {#each V as [label, note, kind, a] (label)}
    <Variant {label} {note}>
      <SectionCard {live} at={4} open={false} />
      <SectionCard {live} at={5} red>
        {#snippet over()}
          <div class={['kit-over', 'rest', `rest--${kind}`]} style:--a={a} aria-hidden="true"></div>
          <DeleteAsk bar />
        {/snippet}
      </SectionCard>
    </Variant>
  {/each}
  <Variant label="2E closed" note="On a closed card: just the strip">
    <SectionCard {live} at={4} open={false} />
    <SectionCard {live} at={5} open={false} red>
      {#snippet over()}<DeleteAsk bar />{/snippet}
    </SectionCard>
  </Variant>
</Compare>

<style lang="scss">
  // under the strip (the header's 46px), to the card's bottom
  :global(.kit-card) > .rest {
    top: 47px;
    border-radius: 0 0 calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px);
  }
  // Eeliya's exception: the card's own colour, translucent, so the fields fade into the card
  .rest--dim {
    background: color-mix(in srgb, var(--c-card) var(--a), transparent);
  }
</style>
