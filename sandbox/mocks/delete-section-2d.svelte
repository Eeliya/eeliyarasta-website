<!-- mock: 2D: the solid delete strip, the rest of the card dimmed (no blur); 2C for reference -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  import DeleteAsk from '../parts/DeleteAsk.svelte';
  const live = sampleLive();
  const V = [
    ['2C', 'Reference: the rest of the card blurred under a light tint', 'blur', ''],
    ['2D 50%', 'The rest of the card dimmed: a dark tint, 50%', 'dim', '50%'],
    ['2D 65%', 'Dimmed 65%', 'dim', '65%'],
    ['2D 80%', 'Dimmed 80%', 'dim', '80%'],
  ];
</script>

<Compare
  title="Delete a section: 2D"
  note="The card's own border red; Cancel / Delete 32px; no blur"
  cols={4}
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
  <Variant label="2D closed" note="On a closed card: just the strip">
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
  .rest--blur {
    background: rgb(20 20 20 / 35%);
    backdrop-filter: blur(6px);
  }
  // Eeliya's exception: a translucent dark tint, no blur
  .rest--dim {
    background: rgb(10 10 10 / var(--a));
  }
</style>
