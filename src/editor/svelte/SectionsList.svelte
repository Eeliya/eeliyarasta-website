<!--
  The page's sections in the Content tab (src/site/layout/): each a panel Section ("Section N",
  and its name when it has one) with its settings (its name, the whole row, its #anchor shown
  under it; then side by side its minimum height as four quiet icon buttons: fit content, 1/3,
  1/2 or the full screen, its content always centred, and its width) and its blocks, in order (the order they stack in on
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
  import { anchorOf, heightOf, nameProblems } from '../../site/layout/index.js';
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
    ['fit', 'Fit content: as tall as its blocks', 0],
    ['third', 'At least 1/3 of the screen', 1 / 3],
    ['half', 'At least 1/2 of the screen', 1 / 2],
    ['full', 'At least the full screen', 1],
  ];
  const WIDTHS = [
    ['contained', 'Contained'],
    ['full', 'Full width'],
  ];

  const typeOf = (b) => BLOCK_TYPES[b?.type];
  const changed = (at, key) => live.changed(file, `/sections/${at}/${key}`);
  const set = (at, patch, key) => setSection(live.store, file, at, patch, key);
  const setHeight = (at, height) => {
    if (height !== heightOf(sections[at])) set(at, { height });
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
{#snippet heightIcon(share)}
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    {#if share}
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
      <!-- Height (a minimum; its content always centred): quiet icon buttons, one picked; a
           half field like Width (.tf: the same label row) -->
      <div
        class={['tf', 'is-half', changed(at, 'height') && 'is-changed']}
        data-edit="{file}#/sections/{at}/height"
      >
        <span class="tf__label" id="{s.id}-height">Height<i class="dot" title="Changed"></i></span>
        <div class="hset" role="radiogroup" aria-labelledby="{s.id}-height">
          {#each HEIGHTS as [id, label, share] (id)}
            <button
              type="button"
              role="radio"
              aria-checked={heightOf(s) === id}
              aria-label={label}
              title={label}
              class={['hset__btn', heightOf(s) === id && 'is-active']}
              onclick={() => setHeight(at, id)}
            >
              {@render heightIcon(share)}
            </button>
          {/each}
        </div>
      </div>
      <Field
        edit="{file}#/sections/{at}/width"
        label="Width"
        type="select"
        half
        options={WIDTHS}
        value={s.width || 'contained'}
        changed={changed(at, 'width')}
        onvalue={(width) => set(at, { width })}
      />
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
  }

  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    min-width: 0;
    height: 24px;
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
