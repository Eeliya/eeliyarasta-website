<!-- mock: settings and content in one fields grid: now | a | b -->
<script>
  import FieldsUnified from '../parts/FieldsUnified.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <FieldsUnified v="now" caption="Now: settings in .opts / .opt (own labels, 4px padding), then the fields" />
  <FieldsUnified v="a" caption="A: one .fields grid, all through Field; a plain 1px line" />
  <FieldsUnified v="b" caption="B: as A, the line with a dim CONTENT caption" />
</div>
