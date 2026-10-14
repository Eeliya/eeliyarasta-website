<!-- mock: 2F: 2E at 65%, the trash in the Delete button, not before the question -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  import DeleteAsk from '../parts/DeleteAsk.svelte';
  const live = sampleLive();
</script>

<Compare title="Delete a section: 2F" note="2E at 65%; the trash in the red Delete button" cols={2}>
  {#each [true, false] as open (open)}
    <Variant
      label={open ? '2F' : '2F closed'}
      note={open
        ? 'The rest of the card under --c-card at 65%'
        : 'On a closed card: just the strip'}
    >
      <SectionCard {live} at={4} open={false} />
      <SectionCard {live} at={5} {open} red>
        {#snippet over()}
          {#if open}<div class="kit-over rest" aria-hidden="true"></div>{/if}
          <DeleteAsk bar trash="button" />
        {/snippet}
      </SectionCard>
    </Variant>
  {/each}
</Compare>

<style lang="scss">
  // under the strip (the header's 46px): the card's own colour, translucent (Eeliya's exception)
  :global(.kit-card) > .rest {
    top: 47px;
    border-radius: 0 0 calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px);
    background: color-mix(in srgb, var(--c-card) 65%, transparent);
  }
</style>
