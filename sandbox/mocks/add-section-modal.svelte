<!-- mock: Add section (the dashed card) opens a modal: (A) tiles with a sketch | (B) rows -->
<script>
  import AddSectionModal from '../parts/AddSectionModal.svelte';
</script>

<div style="display: flex; flex-direction: column; gap: 32px;">
  <AddSectionModal look="tiles" caption="(A) Tiles: a sketch of the block, its icon, name and one line; Photo grid hovered" />
  <AddSectionModal look="rows" caption="(B) Rows in two columns: icon, name and one line; the hovered one shows Add ↵" />
</div>
