<!-- mock: refined A, then five ways to make the main mode tabs read unlike the page tabs -->
<script>
  import EditorNavA from '../parts/EditorNavA.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <EditorNavA v="r1" caption="Refined A: mode tabs and page tabs alike" />
  <EditorNavA
    v="m1"
    caption="M1: modes evenly spread full width, accent underline, edge-to-edge line"
  />
  <EditorNavA v="m2" caption="M2: a solid card-tone strip, the active mode filled" />
  <EditorNavA v="m3" caption="M3: sentence case, the active mode in the accent (text + line)" />
  <EditorNavA
    v="m4"
    caption="M4: equal-width outlined segments, the active one filled with accent text"
  />
  <EditorNavA v="m5" caption="M5: centred, 2px accent underline, no full-width line" />
</div>
