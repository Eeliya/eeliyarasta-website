<!--
  One block of the page (ui.block), in three tabs:
    Content  its item (the source item its bound fields show, src/site/layout/bindings.js; on
             a [slug] page the page's own by default), settings and texts (GroupFields.svelte)
             with each field's Source switch
    Layout   its size (rows, aspect, auto), placement and layer, for the desktop or the phone
             (LayoutTab.svelte); where it sits is dragged in the preview (overlay.js)
    Motion   its motion: its animation and own timing, and its parts with their own animation,
             which open in the Motion tab (BlockMotion.svelte, as in the Motion tab)
  At the top, plain (not a card): Back (to the list of sections, SectionsList.svelte; Esc or a
  click on empty space in the preview also goes back), its section's title (dim when only
  "Section N") and Locate, then the section's settings, editable (SectionSettings.svelte, as in
  the list). Under them the block in a card: its type and title, the tabs and their fields.
-->
<script>
  import Button from './Button.svelte';
  import GroupFields from './GroupFields.svelte';
  import ItemPicker from './ItemPicker.svelte';
  import { schemaFor, itemName } from './source-items.js';
  import { TEMPLATE, sourceFile } from '../../site/files.js';
  import { itemSlug } from '../../site/helpers.js';
  import { BIND_TYPES, resolve } from '../../site/layout/bindings.js';
  import { ui } from './ui.svelte.js';
  import LayoutTab from './LayoutTab.svelte';
  import BlockMotion from './BlockMotion.svelte';
  import { ANIMATIONS } from '../../site/files.js';
  import SectionSettings from './SectionSettings.svelte';
  import { locate } from '../locate.js';

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

  // ---- its section: its settings editable at the top (SectionSettings.svelte, as in the list)
  const sections = $derived.by(() => {
    const list = live.current(g.file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  const secTitle = $derived.by(() => {
    const n = sections[at]?.name;
    return typeof n === 'string' && n.trim() ? n.trim() : '';
  });

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
    if (ref) return items.find((it) => it?.id === ref.id) ?? null;
    if (!template) return null;
    const last = String(ui.path || '')
      .split('/')
      .filter(Boolean)
      .at(-1);
    return items.find((it) => slugOf(it) === last) ?? items[0] ?? null;
  });
  // for the fields (Field.svelte): the item's fields per bind type, what one shows
  const bindings = $derived({
    // the title field first: what switching Source on binds
    binds: (type) =>
      (schema?.fields || [])
        .filter((f) => (BIND_TYPES[type] || []).includes(f.type))
        .sort((a, b) => (b.key === schema.title) - (a.key === schema.title))
        .map((f) => ({ value: f.key, label: f.label || f.key, hint: f.type })),
    resolved: (f) => {
      const v = resolve(live.get(f.file, f.ptr), { item, def: { type: f.type } });
      return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
    },
  });

  const setItem = (next) =>
    live.store.set(g.file, `${base}/item`, next, { source: 'panel', structure: true });

  // the block's element in the preview, read again after every edit
  const blockEl = $derived.by(() => {
    live.version;
    ui.previewVersion;
    return bridge.doc?.querySelector(`[data-block="${CSS.escape(g.id)}"]`) || null;
  });
</script>

<!-- its section: Back, its title (dim when only "Section N") and Locate; its settings -->
<div class="sec-top">
  <div class="sec-head">
    <Button
      icon="arrow-left"
      iconOnly
      label="Back to sections"
      title="Back to sections"
      onclick={onback}
    />
    <span class={['sec-title', !secTitle && 'is-default']}>{secTitle || `Section ${at + 1}`}</span>
    <Button
      size="small"
      icon="location-crosshairs"
      iconOnly
      label="Show this section in the preview"
      title="Show in preview"
      onclick={() => locate(bridge, sections[at]?.id)}
    />
  </div>
  <SectionSettings {live} file={g.file} {at} {sections} />
</div>

<!-- the block, in a card: its type and title, its tabs and fields -->
<div class="card">
  <div class="head">
    <span class="title">
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
    <!-- its item (a block with a source setting, a list block, picks its source there instead) -->
    {#if !g.config?.some((c) => c.type === 'source') && (g.fields.length || g.config?.some((c) => c.type === 'text'))}
      <div class="opts">
        <ItemPicker
          store={live.store}
          value={ref}
          changed={live.changed(g.file, `${base}/item`)}
          {sourceIds}
          {onsource}
          none={template ? "This page's item" : 'None'}
          itemsOf={(id) => {
            live.version;
            const list = live.get(sourceFile(id), '/items');
            return Array.isArray(list) ? list : [];
          }}
          nameOf={(id, it) => itemName(it, schemaFor(live.store, sourceFile(id)))}
          onpick={setItem}
        />
      </div>
    {/if}
    <GroupFields {g} {live} {bridge} {sourceIds} {onsource} {bindings} />
    {#if !g.fields.length && !g.config?.length}
      <p class="hint small">No texts or settings in this block.</p>
    {/if}
  {/if}
</div>

<style lang="scss">
  // its section: a plain area (not a card), then the block's card
  .sec-top {
    display: grid;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }

  .sec-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
  }

  .sec-title {
    overflow: hidden;
    color: var(--c-text);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;

    &.is-default {
      color: var(--c-text-faint);
    }
  }

  .card {
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--c-card);
  }

  // [ Type name ]
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

  // the item: its source field (ItemPicker.svelte)
  .opts {
    margin-bottom: var(--space-4);
  }
</style>
