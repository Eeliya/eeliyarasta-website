<!-- mock: a section's delete confirmation as an overlay on the card, its size kept; B for reference -->
<script>
  import DeleteSection from '../parts/DeleteSection.svelte';
  import DeleteOverlay from '../parts/DeleteOverlay.svelte';
</script>

<div style="display: grid; grid-template-columns: repeat(5, 384px); gap: 24px 32px;">
  <DeleteSection v="b" caption="B (reference): a popover under the trash" />
  <DeleteOverlay
    v="solid"
    caption="1 Solid: the card tone over the whole card, the question centred, Cancel / Delete"
  />
  <DeleteOverlay
    v="red"
    caption="2 Red edge: solid, a 1px red edge and a red trash over the question"
  />
  <DeleteOverlay
    v="scrim"
    caption="3 TRANSLUCENT scrim (breaks the no-translucent rule, shown to ask): the card shows through"
  />
  <DeleteOverlay
    v="compact"
    caption="4 Compact: only the header's height, red edge; the open card's body stays visible"
  />
  <DeleteSection v="b" closed caption="B on a closed card" />
  <DeleteOverlay v="solid" closed caption="1 on a closed card: one row, the header's height" />
  <DeleteOverlay v="red" closed caption="2 on a closed card" />
  <DeleteOverlay v="scrim" closed caption="3 on a closed card" />
  <DeleteOverlay v="compact" closed caption="4 on a closed card: the same row as the open one" />
</div>
