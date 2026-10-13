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
    extra     snippet (item, i): more buttons in the item's bar
-->
<script>
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import { SLACK, dropTarget } from '../drag-target.js';

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

  let drag = $state(null); // { j, y, py, dy, moving, over, lists, n, scroller, top0 }
  let list = $state();

  const listsNow = () => {
    const r = list.getBoundingClientRect();
    const rows = [...list.querySelectorAll(':scope > [data-lrow]')].map((el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom };
    });
    return [{ at: 0, top: r.top, bottom: r.bottom, rows }];
  };
  function scrollerOf(el) {
    for (let n = el.parentElement; n; n = n.parentElement)
      if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight)
        return n;
    return document.scrollingElement;
  }

  function grab(e, j) {
    if (e.button !== 0) return;
    e.preventDefault();
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
    const dy = drag.py - drag.y + drag.scroller.scrollTop - drag.top0;
    if (!drag.moving && Math.abs(dy) < SLACK) return;
    if (!drag.moving) document.documentElement.classList.add('is-grabbing');
    drag.moving = true;
    drag.dy = dy;
    drag.over = dropTarget(
      drag.lists,
      { at: 0, j: drag.j },
      drag.py + drag.scroller.scrollTop - drag.top0,
    );
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
          {@render extra?.(it, i)}
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
