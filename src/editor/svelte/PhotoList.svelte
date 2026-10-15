<!--
  A list of photos (a block's list whose items have a photo, e.g. the Hero's): each item its
  photo card (Field.svelte's, 64px) and its other fields under it, the photo the drag handle (and a click on it
  opens Media), ✕ removes it; Add at the end. No ↑ / ↓: drag it, or Alt+↑/↓ on a focused card.
  The drag as the block rows' (SectionsList.svelte): a press moves SLACK px to be a drag, a
  line shows where it lands, letting go at its own place moves nothing, Esc cancels, and a
  drag isn't a click (Media doesn't open). One undo step (the parent's onmove).
    label, items (each item's fields), addLabel, onmove(from, to), onremove(i), onadd()
    row       snippet (fields, i, { grab, remove }): the item's photo Field (given those), its other fields
-->
<script>
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import { listDrag, rowsOf } from './list-drag.svelte.js';

  let { label, items = [], addLabel = 'Add photo', onmove, onremove, onadd, row } = $props();
  const uid = $props.id();

  let list = $state();
  // the drag (list-drag.svelte.js); its thumbnail's click opens Media, so a drag swallows it
  const ld = listDrag({
    lists: () => [rowsOf(list, '[data-prow]')],
    shape: () => String(items.length),
    ondrop: (d) => onmove(d.j, d.over.to),
    scroller: () => list,
    grabbing: true,
    swallowClick: true,
  });
  const drag = $derived(ld.drag);
  const grab = (e, j) => ld.grab(e, { j });
  const dropAt = (j) => ld.dropAt(j);

  async function nudge(e, j) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const to = j + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= items.length) return;
    onmove(j, to);
    await tick();
    list.querySelector(`[data-prow="${to}"] .photo__thumb`)?.focus();
  }
</script>

<div class="pl" role="group" aria-labelledby="{uid}-label">
  <span class="tf__label" id="{uid}-label">{label}</span>
  <div class="pl__list" bind:this={list}>
    {#each items as fields, i (i)}
      <!-- the card takes Alt+↑/↓ (keys from its focused buttons); its thumbnail the drag -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class={['pl__row', drag?.j === i && drag.moving && 'is-lifted', dropAt(i)]}
        style:translate={drag?.j === i && drag.moving ? `0 ${drag.dy}px` : null}
        data-prow={i}
        onkeydown={(e) => nudge(e, i)}
      >
        {@render row(fields, i, { grab: (e) => grab(e, i), remove: () => onremove(i) })}
      </div>
    {/each}
  </div>
  <Button size="small" icon="plus" onclick={onadd}>{addLabel}</Button>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .pl {
    @include stack(var(--space-2));
    justify-items: start;

    > .pl__list {
      justify-self: stretch;
    }
  }

  // items apart (an item's own fields, e.g. a Link, sit 8px under its photo)
  .pl__list {
    @include stack(var(--space-4));
  }

  .pl__row {
    position: relative;
    @include stack(var(--space-2));
    border-radius: var(--radius-md);

    // lifted while dragged: above the others, following the pointer
    &.is-lifted {
      z-index: 2;
      box-shadow:
        0 0 0 1px var(--c-accent),
        0 12px 28px -12px var(--c-scrim);
    }

    // where it lands: a line in the gap above or below this card
    &.is-drop-before::before,
    &.is-drop-after::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      border-top: 2px solid var(--c-accent);
    }

    &.is-drop-before::before {
      top: -8px;
    }

    &.is-drop-after::after {
      bottom: -8px;
    }
  }

  :global(html.is-grabbing),
  :global(html.is-grabbing *) {
    cursor: grabbing !important;
  }
</style>
