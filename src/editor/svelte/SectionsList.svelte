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
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import Section from './Section.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { nameOf } from './content-groups.js';
  import {
    addBlock,
    addSection,
    duplicateBlock,
    duplicateSection,
    moveBlock,
    moveSection,
    removeBlock,
    removeSection,
    setSection,
  } from '../layout-ops.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';
  import {
    MAX_MIN_ROWS,
    anchorOf,
    heightOf,
    nameProblems,
    rowsOf,
  } from '../../site/layout/index.js';
  import { TEMPLATE, pageIdOf } from '../../site/files.js';

  let { live, file, onopen } = $props();
  let deleting = $state(''); // the id of the section or block asking "Delete?"

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
    if (key !== 'height') return set(at, { [key]: value });
    // custom: its rows to start from (its last ones, or its content's); others: none
    const s = sections[at];
    set(at, { height: value, minRows: value === 'custom' ? s.minRows || rowsOf(s) : undefined });
  };
  // a custom height's rows, typed: one undo step per field edit
  const setMinRows = (at, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const minRows = Math.min(MAX_MIN_ROWS, Math.max(1, Math.round(v)));
    set(at, { minRows }, `section:${file}#${at}/minRows`);
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
      { ...b.config, enabled: on },
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
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <rect class="frame" x="2.5" y="1.5" width="11" height="13" rx="1.5" />
    {#if band === 'edge'}
      <rect x="1" y="5.5" width="14" height="5" rx="0.5" />
    {:else}
      <rect x="5.5" y="5.5" width="5" height="5" rx="0.5" />
    {/if}
  </svg>
{/snippet}

<!-- a setting as a half field (.tf: the same label row as a Field) of quiet icon buttons, one
     picked: Height and Width. options: [value, label, its icon's argument] -->
{#snippet choices(at, key, title, options, now, icon)}
  {@const id = `${sections[at].id}-${key}`}
  <div
    class={['tf', 'is-half', changed(at, key) && 'is-changed']}
    data-edit="{file}#/sections/{at}/{key}"
  >
    <span class="tf__label" {id}>{title}<i class="dot" title="Changed"></i></span>
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
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    {#if share === 'rows'}
      <!-- custom: the screen with rows counted off, the top ones filled -->
      <rect class="frame" x="2.5" y="1.5" width="11" height="13" rx="1.5" />
      <rect x="4" y="3" width="8" height="5" rx="0.5" />
      <path class="frame" d="M4 10.5h8M4 12.5h8" />
    {:else if share}
      <rect class="frame" x="2.5" y="1.5" width="11" height="13" rx="1.5" />
      <rect x="4" y="3" width="8" height={10 * share} rx="0.5" />
    {:else}
      <rect x="4" y="6.5" width="8" height="3" rx="0.5" />
      <path class="frame" d="M2.5 4.5h11M2.5 11.5h11" />
    {/if}
  </svg>
{/snippet}

{#each sections as s, at (s.id)}
  {@const last = at === sections.length - 1}
  <Section
    id={s.id}
    key="text:{file}#{s.id}"
    icon="layer-group"
    title="Section {at + 1}"
    name={typeof s.name === 'string' ? s.name.trim() : ''}
    off={s.enabled === false}
    class={ui.peek?.from === 'preview' && ui.peek.id === s.id ? 'is-peek' : ''}
  >
    {#snippet bar()}
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
        onchange={(e) => set(at, { enabled: e.currentTarget.checked })}
      />
    {/snippet}

    {#if deleting === s.id}{@render confirm('section', () =>
        removeSection(live.store, file, at),
      )}{/if}

    <!-- Name (its #anchor under it) the whole row; then Height | Width, two halves -->
    <div class="fields">
      <Field
        edit="{file}#/sections/{at}/name"
        label="Name"
        placeholder="e.g. Our people"
        value={s.name ?? ''}
        help={hintOf(s, at)}
        changed={changed(at, 'name')}
        onvalue={(name) => setName(at, name)}
      />
      <!-- Height (a minimum; its content always centred) | Width: icon buttons, one picked -->
      {@render choices(at, 'height', 'Height', HEIGHTS, heightOf(s), heightIcon)}
      {@render choices(at, 'width', 'Width', WIDTHS, widthOf(s), widthIcon)}
      {#if heightOf(s) === 'custom'}
        <!-- custom: its rows (square cells, from the top; those below its last block are empty
             space; on phones half as many) -->
        <Field
          edit="{file}#/sections/{at}/minRows"
          label="Rows"
          type="number"
          half
          value={s.minRows ?? rowsOf(s)}
          help="Rows below the last block are space (phones: half)"
          changed={changed(at, 'minRows')}
          onvalue={(v) => setMinRows(at, v)}
        />
      {/if}
    </div>

    <ul class="blocks" aria-label="Blocks of section {at + 1}">
      {#each s.blocks || [] as b, j (b.id)}
        {@const t = typeOf(b)}
        {@const label = t?.label || `Unknown type "${b.type}"`}
        <li
          class={[
            'block',
            ui.block === b.id && 'is-active',
            b.config?.enabled === false && 'is-off',
          ]}
        >
          <button type="button" class="block__open" onclick={() => onopen(b.id)}>
            <i class="fa-solid fa-{t?.icon || 'question'}" aria-hidden="true"></i>
            <span>{label}</span>
            <strong>{nameOf(b)}</strong>
          </button>
          <Button
            size="small"
            icon="arrow-up"
            iconOnly
            label="Move {label} up"
            disabled={j === 0}
            onclick={() => moveBlock(live.store, file, at, j, j - 1)}
          />
          <Button
            size="small"
            icon="arrow-down"
            iconOnly
            label="Move {label} down"
            disabled={j === s.blocks.length - 1}
            onclick={() => moveBlock(live.store, file, at, j, j + 1)}
          />
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
        </li>
        {#if deleting === b.id}{@render confirm('block', () =>
            removeBlock(live.store, file, at, j),
          )}{/if}
      {:else}
        <li class="hint small">No blocks yet.</li>
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
  .fields {
    margin-bottom: 12px;
  }

  // a utility group: icon-only, no fill; the picked one in the accent, on a faint ground
  // 32px tall, like the inputs (4 + 24 + 4), its buttons sharing the half's width
  .hset {
    display: flex;
    gap: 4px;
    height: 32px;
    padding: 4px;
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--line);
    justify-self: start;
  }

  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    height: 24px;
    width: 36px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--muted);
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;

    &:hover {
      color: var(--fg);
    }

    &.is-active {
      background: rgb(255 255 255 / 0.08);
      color: var(--ed-accent);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }

    svg {
      fill: currentcolor;
    }

    .frame {
      fill: none;
      stroke: currentcolor;
      stroke-width: 1;
      opacity: 0.55;
    }
  }

  .blocks {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .block {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding-right: 4px;
    border-radius: 8px;
    background: #141414;

    &.is-active {
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }

    &.is-off .block__open {
      color: var(--faint);
    }
  }

  .block__open {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--fg);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;

    span {
      flex: none;
    }

    strong {
      overflow: hidden;
      color: var(--hi);
      font-weight: 400;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    i {
      width: 16px;
      color: var(--muted);
      text-align: center;
    }

    &:hover {
      background: #1c1c1c;
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }
  }

  .confirm {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;

    span {
      flex: 1;
    }
  }

  .add {
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  .type {
    width: 16px;
    color: var(--muted);
    text-align: center;
  }
</style>
