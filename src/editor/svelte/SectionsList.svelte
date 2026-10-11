<!--
  The page's sections in the Content tab (src/site/layout/): each a panel Section with its
  settings (height in rows or fullscreen with its alignment, width, row height, space above and
  below) and
  its blocks, in order (the order they stack in on phones). Sections and blocks can be added,
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
    ASPECTS,
    ROW_HEIGHT,
    ROW_MAX,
    ROW_MIN,
    rowHeightOf,
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

  const HEIGHTS = [
    ['auto', 'Rows'],
    ['screen', 'Fullscreen'],
    ['aspect', 'Aspect ratio'],
  ];
  const RATIOS = ASPECTS.map((a) => [a, a]);
  const ALIGNS = [
    ['top', 'Top'],
    ['center', 'Center'],
    ['bottom', 'Bottom'],
    ['stretch', 'Fill'],
  ];
  const WIDTHS = [
    ['contained', 'Contained'],
    ['full', 'Full width'],
  ];

  const typeOf = (b) => BLOCK_TYPES[b?.type];
  const nameOfSection = (s) => (s.blocks || []).map(nameOf).find(Boolean) || '';
  const changed = (at, key) => live.changed(file, `/sections/${at}/${key}`);
  const set = (at, patch, key) => setSection(live.store, file, at, patch, key);
  const whole = (v, min) => Math.max(min, Math.round(v));
  // the height of the section's rows, in px (8 is stored as nothing)
  const rowHeight = (at, v) => {
    const px = Math.min(ROW_MAX, whole(v, ROW_MIN));
    set(at, { rowHeight: px === ROW_HEIGHT ? undefined : px }, `section:${file}#${at}/rowHeight`);
  };
  const spacing = (s, key, v) => {
    const at = sections.indexOf(s);
    set(at, { spacing: { ...s.spacing, [key]: whole(v, 0) } }, `section:${file}#${at}/${key}`);
  };
  // the phone's spacing (below 760px): the desktop's until set
  const phoneSpacing = (s, key, v) => {
    const at = sections.indexOf(s);
    const now = { top: s.spacing?.top ?? 0, bottom: s.spacing?.bottom ?? 0, ...s.mobile?.spacing };
    set(
      at,
      { mobile: { ...s.mobile, spacing: { ...now, [key]: whole(v, 0) } } },
      `section:${file}#${at}/mobile/${key}`,
    );
  };
  function sameOnPhone(s) {
    const at = sections.indexOf(s);
    const { spacing: _, ...rest } = s.mobile || {}; // eslint-disable-line no-unused-vars
    set(at, { mobile: Object.keys(rest).length ? rest : undefined });
  }
  const setHeight = (at, height) =>
    set(at, { height, aspect: height === 'aspect' ? sections[at].aspect || '16:9' : undefined });

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

{#each sections as s, at (s.id)}
  {@const last = at === sections.length - 1}
  <Section
    id={s.id}
    key="text:{file}#{s.id}"
    icon="layer-group"
    title="Section {at + 1}"
    name={nameOfSection(s)}
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

    <div class="fields">
      <Field
        edit="{file}#/sections/{at}/height"
        label="Height"
        type="select"
        half
        options={HEIGHTS}
        value={s.height || 'auto'}
        changed={changed(at, 'height')}
        onvalue={(height) => setHeight(at, height)}
      />
      {#if s.height === 'aspect'}
        <Field
          edit="{file}#/sections/{at}/aspect"
          label="Ratio"
          type="select"
          half
          options={ASPECTS.includes(s.aspect) ? RATIOS : [...RATIOS, [s.aspect, s.aspect]]}
          value={s.aspect || '16:9'}
          changed={changed(at, 'aspect')}
          onvalue={(aspect) => set(at, { aspect })}
        />
      {/if}
      {#if s.height === 'screen' || s.height === 'aspect'}
        <Field
          edit="{file}#/sections/{at}/align"
          label="Content at"
          type="select"
          half
          options={ALIGNS}
          value={s.align || 'center'}
          changed={changed(at, 'align')}
          onvalue={(align) => set(at, { align })}
        />
      {:else}
        <Field
          edit="{file}#/sections/{at}/rows"
          label="Rows"
          type="number"
          half
          value={rowsOf(s)}
          changed={changed(at, 'rows')}
          onvalue={(rows) => set(at, { rows: whole(rows, 1) }, `section:${file}#${at}/rows`)}
        />
      {/if}
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
      <Field
        edit="{file}#/sections/{at}/rowHeight"
        label="Row height (px)"
        type="number"
        half
        value={rowHeightOf(s)}
        changed={changed(at, 'rowHeight')}
        onvalue={(v) => rowHeight(at, v)}
      />
      <Field
        edit="{file}#/sections/{at}/spacing/top"
        label="Space above (rows)"
        type="number"
        half
        value={s.spacing?.top ?? 0}
        changed={changed(at, 'spacing/top')}
        onvalue={(v) => spacing(s, 'top', v)}
      />
      <Field
        edit="{file}#/sections/{at}/spacing/bottom"
        label="Space below (rows)"
        type="number"
        half
        value={s.spacing?.bottom ?? 0}
        changed={changed(at, 'spacing/bottom')}
        onvalue={(v) => spacing(s, 'bottom', v)}
      />
      <Field
        edit="{file}#/sections/{at}/mobile/spacing/top"
        label="Phone: above"
        type="number"
        half
        value={s.mobile?.spacing?.top ?? s.spacing?.top ?? 0}
        changed={changed(at, 'mobile/spacing/top')}
        onvalue={(v) => phoneSpacing(s, 'top', v)}
      />
      <Field
        edit="{file}#/sections/{at}/mobile/spacing/bottom"
        label="Phone: below"
        type="number"
        half
        value={s.mobile?.spacing?.bottom ?? s.spacing?.bottom ?? 0}
        changed={changed(at, 'mobile/spacing/bottom')}
        onvalue={(v) => phoneSpacing(s, 'bottom', v)}
      />
    </div>
    {#if s.mobile?.spacing}
      <p class="hint small phone">
        Phones have their own spacing.
        <button type="button" class="link" onclick={() => sameOnPhone(s)}>Same as desktop</button>
      </p>
    {/if}

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
  .phone {
    margin-top: 8px;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ed-accent);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
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
