<!-- mock: the Source item card on the inputs' background, A | B | C side by side -->
<script>
  import SourceBg from '../parts/SourceBg.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <SourceBg v="current" caption="Now: card background, dashed when empty" />
  <SourceBg v="a" caption="A: input background only" />
  <SourceBg v="b" caption="B: input background + input border (1px line, 8px corners)" />
  <SourceBg v="c" caption="C: as B, the tile darker (#1c1c1c)" />
</div>
