<!-- mock: the Backdrop card's Shade (how dark the dim over the photos is): buttons | slider -->
<script>
  import BackdropCard from '../parts/BackdropCard.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <BackdropCard state="fade" shade="seg" caption="(a) Shade as buttons: None | 25% | 45% (default) | 65%" />
  <BackdropCard state="fade" shade="slider" caption="(b) Shade as a slider, 0–80% in 5s, with its value (fixed width)" />
</div>
