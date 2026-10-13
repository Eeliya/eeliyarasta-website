<!-- mock: editor nav A and five ways to lighten its two tab rows -->
<script>
  import EditorNavA from '../parts/EditorNavA.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <EditorNavA
    v="a0"
    caption="A as mocked: 8px toolbar edges vs 16px content (the mismatch); two equal underline rows"
  />
  <EditorNavA
    v="a1"
    caption="A1: modes stay uppercase underline; page tabs in quiet sentence case (same line)"
  />
  <EditorNavA
    v="a2"
    caption="A2: libraries on the mode row's right; page tabs quiet, no line of their own"
  />
  <EditorNavA
    v="a3"
    caption="A3: the page as a big title row; modes + libraries beneath; page tabs as small chips"
  />
  <EditorNavA
    v="a4"
    caption="A4: modes' line full width; page tabs without a line, libraries at their right"
  />
  <EditorNavA
    v="a5"
    caption="A5: libraries next to the picker; tools on the mode row; page tabs quiet, no line"
  />
</div>
