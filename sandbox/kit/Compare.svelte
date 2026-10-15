<!--
  Labelled variants side by side: a title, then a grid of Variant cells.
    title   the mock's title (one line)    note   optional: a line under it
    cols    columns (default 3)            width  a column's width (default the panel's)
-->
<script>
  let { title = '', note = '', cols = 3, width = 'var(--panel-w)', children } = $props();
</script>

<div class="kit-compare">
  {#if title}<h3 class="modal__title kit-compare__title">{title}</h3>{/if}
  {#if note}<p class="hint kit-compare__note">{note}</p>{/if}
  <div class="kit-compare__grid" style:--cols={cols} style:--col-w={width}>
    {@render children?.()}
  </div>
</div>

<style lang="scss">
  .kit-compare {
    display: grid;
    gap: var(--space-2);
  }

  .kit-compare__title,
  .kit-compare__note {
    margin: 0;
  }

  .kit-compare__grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--col-w));
    gap: var(--space-5) var(--space-6);
    margin-top: var(--space-3);
  }

  // each column at its width is what the editor's container queries see (like the panel)
  .kit-compare__grid > :global(*) {
    container-type: inline-size;
  }
</style>
