<!--
  One block's row in a section card's list: the real BlockRow.svelte (its type, its title
  under it, eye, Duplicate, Delete; no order). Put it in a <ul> (SectionCard does).
    block   { id, type, title?, config? }   config.enabled === false: hidden (faint, eye-slash)
-->
<script>
  import BlockRow from '../../src/editor/svelte/BlockRow.svelte';

  let { block } = $props();
</script>

<BlockRow {block} onopen={() => {}} onshow={() => {}} onduplicate={() => {}} ondelete={() => {}} />
