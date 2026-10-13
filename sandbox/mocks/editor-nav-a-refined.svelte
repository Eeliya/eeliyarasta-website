<!-- mock: editor nav A refined: the page selector full width; Sources, Media, Pages | phone, undo, redo; modes; page tabs -->
<script>
  import EditorNavA from '../parts/EditorNavA.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <EditorNavA
    v="r1"
    caption="Refined A: page selector full width; Sources, Media, Pages (icons) left, phone/undo/redo right; mode tabs; page tabs"
  />
  <EditorNavA
    v="r2"
    caption="Alternative: the same with quiet labelled buttons (icon + text, no fill) (Sources, Media, Pages)"
  />
</div>
