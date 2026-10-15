<!--
  One block of the page (ui.block), in three tabs:
    Content  its item (the source item its bound fields show, src/site/layout/bindings.js; on
             a [slug] page the page's own by default), settings and texts (GroupFields.svelte)
             with each field's Source switch
    Layout   its size (rows, aspect, auto) and layer, for the desktop or the phone
             (LayoutTab.svelte); where it sits is dragged in the preview (overlay.js)
    Motion   its motion: its animation and own timing, and its parts with their own animation,
             which open in the Motion tab (BlockMotion.svelte, as in the Motion tab)
  At the top, plain (not a card): its section (SectionTop.svelte: Back, its title, Locate and
  its settings). Under them the block in a card: its type and title, the tabs and their fields.
-->
<script>
  import GroupFields from './GroupFields.svelte';
  import ItemPicker from './ItemPicker.svelte';
  import Tabs from './Tabs.svelte';
  import { schemaFor, itemName } from './source-items.js';
  import { TEMPLATE, sourceFile } from '../../site/files.js';
  import { itemSlug } from '../../site/helpers.js';
  import { BIND_TYPES, resolve } from '../../site/layout/bindings.js';
  import { ui } from './ui.svelte.js';
  import LayoutTab from './LayoutTab.svelte';
  import BlockMotion from './BlockMotion.svelte';
  import { ANIMATIONS } from '../../site/files.js';
  import SectionTop from './SectionTop.svelte';

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

<SectionTop {live} {bridge} file={g.file} {at} {onback} />

<!-- the block, in a card: its type and title, its tabs and fields -->
<div class="card">
  <div class="head">
    <span class="title">
      {g.title}
      {#if g.name}<strong>{g.name}</strong>{/if}
    </span>
  </div>

  <Tabs
    class="card__tabs"
    label="Block"
    tabs={TABS}
    value={ui.blockTab}
    onpick={(id) => (ui.blockTab = id)}
  />

  <div class="card__body">
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
      {#snippet item()}
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
          onclear={() => setItem(undefined)}
        />
      {/snippet}
      <GroupFields
        {g}
        {live}
        {bridge}
        {sourceIds}
        {onsource}
        {bindings}
        lead={!g.config?.some((c) => c.type === 'source') &&
        (g.fields.length || g.config?.some((c) => c.type === 'text'))
          ? item
          : undefined}
      />
      {#if !g.fields.length && !g.config?.length}
        <p class="hint small">No texts or settings in this block.</p>
      {/if}
    {/if}
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the side padding is on its parts, so the tabs' line runs edge to edge
  .card {
    margin-inline: -8px;
    padding: var(--space-3) 0;
    border-radius: var(--radius-lg);
    background: var(--c-card);
  }

  // [ Type name ]
  .head {
    @include row(var(--space-2));
    margin-bottom: var(--space-3);
    padding-inline: var(--space-3);
  }

  .title {
    @include row(var(--space-2));
    min-width: 0;
    font-size: var(--fs-base);

    strong {
      @include ellipsis;
      color: var(--c-link);
      font-weight: 400;
    }
  }

  .card :global(.card__tabs) {
    margin-bottom: var(--space-4);
  }

  .card__body {
    padding-inline: var(--space-3);
  }
</style>
