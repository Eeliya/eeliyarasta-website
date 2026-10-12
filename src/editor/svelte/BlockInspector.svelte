<!--
  One block of the page (ui.block), in three tabs:
    Content  its item (the source item its bound fields show, src/site/layout/bindings.js; on
             a [slug] page the page's own by default), settings and texts (GroupFields.svelte)
             with each field's Source switch
    Layout   its size (rows, aspect, auto), placement and layer, for the desktop or the phone
             (LayoutTab.svelte); where it sits is dragged in the preview (overlay.js)
    Motion   its motion: its animation and own timing, and its parts with their own animation,
             which open in the Motion tab (BlockMotion.svelte, as in the Motion tab)
  The head row: Back (a quiet arrow: to the list of sections, SectionsList.svelte) and the
  block's name. (Esc or a click on empty space in the preview also goes back.) Above it, its
  section's settings, read only and live (name, height with its rows (the phone's in the phone
  preview), width): a click opens that section in the list.
-->
<script>
  import Button from './Button.svelte';
  import GroupFields from './GroupFields.svelte';
  import Select from './Select.svelte';
  import { schemaFor, itemName } from './source-items.js';
  import { TEMPLATE, sourceFile } from '../../site/files.js';
  import { itemSlug } from '../../site/helpers.js';
  import { BIND_TYPES, resolve } from '../../site/layout/bindings.js';
  import { ui } from './ui.svelte.js';
  import LayoutTab from './LayoutTab.svelte';
  import BlockMotion from './BlockMotion.svelte';
  import { ANIMATIONS } from '../../site/files.js';
  import SectionIcon from './SectionIcon.svelte';
  import {
    heightOf,
    minRowsOf,
    mobileMinRowsOf,
    phoneHeightOf,
    rowsOf,
  } from '../../site/layout/index.js';
  import { tick } from 'svelte';

  // onmotion(el): open a part in the Motion tab; onlibrary(name): an animation in Animations
  let { g, live, bridge, sourceIds, onsource, onback, onmotion, onlibrary } = $props();

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

  // ---- its section's settings, read only (a row above the head: a click opens them)
  const H_LABELS = {
    custom: ['', 'rows'],
    fit: ['Fit', 0],
    third: ['1/3 screen', 1 / 3],
    half: ['1/2 screen', 1 / 2],
    full: ['Full screen', 1],
  };
  const sec = $derived.by(() => {
    live.version;
    const s = live.get(g.file, `/sections/${at}`) || {};
    const phone = ui.viewport === 'mobile';
    // the height of the view shown (the phone's own, else the desktop's)
    const own = phone ? phoneHeightOf(s) : heightOf(s);
    const h = own === 'custom' && !(phone ? mobileMinRowsOf(s) : minRowsOf(s)) ? 'fit' : own;
    // the rows: the resize line's while it is dragged, else the stored ones (the phone's own)
    const dragged = ui.secRows?.id === s.id ? ui.secRows.rows : 0;
    const rows = h === 'custom' ? dragged || (phone ? mobileMinRowsOf(s) : minRowsOf(s)) : 0;
    return {
      id: s.id,
      name: typeof s.name === 'string' && s.name.trim() ? s.name : '',
      h,
      rows: rows || (h === 'custom' ? rowsOf(s) : 0),
      phone,
      full: s.width === 'full',
    };
  });
  async function openSection() {
    const id = sec.id;
    ui.sections[`text:${g.file}#${id}`] = true;
    ui.block = null;
    await tick();
    document
      .querySelector(`[data-section="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'start' });
  }

  // ---- its item: the block's own ({ source, slug }), else on a [slug] page the page's
  const template = $derived(g.file.endsWith(`/${TEMPLATE}.json`));
  const pageSource = $derived(template ? live.get(g.file, '/template/source') : null);
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
    const list = itemSource ? live.get(sourceFile(itemSource), '/items') : null;
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
    const list = live.get(sourceFile(id), '/items');
    const sc = schemaFor(live.store, sourceFile(id));
    const first = Array.isArray(list) && list.length ? itemSlug(list[0], sc) : '';
    setItem({ source: id, slug: first });
  }

  // the block's element in the preview, read again after every edit
  const blockEl = $derived.by(() => {
    live.version;
    ui.previewVersion;
    return bridge.doc?.querySelector(`[data-block="${CSS.escape(g.id)}"]`) || null;
  });
</script>

<button
  type="button"
  class="parent"
  title="Open this section's settings"
  aria-label="Section settings: {sec.name || 'Unnamed section'}"
  onclick={openSection}
>
  <span class={['parent__name', !sec.name && 'is-none']}>{sec.name || 'Unnamed section'}</span>
  <span class="parent__val" data-part="height">
    <SectionIcon kind="height" arg={H_LABELS[sec.h][1]} />
    {H_LABELS[sec.h][0]}{#if sec.h === 'custom'}
      {sec.rows}{sec.phone ? ' phone' : ''} rows{/if}
  </span>
  <span class="parent__val" data-part="width">
    <SectionIcon kind="width" arg={sec.full ? 'edge' : 'inside'} />
    {sec.full ? 'Full' : 'Contained'}
  </span>
</button>

<div class="head">
  <Button
    icon="arrow-left"
    iconOnly
    label="Back to sections"
    title="Back to sections"
    onclick={onback}
  />
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
  <LayoutTab {g} {live} {at} {j} {base} {block} el={blockEl} />
{:else if ui.blockTab === 'motion'}
  {#key blockEl}
    <BlockMotion
      {live}
      {bridge}
      gsap={bridge.api?.gsap}
      cfg={live.current(ANIMATIONS)}
      file={g.file}
      {at}
      {j}
      el={blockEl}
      {onlibrary}
      onpart={onmotion}
    />
  {/key}
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
  // [ name · height · width ]: the block's section, muted; a click opens its settings
  .parent {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    height: var(--size-control);
    margin-bottom: var(--space-1);
    padding: 0 var(--space-2);
    border: 1px solid var(--c-line);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
    font: inherit;
    font-size: var(--fs-sm);
    text-align: left;
    cursor: pointer;

    &:hover {
      color: var(--c-link);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }
  }

  .parent__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-none {
      font-style: italic;
    }
  }

  .parent__val {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap;
  }

  // [ ← | icon Type name ]
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--fs-base);

    i {
      color: var(--c-text-muted);
    }

    strong {
      overflow: hidden;
      color: var(--c-link);
      font-weight: 400;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .tabs {
    margin-bottom: var(--space-4);
  }

  // the item picker: two columns, like the block's settings (GroupFields.svelte)
  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-bottom: var(--space-4);

    .dot {
      display: none;
    }

    &.is-changed .dot {
      display: inline-block;
    }
  }

  .opt {
    min-width: 0;
    padding: var(--space-1);
  }

  .item-name {
    display: block;
    padding: var(--space-2) 0;
    overflow: hidden;
    color: var(--c-text-muted);
    font-size: var(--fs-base);
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
