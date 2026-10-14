<!--
  A list in a panel: each item in a box with a grip (its drag handle), its name and Remove, its
  fields below (the `item` snippet), and an Add button at the end. Drag the grip, or Alt+↑/↓ in
  the item, to move it: the drag as PhotoList's (a press moves SLACK px to be a drag, a line
  shows where it lands, its own place moves nothing, Esc cancels). The parent owns the data and makes each
  change one undo step. Used for the list fields of sections (Content: hero photos, facts,
  panels, ...) and the header's menu (Content > Header, nested for sub-items).
    label     the list's name, on top
    items     the list
    name      (item, i) → an item's name (default "<label> <n>")
    addLabel  the Add button's text
    onmove(from, to), onremove(i), onadd()
    item      snippet (item, i): the item's fields
-->
<script>
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import { listDrag, rowsOf } from './list-drag.svelte.js';

  let {
    label,
    items = [],
    name = (_, i) => `${label} ${i + 1}`,
    addLabel = 'Add',
    onmove,
    onremove,
    onadd,
    item,
  } = $props();

  let list = $state();
  // the drag (list-drag.svelte.js); a list in an item has its own
  const ld = listDrag({
    lists: () => [rowsOf(list, '[data-lrow]')],
    shape: () => String(items.length),
    ondrop: (d) => onmove(d.j, d.over.to),
    scroller: () => list,
    grabbing: true,
  });
  const drag = $derived(ld.drag);
  const grab = (e, j) => ld.grab(e, { j });
  const dropAt = (j) => ld.dropAt(j);

  async function nudge(e, j) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    e.stopPropagation(); // a list in an item: only the innermost moves
    const to = j + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= items.length) return;
    onmove(j, to);
    await tick();
    list.querySelector(`:scope > [data-lrow="${to}"] .lf__grip`)?.focus();
  }
</script>

<div class="lf" role="group" aria-label={label}>
  <span class="tf__label">{label}</span>
  <div class="lf__list" bind:this={list}>
    {#each items as it, i (i)}
      <!-- the item takes Alt+↑/↓ (keys from its focused fields and buttons); its grip the drag -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class={['lf__item', drag?.j === i && drag.moving && 'is-lifted', dropAt(i)]}
        style:translate={drag?.j === i && drag.moving ? `0 ${drag.dy}px` : null}
        data-lrow={i}
        onkeydown={(e) => nudge(e, i)}
      >
        <div class="lf__bar">
          <button
            type="button"
            class="lf__grip"
            aria-label="Move: {name(it, i)} (drag, or Alt+↑/↓)"
            title="Drag to move (or Alt+↑/↓)"
            onpointerdown={(e) => grab(e, i)}
            ><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></button
          >
          <span class="lf__name">{name(it, i)}</span>
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
  </div>
  <Button size="small" icon="plus" onclick={onadd}>{addLabel}</Button>
</div>

<style lang="scss">
  .lf {
    display: grid;
    gap: var(--space-2);
    justify-items: start;

    > :global(*) {
      justify-self: stretch;
    }

    > :global(.btn) {
      justify-self: start;
    }
  }

  .lf__list {
    display: grid;
    gap: var(--space-2);
  }

  .lf__item {
    position: relative;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-xl);
    border: 1px solid var(--c-line-strong);
  }

  // lifted while dragged: above the others, following the pointer (no size change)
  .lf__item.is-lifted {
    z-index: 2;
    background: var(--c-card);
    box-shadow:
      0 0 0 1px var(--c-accent),
      0 12px 28px -12px var(--c-scrim);
  }

  // where it lands: a line in the gap above or below this item
  .lf__item.is-drop-before::before,
  .lf__item.is-drop-after::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    border-top: 2px solid var(--c-accent);
  }

  .lf__item.is-drop-before::before {
    top: -4px;
  }

  .lf__item.is-drop-after::after {
    bottom: -4px;
  }

  // the grip: the drag handle, a quiet 24px icon button
  .lf__grip {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-faint);
    cursor: grab;
    touch-action: none;

    &:hover,
    &:focus-visible {
      color: var(--c-text);
      outline: none;
    }

    &:focus-visible {
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }
  }

  .lf__bar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 24px;
  }

  .lf__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: var(--fs-sm);
    color: var(--c-text-dim);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
