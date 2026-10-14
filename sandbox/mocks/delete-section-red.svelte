<!-- mock: a section's delete overlay with the card's own border red, its size kept -->
<script>
  import DeleteOverlay from '../parts/DeleteOverlay.svelte';
</script>

<div style="display: grid; grid-template-columns: repeat(3, 384px); gap: 24px 32px;">
  <DeleteOverlay v="solid" card caption="1 Full-card solid overlay; the card's own border red" />
  <DeleteOverlay
    v="compact"
    card
    caption="2 Header-only overlay; the card's border red, the fields visible below"
  />
  <DeleteOverlay
    v="blur"
    card
    caption="3 Full-card blur (backdrop-filter, a light tint: Eeliya's exception); the card's border red"
  />
  <DeleteOverlay v="solid" card closed caption="1 on a closed card" />
  <DeleteOverlay v="compact" card closed caption="2 on a closed card" />
  <DeleteOverlay v="blur" card closed caption="3 on a closed card" />
</div>
