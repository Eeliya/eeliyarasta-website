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
  import { SLACK, dropTarget } from '../drag-target.js';

  let { label, items = [], addLabel = 'Add photo', onmove, onremove, onadd, row } = $props();
  const uid = $props.id();

  let drag = $state(null); // { j, y, py, dy, moving, over, lists, n, scroller, top0 }
  let list = $state();

  const listsNow = () => {
    const r = list.getBoundingClientRect();
    return [
      {
        at: 0,
        top: r.top,
        bottom: r.bottom,
        rows: [...list.querySelectorAll(':scope > [data-prow]')].map((el) => {
          const b = el.getBoundingClientRect();
          return { top: b.top, bottom: b.bottom };
        }),
      },
    ];
  };
  function scrollerOf(el) {
    for (let n = el.parentElement; n; n = n.parentElement)
      if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight)
        return n;
    return document.scrollingElement;
  }

  function grab(e, j) {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection; the click (open Media) still comes when it isn't a drag
    const scroller = scrollerOf(list);
    drag = {
      j,
      y: e.clientY,
      py: e.clientY,
      dy: 0,
      moving: false,
      over: null,
      lists: listsNow(),
      n: items.length,
      scroller,
      top0: scroller.scrollTop,
    };
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', drop, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    window.addEventListener('keydown', escape, true);
    scroller.addEventListener('scroll', place);
  }
  function place() {
    if (!drag) return;
    const scrolled = drag.scroller.scrollTop - drag.top0;
    const dy = drag.py - drag.y + scrolled;
    if (!drag.moving && Math.abs(dy) < SLACK) return;
    if (!drag.moving) document.documentElement.classList.add('is-grabbing');
    drag.moving = true;
    drag.dy = dy;
    drag.over = dropTarget(drag.lists, { at: 0, j: drag.j }, drag.py + scrolled);
  }
  function follow(e) {
    drag.py = e.clientY;
    place();
  }
  function stop() {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', drop);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', escape, true);
    document.documentElement.classList.remove('is-grabbing');
    const d = drag;
    d?.scroller.removeEventListener('scroll', place);
    drag = null;
    if (d?.moving) {
      // a drag isn't a click: the thumbnail's click (open Media) that follows is swallowed
      const swallow = (e) => (e.stopPropagation(), e.preventDefault());
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true));
    }
    return d;
  }
  const cancel = () => stop();
  function escape(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    stop();
  }
  // its own place: nothing moves; the list changed under it (an undo): nothing either
  function drop() {
    const d = stop();
    if (!d?.moving || !d.over || d.n !== items.length) return;
    onmove(d.j, d.over.to);
  }
  const dropAt = (j) =>
    drag?.moving && drag.over?.line.j === j ? `is-drop-${drag.over.line.side}` : '';

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
  .pl {
    display: grid;
    gap: var(--space-2);
    justify-items: start;

    > .pl__list {
      justify-self: stretch;
    }
  }

  // items apart (an item's own fields, e.g. a Link, sit 8px under its photo)
  .pl__list {
    display: grid;
    gap: var(--space-4);
  }

  .pl__row {
    position: relative;
    display: grid;
    gap: var(--space-2);
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
