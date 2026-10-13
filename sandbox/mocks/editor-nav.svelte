<!-- mock: the editor's top nav, now and four variants -->
<script>
  import EditorNav from '../parts/EditorNav.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <EditorNav
    v="now"
    caption="Now: Editor + phone/undo/redo; mode pill; page picker + Sources/Pages/Media (3 rows)"
  />
  <EditorNav
    v="a"
    caption="A: page picker + tools on top, modes as underline tabs, libraries right-aligned"
  />
  <EditorNav
    v="b"
    caption="B: icon rail on the left for modes and tools; picker + libraries on top"
  />
  <EditorNav
    v="c"
    caption="C: pill modes, then breadcrumbs Site › Home ▾ › Section 1 › Hero with the libraries"
  />
  <EditorNav
    v="d"
    caption="D: two compact rows: picker + icon-only mode pill; tools left, libraries right"
  />
</div>
