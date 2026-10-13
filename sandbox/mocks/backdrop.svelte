<!-- mock: the page's Backdrop card: Scroll | Fade | empty -->
<script>
  import BackdropCard from '../parts/BackdropCard.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <BackdropCard state="scroll" caption="Scroll (default): Direction, and what it does" />
  <BackdropCard state="fade" caption="Fade: Direct | Through black, Parallax and Scrub" />
  <BackdropCard state="empty" caption="Empty: one line and Add photo, no transition yet" />
</div>
