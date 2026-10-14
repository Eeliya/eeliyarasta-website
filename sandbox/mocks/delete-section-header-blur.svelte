<!-- mock: the header-only delete strip with a blur, next to 2 (header, solid) and 3 (full blur) -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  import DeleteAsk from '../parts/DeleteAsk.svelte';
  const live = sampleLive();
  const V = [
    ['2', 'Header-only, solid (as before)', true, 'solid'],
    [
      '2B',
      'Header-only, blur: the header’s contents blurred under a light tint; the fields visible below',
      true,
      'blur',
    ],
    ['3', 'Full-card blur (as before)', false, 'blur'],
  ];
</script>

<Compare
  title="Delete a section: the header strip with a blur"
  note="The card's own border red; Cancel / Delete 32px"
  cols={3}
>
  {#each [true, false] as open (open)}
    {#each V as [label, note, bar, look] (label)}
      <Variant label={open ? label : `${label} closed`} note={open ? note : 'On a closed card'}>
        <SectionCard {live} at={4} open={false} />
        <SectionCard {live} at={5} {open} red>
          {#snippet over()}<DeleteAsk bar={bar || !open} {look} />{/snippet}
        </SectionCard>
      </Variant>
    {/each}
  {/each}
</Compare>
