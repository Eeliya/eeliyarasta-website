<!--
  A list in a panel: each item in a box with its name, ↑ / ↓ and Remove, its fields below (the
  `item` snippet), and an Add button at the end. The parent owns the data and makes each
  change one undo step. Used for the list fields of sections (Content: hero photos, facts,
  panels, ...) and the menus (Settings > Menu, nested for sub-items).
    label     the list's name, on top
    items     the list
    name      (item, i) → an item's name (default "<label> <n>")
    addLabel  the Add button's text
    onmove(from, to), onremove(i), onadd()
    item      snippet (item, i): the item's fields
    extra     snippet (item, i): more buttons in the item's bar
-->
<script>
  import Button from './Button.svelte';

  let {
    label,
    items = [],
    name = (_, i) => `${label} ${i + 1}`,
    addLabel = 'Add',
    onmove,
    onremove,
    onadd,
    item,
    extra,
  } = $props();
</script>

<div class="lf" role="group" aria-label={label}>
  <span class="tf__label">{label}</span>
  {#each items as it, i (i)}
    <div class="lf__item">
      <div class="lf__bar">
        <span class="lf__name">{name(it, i)}</span>
        {@render extra?.(it, i)}
        <Button
          size="small"
          icon="arrow-up"
          iconOnly
          label="Move up: {name(it, i)}"
          disabled={i === 0}
          onclick={() => onmove(i, i - 1)}
        />
        <Button
          size="small"
          icon="arrow-down"
          iconOnly
          label="Move down: {name(it, i)}"
          disabled={i === items.length - 1}
          onclick={() => onmove(i, i + 1)}
        />
        <Button
          size="small"
          icon="xmark"
          iconOnly
          label="Remove: {name(it, i)}"
          onclick={() => onremove(i)}
        />
      </div>
      {@render item(it, i)}
    </div>
  {/each}
  <Button size="small" icon="plus" onclick={onadd}>{addLabel}</Button>
</div>

<style lang="scss">
  .lf {
    display: grid;
    gap: 8px;
    justify-items: start;

    > :global(*) {
      justify-self: stretch;
    }

    > :global(.btn) {
      justify-self: start;
    }
  }

  .lf__item {
    display: grid;
    gap: 8px;
    padding: 8px;
    border-radius: 16px;
    border: 1px solid #222;
  }

  .lf__bar {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 24px;
  }

  .lf__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 11px;
    color: var(--solid-faint);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
