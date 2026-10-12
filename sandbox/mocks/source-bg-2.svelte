<!-- mock: the Source item card (style B) without its outside label, 1 | 2 | 3 side by side -->
<script>
  import SourceBg2 from '../parts/SourceBg2.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <SourceBg2 v="1" caption="1: label inside the card, no explanation" />
  <SourceBg2 v="2" caption="2: as 1, the explanation as a right-aligned hint (as Name's)" />
  <SourceBg2 v="3" caption="3: no label, dim &quot;No source item&quot;, the hint under it" />
</div>
