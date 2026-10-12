<!-- mock: the block card's tabs: now | a underline | b folder | c plain -->
<script>
  import TabsDemo from '../parts/TabsDemo.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <TabsDemo v="now" caption="Now: a segmented control (as Height/Width-type pickers)" />
  <TabsDemo v="a" caption="A: underline tabs, a 1px line under them, the active one cyan 2px + white" />
  <TabsDemo v="b" caption="B: folder tabs joined to the panel below" />
  <TabsDemo v="c" caption="C: plain text tabs, the active one white and bold (its width reserved)" />
</div>
