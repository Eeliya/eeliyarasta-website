<!--
  One widget's row in a section card's list: the real WidgetRow.svelte (its type, its title
  under it, eye, Duplicate, Delete; no order). Put it in a <ul> (SectionCard does).
    widget   { id, type, title?, config? }   config.enabled === false: hidden (faint, eye-slash)
-->
<script>
  import WidgetRow from '../../src/editor/svelte/WidgetRow.svelte';

  let { widget } = $props();
</script>

<WidgetRow
  {widget}
  onopen={() => {}}
  onshow={() => {}}
  onduplicate={() => {}}
  ondelete={() => {}}
/>
