<!--
  One block of the page (ui.block), in three tabs:
    Content  its item (the source item its bound fields show, src/site/layout/bindings.js; on
             a [slug] page the page's own by default), settings and texts (GroupFields.svelte)
             with each field's Source switch
    Layout   where it sits in its section's grid: first column (1-24), columns, first row,
             rows, and its layer (z) when blocks overlap. Below 760px blocks stack in order.
             Dragging it in the preview (Arrange, overlay.js) writes the same values.
    Motion   its animated elements: each opens in the Motion tab
  Back returns to the list of sections (SectionsList.svelte).
-->
<script>
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import GroupFields from './GroupFields.svelte';
  import Select from './Select.svelte';
  import { schemaFor, itemName } from './source-items.js';
  import { TEMPLATE, sourceFile } from '../../site/files.js';
  import { itemSlug } from '../../site/helpers.js';
  import { BIND_TYPES, resolve } from '../../site/layout/bindings.js';
  import { ui } from './ui.svelte.js';
  import { layerBlock, placeBlock } from '../layout-ops.js';
  import { COLS, placeOf } from '../../site/layout/index.js';

  let { g, live, bridge, sourceIds, onsource, onback, onmotion } = $props();

  const TABS = [
    ['content', 'Content'],
    ['layout', 'Layout'],
    ['motion', 'Motion'],
  ];
  const { at, j } = $derived(g.block);
  const base = $derived(`/sections/${at}/blocks/${j}`);
  const block = $derived.by(() => {
    live.version;
    return live.get(g.file, base) || {};
  });
  const pos = $derived(placeOf(block.pos));
  const z = $derived(Number.isInteger(block.z) ? block.z : 0);

  function place(key, v) {
    const n = Math.max(1, Math.round(v));
    const next = { ...pos, [key]: n };
    if (key === 'col') next.col = Math.min(n, COLS);
    next.span = Math.min(next.span, COLS - next.col + 1);
    placeBlock(live.store, g.file, at, j, next, `place:${g.file}#${base}/${key}`);
  }

  // ---- its item: the block's own ({ source, slug }), else on a [slug] page the page's
  const template = $derived(g.file.endsWith(`/${TEMPLATE}.json`));
  const pageSource = $derived(template ? live.get(g.file, '/config/source') : null);
  // (read on its own: the store changes a value in place, so `block` stays the same object)
  const ref = $derived.by(() => {
    live.version;
    const v = live.get(g.file, `${base}/item`);
    return v && typeof v === 'object' ? { ...v } : null;
  });
  const itemSource = $derived(ref?.source || pageSource || null);
  const schema = $derived.by(() => {
    live.version;
    return itemSource ? schemaFor(live.store, sourceFile(itemSource)) : null;
  });
  const items = $derived.by(() => {
    live.version;
    const list = itemSource ? live.get(sourceFile(itemSource), '') : null;
    return Array.isArray(list) ? list : [];
  });
  const slugOf = (it) => itemSlug(it, schema);
  // the item the preview shows: the block's, or the [slug] page's (its path's last part)
  const item = $derived.by(() => {
    if (ref) return items.find((it) => slugOf(it) === ref.slug) ?? null;
    if (!template) return null;
    const last = String(ui.path || '')
      .split('/')
      .filter(Boolean)
      .at(-1);
    return items.find((it) => slugOf(it) === last) ?? items[0] ?? null;
  });
  // for the fields (Field.svelte): the item's fields per bind type, {{name}}s, what one shows
  const bindings = $derived({
    // the title field first: what switching Source on binds
    binds: (type) =>
      (schema?.fields || [])
        .filter((f) => (BIND_TYPES[type] || []).includes(f.type))
        .sort((a, b) => (b.key === schema.title) - (a.key === schema.title))
        .map((f) => ({ value: f.key, label: f.label || f.key, hint: f.type })),
    // {{name}}: the fields with one value that reads as text
    names: schema
      ? (schema.fields || [])
          .filter((f) => !['photo', 'photos', 'boolean'].includes(f.type))
          .map((f) => ({ key: f.key, label: f.label || f.key }))
      : null,
    resolved: (f) => {
      const v = resolve(live.get(f.file, f.ptr), { item, def: { type: f.type } });
      return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
    },
  });

  const setItem = (next) =>
    live.store.set(g.file, `${base}/item`, next, { source: 'panel', structure: true });
  function pickSource(id) {
    if (!id) return setItem(undefined);
    const list = live.get(sourceFile(id), '');
    const sc = schemaFor(live.store, sourceFile(id));
    const first = Array.isArray(list) && list.length ? itemSlug(list[0], sc) : '';
    setItem({ source: id, slug: first });
  }

  // the block's animated elements in the preview, read again after every edit
  const anims = $derived.by(() => {
    live.version;
    ui.previewVersion;
    const el = bridge.doc?.querySelector(`[data-block="${CSS.escape(g.id)}"]`);
    return el ? [...el.querySelectorAll('[data-anim]')] : [];
  });
</script>

<div class="head">
  <Button size="small" icon="arrow-left" onclick={onback}>Sections</Button>
  <span class="title">
    <i class="fa-solid fa-{g.icon}" aria-hidden="true"></i>
    {g.title}
    {#if g.name}<strong>{g.name}</strong>{/if}
  </span>
</div>

<div class="seg tabs" role="tablist" aria-label="Block">
  {#each TABS as [id, label] (id)}
    <button
      type="button"
      role="tab"
      aria-selected={ui.blockTab === id}
      class={['seg__btn', ui.blockTab === id && 'is-active']}
      onclick={() => (ui.blockTab = id)}>{label}</button
    >
  {/each}
</div>

{#if ui.blockTab === 'layout'}
  <div class="fields">
    {#each [['col', 'Column (1–24)'], ['span', 'Columns'], ['row', 'Row'], ['rows', 'Rows']] as [key, label] (key)}
      <Field
        edit="{g.file}#{base}/pos/{key}"
        {label}
        type="number"
        half
        value={pos[key]}
        changed={live.changed(g.file, `${base}/pos/${key}`)}
        onvalue={(v) => place(key, v)}
      />
    {/each}
  </div>
  <div class="layer">
    <span class="tf__label">Layer <b>{z}</b></span>
    <Button
      size="small"
      icon="arrow-down"
      label="Layer down"
      onclick={() => layerBlock(live.store, g.file, at, j, -1)}>Down</Button
    >
    <Button
      size="small"
      icon="arrow-up"
      label="Layer up"
      onclick={() => layerBlock(live.store, g.file, at, j, 1)}>Up</Button
    >
  </div>
  <p class="hint small">
    The section is a grid of {COLS} columns and rows of 8px; a row grows when its content needs more.
    Turn on Arrange to drag the block and its edges in the preview. On phones (below 760px) the blocks
    stack in their order.
  </p>
{:else if ui.blockTab === 'motion'}
  {#each anims as el, i (i)}
    <button type="button" class="anim" onclick={() => onmotion(el)}>
      <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
      <span>{el.dataset.anim}</span>
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </button>
  {:else}
    <p class="hint small">This block has no animated elements.</p>
  {/each}
{:else}
  {#if g.fields.length || g.config?.some((c) => c.type === 'text')}
    <div class={['opts', live.changed(g.file, `${base}/item`) && 'is-changed']}>
      <div class="opt">
        <span class="tf__label" id="{g.id}-isrc">Item from<i class="dot" title="Changed"></i></span>
        <Select
          aria-label="Item source"
          value={ref?.source ?? ''}
          options={[
            { value: '', label: template ? "This page's item" : 'None' },
            ...sourceIds.map((id) => ({ value: id, label: `${id}.json` })),
          ]}
          onchange={pickSource}
        />
      </div>
      <div class="opt">
        <span class="tf__label">Item</span>
        {#if ref}
          <Select
            aria-label="Item"
            value={ref.slug}
            placeholder="Pick…"
            options={items.map((it) => ({ value: slugOf(it), label: itemName(it, schema) }))}
            onchange={(slug) => setItem({ source: ref.source, slug })}
          />
        {:else}
          <span class="item-name">{item ? itemName(item, schema) : '—'}</span>
        {/if}
      </div>
    </div>
  {/if}
  <GroupFields {g} {live} {bridge} {sourceIds} {onsource} {bindings} />
  {#if !g.fields.length && !g.config?.length}
    <p class="hint small">No texts or settings in this block.</p>
  {/if}
{/if}

<style lang="scss">
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 12px;

    i {
      color: var(--muted);
    }

    strong {
      overflow: hidden;
      color: var(--hi);
      font-weight: 400;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .tabs {
    margin-bottom: 16px;
  }

  // the item picker: two columns, like the block's settings (GroupFields.svelte)
  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;

    .dot {
      display: none;
    }

    &.is-changed .dot {
      display: inline-block;
    }
  }

  .opt {
    min-width: 0;
    padding: 4px;
  }

  .item-name {
    display: block;
    padding: 8px 0;
    overflow: hidden;
    color: var(--muted);
    font-size: 12px;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;

    .tf__label {
      flex: 1;
    }
  }

  .anim {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    background: #141414;
    color: var(--fg);
    font: inherit;
    font-size: 12px;
    cursor: pointer;

    span {
      flex: 1;
      text-align: left;
    }

    i {
      color: var(--muted);
    }

    &:hover {
      background: #1c1c1c;
    }

    & + & {
      margin-top: 4px;
    }
  }
</style>
