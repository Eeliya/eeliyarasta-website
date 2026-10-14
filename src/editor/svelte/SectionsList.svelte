<!--
  The page's sections in the Content tab (src/site/layout/): each a panel Section in two rows
  (its title, "Section N" or its name in full; then its tools: Show, up, down, Duplicate,
  Delete and the switch at the right), then its blocks, in order (the order they stack in on
  phones), and a dashed Add block button (BlocksModal.svelte). No settings here: a section's
  name, height and width are in its block view (BlockInspector.svelte). Delete asks over the
  card at its size (its border red). The dashed Add section card adds an empty section after
  the last one. Sections and blocks can be added, moved, duplicated, deleted and turned on/off
  (layout-ops.js: one undo step each); a block opens in the block inspector (onopen).
-->
<script>
  import { tick } from 'svelte';
  import { locate } from '../locate.js';
  import BlocksModal from './BlocksModal.svelte';
  import Button from './Button.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { listDrag, rowsOf } from './list-drag.svelte.js';
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
  let blocksModal = $state();
  let deleting = $state(''); // the id of the section or block asking "Delete?"

  // ---- a block's row dragged to another place (its own section's order, or another section):
  // it lifts and follows the pointer, a line shows where it lands; one undo step. A drag
  // isn't a click (no block opens). Alt+↑/↓ on a row moves it by one.
  // (list-drag.svelte.js: every section's blocks one of its lists, the panel scrolls at its
  // edges; a drop lands only when the sections and their blocks are as they were at the start)
  const shape = () => sections.map((s) => (s.blocks || []).map((b) => b.id).join(',')).join('|');
  const ld = listDrag({
    lists: () =>
      [...document.querySelectorAll('[data-list]')].map((el) =>
        rowsOf(el, '[data-row]', Number(el.dataset.list)),
      ),
    shape,
    ondrop: (d) => {
      if (sections[d.at]?.blocks?.[d.j]?.id !== d.id) return;
      moveBlockTo(live.store, file, d.at, d.j, d.over.at, d.over.to);
    },
    edgeScroll: true,
  });
  const drag = $derived(ld.drag);
  // only its handle starts a drag
  const grab = (e, id, at, j) => ld.grab(e, { id, at, j });
  const dropAt = (j, at) => ld.dropAt(j, at);
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
      .map(({ type, label, icon, line, sketch }) => ({ value: type, label, icon, line, sketch })),
  );

  const typeOf = (b) => BLOCK_TYPES[b?.type];
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

  // Add section: an empty section after the last one, open and scrolled into view
  async function add() {
    deleting = '';
    addSection(live.store, file);
    await tick();
    const s = sections.at(-1);
    if (!s) return;
    ui.sections[`text:${file}#${s.id}`] = true;
    await tick();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .querySelector(`[data-section="${CSS.escape(s.id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
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

  // a section's delete confirm: Cancel takes the focus (Enter does not delete by accident)
  const focusCancel = (el) => el.querySelector('button')?.focus();

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
    stack
    danger={deleting === s.id}
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
      <input
        type="checkbox"
        class="switch"
        aria-label="Show section {at + 1}"
        title={s.enabled === false ? 'Hidden on the public page' : 'Visible'}
        checked={s.enabled !== false}
        onchange={(e) => set(at, { enabled: e.currentTarget.checked ? undefined : false })}
      />
    {/snippet}

    {#snippet over()}
      {#if deleting === s.id}
        {@const name = (typeof s.name === 'string' && s.name.trim()) || ''}
        <!-- over the card at its size: the question at the top, Cancel / Delete at the bottom -->
        <div
          class="ask"
          role="alertdialog"
          tabindex="-1"
          aria-label={name ? `Delete “${name}”?` : `Delete Section ${at + 1}?`}
          {@attach focusCancel}
          onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), (deleting = ''))}
        >
          <p class="ask__msg">{name ? `Delete “${name}”?` : `Delete Section ${at + 1}?`}</p>
          <div class="ask__btns">
            <Button size="small" onclick={() => (deleting = '')}>Cancel</Button>
            <Button
              size="small"
              variant="danger"
              icon="trash"
              onclick={() => {
                deleting = '';
                removeSection(live.store, file, at);
              }}>Delete</Button
            >
          </div>
        </div>
      {/if}
    {/snippet}

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
              dropAt(j, at),
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
          <li class={['hint', 'small', dropAt(0, at)]}>No blocks yet.</li>
        {/each}
      </ul>
      <button
        type="button"
        class="add add--block"
        aria-haspopup="dialog"
        aria-label="Add block to section {at + 1}"
        onclick={() => blocksModal.open(at)}
      >
        <i class="fa-solid fa-plus" aria-hidden="true"></i>Add block
      </button>
    {/snippet}
  </Section>
{/each}

<button type="button" class="add" onclick={add}>
  <i class="fa-solid fa-plus" aria-hidden="true"></i>Add section
</button>
<BlocksModal bind:this={blocksModal} {types} onpick={(type, at) => addTo(at, type)} />

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

  // a section's delete confirm, over its card at the card's size (no shift): the card's colour
  // at 80% hides what is under it; the question at the top, Cancel / Delete at the bottom, 8px in
  .ask {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2);
    overflow: auto;
    border-radius: inherit;
    background: color-mix(in srgb, var(--c-card) 80%, transparent);
  }

  .ask__msg {
    margin: 0;
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    line-height: 20px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .ask__btns {
    display: flex;
    flex: none;
    justify-content: flex-end;
    gap: var(--space-2);
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

  // a section's Add block: the same dashed card, the blocks' width (no bleed), 32px
  .add--block {
    width: 100%;
    height: 32px;
    margin-inline: 0;
  }
</style>
