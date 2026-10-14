<!-- mock: 2C: the solid header strip, the rest of the card blurred under a light tint; next to 2 and 3 -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  import DeleteAsk from '../parts/DeleteAsk.svelte';
  const live = sampleLive();
  const V = [
    ['2', 'Header-only, solid (as before)'],
    [
      '2C',
      'The solid header strip; the rest of the card (fields, blocks) blurred under a light tint',
    ],
    ['3', 'Full-card blur (as before)'],
  ];
</script>

<Compare
  title="Delete a section: 2C"
  note="The card's own border red; Cancel / Delete 32px"
  cols={3}
>
  {#each [true, false] as open (open)}
    {#each V as [label, note] (label)}
      <Variant
        label={open ? label : `${label} closed`}
        note={open ? note : 'On a closed card: just the strip'}
      >
        <SectionCard {live} at={4} open={false} />
        <SectionCard {live} at={5} {open} red>
          {#snippet over()}
            {#if label === '3' && open}<DeleteAsk look="blur" />
            {:else}
              {#if label === '2C' && open}<div class="kit-over rest" aria-hidden="true"></div>{/if}
              <DeleteAsk bar />
            {/if}
          {/snippet}
        </SectionCard>
      </Variant>
    {/each}
  {/each}
</Compare>

<style lang="scss">
  // under the strip (the header's 46px), to the card's bottom; the strip keeps its corners
  :global(.kit-card) > .rest {
    top: 47px;
    border-radius: 0 0 calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px);
    background: rgb(20 20 20 / 35%);
    backdrop-filter: blur(6px);
  }
</style>
