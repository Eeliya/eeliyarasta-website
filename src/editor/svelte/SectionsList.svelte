<!--
  The page's sections in the Content tab (src/site/layout/): each a panel Section ("Section N",
  and its name when it has one) with its settings (its name, the whole row, its #anchor shown
  under it; then side by side its minimum height as four quiet icon buttons: fit content, 1/3,
  1/2 or the full screen, its content always centred, and its width as two: contained or full
  width) and its blocks, in order (the order they stack in on
  phones). Sections and blocks can be added,
  moved, duplicated, deleted and turned on/off (layout-ops.js: one undo step each); a block
  opens in the block inspector (BlockInspector.svelte, onopen).
-->
<script>
  import { tick } from 'svelte';
  import { SLACK, dropTarget } from '../drag-target.js';
  import { locate } from '../locate.js';
  import AddSectionModal from './AddSectionModal.svelte';
  import Button from './Button.svelte';
  import Section from './Section.svelte';
  import SectionSettings from './SectionSettings.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { nameOf } from './content-groups.js';
  import {
    addBlock,
    addSection,
    duplicateBlock,
    duplicateSection,
    moveBlock,
    moveBlockTo,
    moveSection,
    removeBlock,
    removeSection,
    setSection,
  } from '../layout-ops.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';
  import { TEMPLATE, pageIdOf } from '../../site/files.js';

  let { live, bridge, file, onopen } = $props();
  let addModal = $state();
  let deleting = $state(''); // the id of the section or block asking "Delete?"

  // ---- a block's row dragged to another place (its own section's order, or another section):
  // it lifts and follows the pointer, a line shows where it lands; one undo step. A drag
  // isn't a click (no block opens). Alt+↑/↓ on a row moves it by one.
  let drag = $state(null); // { id, at, j, y, dy, moving, over: { at, to, line }, lists, … }
  // the rows' places when it starts (the lifted row moves; its own place still counts)
  const listsNow = () =>
    [...document.querySelectorAll('[data-list]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        at: Number(el.dataset.list),
        top: r.top,
        bottom: r.bottom,
        rows: [...el.querySelectorAll(':scope > [data-row]')].map((row) => {
          const b = row.getBoundingClientRect();
          return { top: b.top, bottom: b.bottom };
        }),
      };
    });
  // the sections and their blocks' ids: a drop only lands when they are as they were at the start
  const shape = () => sections.map((s) => (s.blocks || []).map((b) => b.id).join(',')).join('|');
  // the panel that scrolls the list (the nearest scrolling ancestor)
  function scrollerOf(el) {
    for (let n = el.parentElement; n; n = n.parentElement)
      if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight)
        return n;
    return document.scrollingElement;
  }
  const EDGE = 32; // px from the panel's top or bottom where a drag scrolls it
  const SPEED = 12; // px per frame at the very edge
  // only its handle starts a drag
  function grab(e, id, at, j) {
    if (e.button !== 0) return;
    e.preventDefault();
    const scroller = scrollerOf(e.currentTarget);
    drag = {
      id,
      at,
      j,
      y: e.clientY,
      py: e.clientY,
      dy: 0,
      moving: false,
      over: null,
      lists: listsNow(),
      shape: shape(),
      scroller,
      top0: scroller.scrollTop,
      raf: 0,
    };
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', drop, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    window.addEventListener('keydown', escape, true);
    scroller.addEventListener('scroll', place);
  }
  // where the pointer is on the rows as they were at the start: its y plus how far the panel scrolled
  function place() {
    if (!drag) return;
    const scrolled = drag.scroller.scrollTop - drag.top0;
    const dy = drag.py - drag.y + scrolled;
    if (!drag.moving && Math.abs(dy) < SLACK) return;
    drag.moving = true;
    drag.dy = dy;
    drag.over = dropTarget(drag.lists, drag, drag.py + scrolled);
  }
  function follow(e) {
    drag.py = e.clientY;
    place();
    if (drag.moving && !drag.raf) drag.raf = requestAnimationFrame(edge);
  }
  // near the panel's top or bottom edge: scroll it (faster the closer), every frame until away
  function edge() {
    if (!drag) return;
    drag.raf = 0;
    const s = drag.scroller;
    const r =
      s === document.scrollingElement ? { top: 0, bottom: innerHeight } : s.getBoundingClientRect();
    const v =
      drag.py < r.top + EDGE
        ? -Math.ceil(((r.top + EDGE - drag.py) / EDGE) * SPEED)
        : drag.py > r.bottom - EDGE
          ? Math.ceil(((drag.py - r.bottom + EDGE) / EDGE) * SPEED)
          : 0;
    if (!v) return;
    const before = s.scrollTop;
    s.scrollTop += Math.max(-SPEED, Math.min(SPEED, v));
    if (s.scrollTop !== before) drag.raf = requestAnimationFrame(edge);
  }
  function stop() {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', drop);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', escape, true);
    const d = drag;
    if (d) {
      d.scroller.removeEventListener('scroll', place);
      cancelAnimationFrame(d.raf);
    }
    drag = null;
    return d;
  }
  const cancel = () => stop();
  // Esc ends the drag before anything else hears it (capture: a panel or dialog stays open)
  function escape(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    stop();
  }
  // its own place (or no section's blocks under the pointer): nothing moves, no undo step; the
  // page changed under it (an undo, a redo): nothing moves either (the places are old)
  function drop() {
    const d = stop();
    if (!d?.moving || !d.over || d.shape !== shape()) return;
    if (sections[d.at]?.blocks?.[d.j]?.id !== d.id) return;
    moveBlockTo(live.store, file, d.at, d.j, d.over.at, d.over.to);
  }
  // the drop line's class on row j of section at
  const dropAt = (at, j) =>
    drag?.moving && drag.over?.at === at && drag.over.line.j === j
      ? `is-drop-${drag.over.line.side}`
      : '';
  async function nudge(e, at, j, n) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const to = j + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= n) return;
    moveBlock(live.store, file, at, j, to);
    await tick();
    document.querySelector(`[data-row="${at}:${to}"] .block__open`)?.focus();
  }

  // A copy, new after every edit, undo and redo: the store changes a section in place (its
  // `sections` array stays the same object), so the store's own array would leave the fields
  // below showing the old values (a Height picked: the preview changed, the select didn't).
  const sections = $derived.by(() => {
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  // the block types on offer: item types (the item of a [slug] page) only there
  const types = $derived(
    Object.values(BLOCK_TYPES)
      .filter((t) => !t.item || pageIdOf(file)?.endsWith(TEMPLATE))
      .map((t) => ({ value: t.type, label: t.label, icon: t.icon })),
  );

  const typeOf = (b) => BLOCK_TYPES[b?.type];
  const changed = (at, key) => live.changed(file, `/sections/${at}/${key}`);
  const set = (at, patch, key) => setSection(live.store, file, at, patch, key);
  function setBlockOn(at, j, on) {
    const b = sections[at].blocks[j];
    live.store.set(
      file,
      `/sections/${at}/blocks/${j}/config`,
      { ...b.config, enabled: on ? undefined : false },
      { source: 'panel' },
    );
  }

  function add(type) {
    deleting = '';
    if (type === '') addSection(live.store, file);
    else addSection(live.store, file, type);
  }

  // hover sync: a section row the pointer is over shows its section in the preview
  // (overlay.js); one hovered in the preview shows its row here (.is-peek)
  $effect(() => {
    const over = (e) => {
      const id = e.target.closest?.('[data-section^="s-"]')?.dataset.section || '';
      if (id) {
        if (ui.peek?.id !== id || ui.peek.from !== 'panel') ui.peek = { id, from: 'panel' };
      } else if (ui.peek?.from === 'panel') ui.peek = null;
    };
    const out = () => ui.peek?.from === 'panel' && (ui.peek = null);
    document.addEventListener('pointerover', over);
    document.documentElement.addEventListener('pointerleave', out);
    return () => {
      document.removeEventListener('pointerover', over);
      document.documentElement.removeEventListener('pointerleave', out);
      out();
    };
  });

  function addTo(at, type) {
    const b = addBlock(live.store, file, at, type);
    onopen(b.id);
  }
</script>

{#snippet confirm(what, run)}
  <div class="confirm" role="group" aria-label="Delete this {what}?">
    <span>Delete this {what}?</span>
    <Button
      size="small"
      variant="danger"
      icon="trash"
      onclick={() => {
        deleting = '';
        run();
      }}>Delete</Button
    >
    <Button size="small" onclick={() => (deleting = '')}>Cancel</Button>
  </div>
{/snippet}

{#each sections as s, at (s.id)}
  {@const last = at === sections.length - 1}
  <Section
    id={s.id}
    key="text:{file}#{s.id}"
    title={(typeof s.name === 'string' && s.name.trim()) || `Section ${at + 1}`}
    dim={!(typeof s.name === 'string' && s.name.trim())}
    off={s.enabled === false}
    changed={live.changed(file, `/sections/${at}`)}
    class={ui.peek?.from === 'preview' && ui.peek.id === s.id ? 'is-peek' : ''}
  >
    {#snippet bar()}
      <Button
        size="small"
        icon="location-crosshairs"
        iconOnly
        label="Show section {at + 1} in the preview"
        title="Show in preview"
        onclick={() => locate(bridge, s.id)}
      />
      <Button
        size="small"
        icon="arrow-up"
        iconOnly
        label="Move section {at + 1} up"
        disabled={at === 0}
        onclick={() => moveSection(live.store, file, at, at - 1)}
      />
      <Button
        size="small"
        icon="arrow-down"
        iconOnly
        label="Move section {at + 1} down"
        disabled={last}
        onclick={() => moveSection(live.store, file, at, at + 1)}
      />
      <Button
        size="small"
        icon="copy"
        iconOnly
        label="Duplicate section {at + 1}"
        onclick={() => duplicateSection(live.store, file, at)}
      />
      <Button
        size="small"
        icon="trash"
        iconOnly
        label="Delete section {at + 1}"
        onclick={() => (deleting = s.id)}
      />
      {#if changed(at, 'enabled')}{/if}
      <input
        type="checkbox"
        class="switch"
        aria-label="Show section {at + 1}"
        title={s.enabled === false ? 'Hidden on the public page' : 'Visible'}
        checked={s.enabled !== false}
        onchange={(e) => set(at, { enabled: e.currentTarget.checked ? undefined : false })}
      />
    {/snippet}

    {#if deleting === s.id}{@render confirm('section', () =>
        removeSection(live.store, file, at),
      )}{/if}

    <SectionSettings {live} {file} {at} {sections} />

    {#snippet foot()}
      <ul class="blocks" aria-label="Blocks of section {at + 1}" data-list={at}>
        {#each s.blocks || [] as b, j (b.id)}
          {@const label = typeOf(b)?.label || `Unknown type "${b.type}"`}
          <!-- the row takes Alt+↑/↓ (keys from its focused buttons); its handle the drag -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <li
            class={[
              'block',
              ui.block === b.id && 'is-active',
              b.config?.enabled === false && 'is-off',
              drag?.id === b.id && drag.moving && 'is-lifted',
              dropAt(at, j),
            ]}
            style:translate={drag?.id === b.id && drag.moving ? `0 ${drag.dy}px` : null}
            data-row="{at}:{j}"
            onkeydown={(e) => nudge(e, at, j, s.blocks.length)}
          >
            <span
              class="block__grip"
              title="Drag to move (Alt+↑/↓ on the row)"
              aria-hidden="true"
              onpointerdown={(e) => grab(e, b.id, at, j)}
              ><i class="fa-solid fa-grip-vertical"></i></span
            >
            <button
              type="button"
              class="block__open"
              title="Open {label} (Alt+↑/↓ moves it)"
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              onclick={() => onopen(b.id)}
            >
              {label}
            </button>
            <Button
              size="small"
              icon="copy"
              iconOnly
              label="Duplicate {label}"
              onclick={() => duplicateBlock(live.store, file, at, j)}
            />
            <Button
              size="small"
              icon="trash"
              iconOnly
              label="Delete {label}"
              onclick={() => (deleting = b.id)}
            />
            <input
              type="checkbox"
              class="switch"
              aria-label="Show {label}"
              checked={b.config?.enabled !== false}
              onchange={(e) => setBlockOn(at, j, e.currentTarget.checked)}
            />
            {#if nameOf(b)}
              <button type="button" class="block__title" tabindex="-1" onclick={() => onopen(b.id)}>
                {nameOf(b)}
              </button>
            {/if}
          </li>
          {#if deleting === b.id}{@render confirm('block', () =>
              removeBlock(live.store, file, at, j),
            )}{/if}
        {:else}
          <li class={['hint', 'small', dropAt(at, 0)]}>No blocks yet.</li>
        {/each}
      </ul>
      <Select
        aria-label="Add a block to section {at + 1}"
        value={null}
        placeholder="Add block…"
        options={types}
        onchange={(type) => addTo(at, type)}
      >
        {#snippet option(o)}
          <i class="fa-solid fa-{o.icon} type" aria-hidden="true"></i>{o.label}
        {/snippet}
      </Select>
    {/snippet}
  </Section>
{/each}

<button type="button" class="add" aria-haspopup="dialog" onclick={() => addModal.open()}>
  <i class="fa-solid fa-plus" aria-hidden="true"></i>Add section
</button>
<AddSectionModal
  bind:this={addModal}
  {types}
  after={sections.length ? `Section ${sections.length}` : ''}
  onpick={add}
/>

<style lang="scss">
  // the blocks, under the card's line (Section's foot)
  .blocks {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // [ Type          copy | trash | switch ]
  // [ its title, the whole width          ]
  .block {
    position: relative;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto auto auto;
    align-items: center;
    column-gap: var(--space-1);
    padding-right: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--c-surface-2);

    &.is-active {
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }

    &.is-off > button {
      color: var(--c-text-faint);
    }

    // lifted while dragged: above the others, following the pointer
    &.is-lifted {
      z-index: 2;
      background: var(--c-surface-3);
      box-shadow:
        inset 0 0 0 1px var(--c-accent),
        0 12px 28px -12px var(--c-scrim);
      cursor: grabbing;
    }

    // where it lands: a line in the gap above or below this row
    &.is-drop-before::before,
    &.is-drop-after::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      border-top: 2px solid var(--c-accent);
    }

    &.is-drop-before::before {
      top: -4px;
    }

    &.is-drop-after::after {
      bottom: -4px;
    }
  }

  .block__open,
  .block__title {
    min-width: 0;
    padding: 0 var(--space-2);
    overflow: hidden;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    font: inherit;
    font-size: var(--fs-base);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .block__open {
    height: var(--size-control);
    color: var(--c-text);

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }
  }

  // the drag handle, on the type's line; the title under the type
  .block__grip {
    display: grid;
    place-items: center;
    height: var(--size-control);
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
    cursor: grab;
    touch-action: none;
    grid-row: span 2;

    .is-lifted & {
      cursor: grabbing;
    }
  }

  .block__title {
    grid-column: 2 / -1;
    margin-bottom: var(--space-2);
    color: var(--c-link);
  }

  // a lifted row is drawn over the card's edge (its body clips it otherwise)
  :global(.sec__clip:has(.is-lifted)) {
    overflow: visible;
  }

  .hint.is-drop-before {
    box-shadow: inset 0 2px 0 var(--c-accent);
  }

  .confirm {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-base);

    span {
      flex: 1;
    }
  }

  // Add section: a dashed card the section cards' width (their -8px bleed), + and its name centred
  .add {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: calc(100% + 16px);
    height: 40px;
    margin-inline: -8px;
    border: 1px dashed var(--c-line);
    border-radius: var(--radius-lg);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      border-color: var(--c-accent);
      color: var(--c-text-strong);
      outline: none;
    }
  }

  .type {
    width: 16px;
    color: var(--c-text-muted);
    text-align: center;
  }
</style>
