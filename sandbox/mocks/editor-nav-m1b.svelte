<!-- mock: M1 with heavier mode tabs (one weight for all tabs) and a white selected underline -->
<script>
  import EditorNavA from '../parts/EditorNavA.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <EditorNavA v="m1" caption="M1 (76b937f), for comparison" />
  <EditorNavA v="m1b-600" caption="M1b: weight 600 on every mode tab, white underline" />
  <EditorNavA v="m1b-700" caption="M1b: weight 700 on every mode tab, white underline" />
</div>
