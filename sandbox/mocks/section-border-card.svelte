<!-- mock: the block view's section settings in a bordered card, above the block's filled card -->
<script>
  import SectionCard from '../parts/SectionCard.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <SectionCard v="now" caption="Now: the section settings are a plain area" />
  <SectionCard
    v="a"
    caption="A: Back header stays outside; Name and Height | Width in a 1px bordered box, no fill"
  />
  <SectionCard v="b" caption="B: one bordered box holds the header and the settings" />
  <SectionCard v="c" caption="C: bordered card with the header as its title row, a line under it" />
</div>
