<!-- mock: a section's delete overlay with the card's own border red, its size kept (on the kit) -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  import DeleteAsk from '../parts/DeleteAsk.svelte';
  const live = sampleLive();
  const V = [
    ['1', "Full-card solid overlay; the card's own border red", false, 'solid'],
    ['2', "Header-only overlay; the card's border red, the fields visible below", true, 'solid'],
    [
      '3',
      "Full-card blur (backdrop-filter, a light tint: Eeliya's exception); the card's border red",
      false,
      'blur',
    ],
  ];
</script>

<Compare title="Delete a section: the card's border red" cols={3}>
  {#each [true, false] as open (open)}
    {#each V as [label, note, bar, look] (label)}
      <Variant
        label={open ? label : `${label} closed`}
        note={open ? note : 'On a closed card: one row, the header’s height'}
      >
        <SectionCard {live} at={4} open={false} />
        <SectionCard {live} at={5} {open} red>
          {#snippet over()}<DeleteAsk bar={bar || !open} {look} />{/snippet}
        </SectionCard>
      </Variant>
    {/each}
  {/each}
</Compare>
