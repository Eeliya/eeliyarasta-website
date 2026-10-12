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
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import Section from './Section.svelte';
  import SectionIcon from './SectionIcon.svelte';
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
    setPhoneHeight,
    setSection,
    setSectionRows,
  } from '../layout-ops.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';
  import {
    anchorOf,
    heightOf,
    mobileMinRowsOf,
    phoneHeightOf,
    nameProblems,
    rowsOf,
  } from '../../site/layout/index.js';
  import { TEMPLATE, pageIdOf } from '../../site/files.js';

  let { live, bridge, file, onopen } = $props();
  // Locate: the preview scrolls (smoothly) to the section's top; nothing opens or is selected
  function locate(id) {
    const el = bridge?.doc?.querySelector(`[data-sec="${CSS.escape(id)}"]`);
    const win = el?.ownerDocument.defaultView;
    if (!win) return;
    // (below the site's fixed header, so the section's top isn't under it)
    const head = [...el.ownerDocument.querySelectorAll('body > header, .site-header')].find((h) =>
      ['fixed', 'sticky'].includes(win.getComputedStyle(h).position),
    );
    const still = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    win.scrollTo({
      top: el.getBoundingClientRect().top + win.scrollY - (head?.offsetHeight || 0),
      behavior: still ? 'instant' : 'smooth',
    });
  }
  let deleting = $state(''); // the id of the section or block asking "Delete?"

  // ---- a block's row dragged to another place (its own section's order, or another section):
  // it lifts and follows the pointer, a line shows where it lands; one undo step. A drag
  // isn't a click (no block opens). Alt+↑/↓ on a row moves it by one.
  let drag = $state(null); // { id, at, j, y, dy, moving, over: { at, j, side } }
  let dragged = false; // the click after a drag
  function grab(e, id, at, j) {
    if (e.button !== 0 || e.target.closest('input, .btn')) return;
    drag = { id, at, j, y: e.clientY, dy: 0, moving: false, over: null };
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', drop, { once: true });
    window.addEventListener('pointercancel', drop, { once: true });
  }
  function follow(e) {
    const dy = e.clientY - drag.y;
    if (!drag.moving && Math.abs(dy) < 4) return;
    drag.moving = true;
    drag.dy = dy;
    drag.over = targetAt(e.clientY);
  }
  // where a block let go at y lands: before or after the nearest other row (or in an empty list)
  function targetAt(y) {
    let best = null;
    for (const el of document.querySelectorAll('[data-row]')) {
      const [at, j] = el.dataset.row.split(':').map(Number);
      if (at === drag.at && j === drag.j) continue;
      const r = el.getBoundingClientRect();
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (!best || d < best.d)
        best = { d, at, j, side: y < r.top + r.height / 2 ? 'before' : 'after' };
    }
    for (const el of document.querySelectorAll('[data-list]')) {
      if (el.querySelector('[data-row]')) continue;
      const r = el.getBoundingClientRect();
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (!best || d < best.d) best = { d, at: Number(el.dataset.list), j: 0, side: 'before' };
    }
    return best;
  }
  function drop() {
    window.removeEventListener('pointermove', follow);
    const d = drag;
    drag = null;
    if (!d?.moving) return;
    dragged = true;
    setTimeout(() => (dragged = false));
    const o = d.over;
    if (!o) return;
    let to = o.j + (o.side === 'after' ? 1 : 0);
    if (o.at === d.at && d.j < to) to--; // its own place is gone from the list
    if (o.at !== d.at || to !== d.j) moveBlockTo(live.store, file, d.at, d.j, o.at, to);
  }
  // the drop line's class on row j of section at
  const dropAt = (at, j) =>
    drag?.moving && drag.over?.at === at && drag.over.j === j ? `is-drop-${drag.over.side}` : '';
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

  // [value, label (its tooltip and aria-label), the share of the screen its icon fills]
  const HEIGHTS = [
    ['custom', 'Custom: a number of rows (space below the blocks)', 'rows'],
    ['fit', 'Fit content: as tall as its blocks', 0],
    ['third', 'At least 1/3 of the screen', 1 / 3],
    ['half', 'At least 1/2 of the screen', 1 / 2],
    ['full', 'At least the full screen', 1],
  ];
  // [value, label (its tooltip and aria-label), its icon's band: inside the frame or edge to edge]
  const WIDTHS = [
    ['contained', 'Contained: inside the page margins', 'inside'],
    ['full', 'Full width: edge to edge', 'edge'],
  ];
  const widthOf = (s) => (s.width === 'full' ? 'full' : 'contained');

  const typeOf = (b) => BLOCK_TYPES[b?.type];
  const changed = (at, key) => live.changed(file, `/sections/${at}/${key}`);
  const set = (at, patch, key) => setSection(live.store, file, at, patch, key);
  // Height and Width: one picked of a group (only a change is written: one undo step)
  const pick = (at, key, value, now) => {
    if (value === now) return;
    if (key === 'phoneHeight') return setPhoneHeight(live.store, file, at, value);
    if (key !== 'height') return set(at, { [key]: value });
    // custom: its rows to start from (its last ones, or its content's); others: none
    const s = sections[at];
    // (its own phone rows go when the phone isn't custom then: setSection)
    set(at, {
      height: value,
      rows: value === 'custom' ? { min: s.rows?.min || rowsOf(s) } : undefined,
    });
  };
  // the phone preview shows and edits a custom height's own phone rows (phone.rows.min)
  const phoneView = $derived(ui.viewport === 'mobile');
  const rowsShown = (s) =>
    ui.secRows?.id === s.id
      ? ui.secRows.rows
      : phoneView
        ? mobileMinRowsOf(s)
        : (s.rows?.min ?? rowsOf(s));
  // a custom height's rows, typed: one undo step per field edit
  const setMinRows = (at, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    setSectionRows(live.store, file, at, v, {
      phone: phoneView,
      key: `section:${file}#${at}/${phoneView ? 'mobile/' : ''}rows/min`,
    });
  };
  // its name: empty removes it (no anchor)
  const setName = (at, name) =>
    set(at, { name: String(name ?? '').trim() ? name : undefined }, `section:${file}#${at}/name`);
  // what is wrong with each name (unique on the page, a letter first …), as the site checks it
  const problems = $derived(nameProblems(sections));
  const anchors = $derived(sections.map((s) => anchorOf(s.name)));
  const hintOf = (s, at) => {
    if (problems[at]) return `⚠ ${problems[at]}`;
    const a = anchors[at];
    // the first of two alike (the site flags the later one): flagged here too
    const twin = a ? anchors.findIndex((b, i) => i !== at && b === a) : -1;
    if (twin >= 0) return `⚠ #${a} is also section ${twin + 1}'s anchor`;
    return a ? `#${a}` : 'Optional: a #link to this section';
  };

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

<!-- a height's icon: the screen (a frame) and the share of it the section is at least (filled,
     from the top); fit: a bar hugged by two lines (as tall as its content) -->
<!-- a width's icon: the screen (a frame) and a band across its middle, narrower and centred
     (contained: inside the page margins) or from edge to edge (full width) -->
{#snippet widthIcon(band)}
  <SectionIcon kind="width" arg={band} />
{/snippet}

<!-- a setting as a half field (.tf: the same label row as a Field) of quiet icon buttons, one
     picked: Height and Width. options: [value, label, its icon's argument] -->
{#snippet choices(at, key, title, options, now, icon, reset = null)}
  {@const id = `${sections[at].id}-${key}`}
  {@const ptr = key === 'phoneHeight' ? 'mobile/height' : key}
  <div
    class={['tf', 'is-half', changed(at, ptr) && 'is-changed']}
    data-edit="{file}#/sections/{at}/{ptr}"
  >
    <span class="tf__label" {id}
      >{title}<i class="dot" title="Changed"></i>
      {#if reset}
        <!-- its own phone height: back to the desktop's -->
        <button
          type="button"
          class="hreset"
          title="Reset phone height (follow the desktop)"
          aria-label="Reset phone height"
          disabled={!reset.on}
          onclick={reset.run}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button
        >
      {/if}</span
    >
    <div class="hset" role="radiogroup" aria-labelledby={id}>
      {#each options as [value, label, arg] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={now === value}
          aria-label={label}
          title={label}
          class={['hset__btn', now === value && 'is-active']}
          onclick={() => pick(at, key, value, now)}
        >
          {@render icon(arg)}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet heightIcon(share)}
  <SectionIcon kind="height" arg={share} />
{/snippet}

{#each sections as s, at (s.id)}
  {@const last = at === sections.length - 1}
  <Section
    id={s.id}
    key="text:{file}#{s.id}"
    title={(typeof s.name === 'string' && s.name.trim()) || `Section ${at + 1}`}
    dim={!(typeof s.name === 'string' && s.name.trim())}
    off={s.enabled === false}
    class={ui.peek?.from === 'preview' && ui.peek.id === s.id ? 'is-peek' : ''}
  >
    {#snippet bar()}
      <Button
        size="small"
        icon="location-crosshairs"
        iconOnly
        label="Show section {at + 1} in the preview"
        title="Show in preview"
        onclick={() => locate(s.id)}
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
      {#if changed(at, 'enabled')}<i class="dot" title="Changed"></i>{/if}
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

    <!-- Name (no label: its placeholder says it; its #anchor under it) the whole row; then Height | Width, two halves -->
    <div class="fields">
      <Field
        edit="{file}#/sections/{at}/name"
        label="Name"
        bare
        placeholder="Name"
        value={s.name ?? ''}
        help={hintOf(s, at)}
        changed={changed(at, 'name')}
        onvalue={(name) => setName(at, name)}
      />
      <!-- Height (a minimum; its content always centred) | Width: icon buttons, one picked -->
      {#if phoneView}
        <!-- the phone preview: its phone height (its own, else the desktop's) -->
        {@render choices(
          at,
          'phoneHeight',
          s.phone?.height ? 'Phone height' : 'Phone height (desktop)',
          HEIGHTS,
          phoneHeightOf(s),
          heightIcon,
          {
            on: !!s.phone?.height,
            run: () => setPhoneHeight(live.store, file, at, undefined),
          },
        )}
      {:else}
        {@render choices(at, 'height', 'Height', HEIGHTS, heightOf(s), heightIcon)}
      {/if}
      {@render choices(at, 'width', 'Width', WIDTHS, widthOf(s), widthIcon)}
      {#if (phoneView ? phoneHeightOf(s) : heightOf(s)) === 'custom'}
        <!-- custom: its rows (square cells, from the top; those below its last block are empty
             space; on phones half as many) -->
        <Field
          edit="{file}#/sections/{at}/{phoneView ? 'mobile/' : ''}rows/min"
          label={phoneView ? 'Phone rows' : 'Rows'}
          type="number"
          half
          value={rowsShown(s)}
          help={phoneView
            ? 'Phone only; unset: half the desktop rows'
            : 'Rows below the last block are space (phones: their own, or half)'}
          changed={changed(at, phoneView ? 'mobile/rows/min' : 'rows/min')}
          onvalue={(v) => setMinRows(at, v)}
        />
      {/if}
    </div>

    {#snippet foot()}
      <ul class="blocks" aria-label="Blocks of section {at + 1}" data-list={at}>
        {#each s.blocks || [] as b, j (b.id)}
          {@const label = typeOf(b)?.label || `Unknown type "${b.type}"`}
          <!-- the row takes the drag and Alt+↑/↓ (keys from its focused buttons) -->
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
            onpointerdown={(e) => grab(e, b.id, at, j)}
            onkeydown={(e) => nudge(e, at, j, s.blocks.length)}
          >
            <button
              type="button"
              class="block__open"
              title="Open {label} (drag to reorder; Alt+↑/↓ moves it)"
              onclick={(e) => (dragged ? e.preventDefault() : onopen(b.id))}
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
              <button
                type="button"
                class="block__title"
                tabindex="-1"
                onclick={(e) => (dragged ? e.preventDefault() : onopen(b.id))}
              >
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

<div class="add">
  <Select
    aria-label="Add section"
    value={null}
    placeholder="Add section…"
    options={[{ value: '', label: 'Empty section', icon: 'square' }, ...types]}
    onchange={add}
  >
    {#snippet option(o)}
      <i class="fa-solid fa-{o.icon} type" aria-hidden="true"></i>{o.label}
    {/snippet}
  </Select>
</div>

<style lang="scss">
  // the settings, then the blocks
  // the name's #anchor hint at its right, under it
  .fields > :global(:first-child .tf__help) {
    text-align: right;
  }

  // a utility group: icon-only, no fill; the picked one in the accent, on a faint ground
  // 32px tall, like the inputs (4 + 24 + 4), its buttons sharing the half's width
  .hset {
    display: flex;
    gap: var(--space-1);
    height: var(--size-control);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--c-line);
    justify-self: start;
  }

  // the phone height's reset: a quiet icon in its label row
  .hreset {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-left: var(--space-1);
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--c-text);
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }
  }

  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    height: 24px;
    width: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;

    &:hover {
      color: var(--c-text);
    }

    &.is-active {
      background: var(--c-fill-active);
      color: var(--c-accent);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }
  }

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
    grid-template-columns: minmax(0, 1fr) auto auto auto;
    align-items: center;
    column-gap: var(--space-1);
    padding-right: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--c-surface-2);
    touch-action: none;
    user-select: none;

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

  .block__title {
    grid-column: 1 / -1;
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

  .add {
    padding-top: var(--space-3);
    border-top: 1px solid var(--c-line);
  }

  .type {
    width: 16px;
    color: var(--c-text-muted);
    text-align: center;
  }
</style>
