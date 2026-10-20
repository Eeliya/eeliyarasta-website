<!--
  One block of the page (ui.block), in two tabs (its size, text size and layer: the toolbar on
  it in the preview, BlockToolbar.svelte; where it sits is dragged there, overlay.js):
    Content  its source (BlockSource.svelte: Item / All, From URL or None, and on a [param] page
             whether it is the main block), then its settings and texts (GroupFields.svelte),
             each bindable field with its picker: Custom or a field of the item it shows
    Motion   its motion: its animation and own timing, and its parts with their own animation,
             which open in the Motion tab (BlockMotion.svelte, as in the Motion tab)
  One level under the list of sections (a block's row on its section's card, or the block
  clicked in the preview): its top (ViewTop.svelte: ← Back to the list, Locate), then the block
  in a card: its type and title (Main: the page's main block), the tabs and their fields. Under it,
  on every tab, its section's settings card (SectionView.svelte, put there by ContentPanel).
-->
<script>
  import GroupFields from './GroupFields.svelte';
  import BlockSource from './BlockSource.svelte';
  import Tabs from './Tabs.svelte';
  import { schemaFor } from './source-items.js';
  import { isTemplate, pageIdOf, sourceFile } from '../../site/files.js';
  import { BIND_TYPES, resolve } from '../../site/layout/bindings.js';
  import { blockItems, sourceOf } from '../../site/layout/source.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';
  import { ui } from './ui.svelte.js';
  import BlockMotion from './BlockMotion.svelte';
  import { ANIMATIONS } from '../../site/files.js';
  import ViewTop from './ViewTop.svelte';

  // onmotion(el): open a part in the Motion tab; onlibrary(name): an animation in Animations
  let { g, live, bridge, sourceIds, onsource, onback, onmotion, onlibrary } = $props();

  // (its layout: the toolbar on the block in the preview, BlockToolbar.svelte)
  const TABS = [
    ['content', 'Content'],
    ['motion', 'Motion'],
  ];
  const { at, j } = $derived(g.block);
  const base = $derived(`/sections/${at}/blocks/${j}`);
  const block = $derived.by(() => {
    live.version;
    return live.get(g.file, base) || {};
  });
  const type = $derived(BLOCK_TYPES[g.type] || {});

  // ---- what it shows (src/site/layout/source.js): on a [param] page with the page the
  // preview shows (its params), the item its fields show the first
  const pageId = $derived(pageIdOf(g.file) || '');
  // (read on its own: the store changes a value in place, so `block` stays the same object)
  const source = $derived.by(() => {
    live.version;
    const v = live.get(g.file, `${base}/source`);
    return v && typeof v === 'object' ? structuredClone(v) : null;
  });
  const shown = $derived.by(() => {
    const route = live.routeOf(ui.path);
    const at = isTemplate(pageId) && route?.id === pageId ? route : { params: {} };
    return blockItems(live.content, at, { source });
  });
  const item = $derived(shown.item);
  const from = $derived(sourceOf({ source })?.from ?? null);
  const schema = $derived.by(() => {
    live.version;
    return from ? schemaFor(live.store, sourceFile(from)) : null;
  });
  const isMain = $derived.by(() => {
    live.version;
    return isTemplate(pageId) && live.get(g.file, '/main') === g.id;
  });
  // a field's value as one line (a field picker's hint)
  const line = (v) =>
    typeof v === 'string' || typeof v === 'number'
      ? String(v)
      : Array.isArray(v)
        ? `${v.length} items`
        : '';
  // for the fields (Field.svelte): the item's fields per bind type (with their value), what
  // one shows, and the item's name for the picker's group
  const bindings = $derived({
    // the title field first
    binds: (bindType) =>
      (schema?.fields || [])
        .filter((f) => (BIND_TYPES[bindType] || []).includes(f.type))
        .sort((a, b) => (b.key === schema.title) - (a.key === schema.title))
        .map((f) => ({
          value: f.key,
          label: f.key,
          hint: (item && line(item[f.key])) || f.label || f.type,
        })),
    resolved: (f) => {
      const v = resolve(live.get(f.file, f.ptr), { item, def: { type: f.type } });
      return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
    },
    from: item && schema ? (schema.title && line(item[schema.title])) || from : from,
    // a Text block's summary: its fields' values, its own count
    item,
    items: shown.items?.length ?? 0,
  });

  // the block's element in the preview, read again after every edit
  const blockEl = $derived.by(() => {
    live.version;
    ui.previewVersion;
    return bridge.doc?.querySelector(`[data-block="${CSS.escape(g.id)}"]`) || null;
  });
</script>

<ViewTop {bridge} id={g.id} {onback} />

<!-- the block, in a card: its type and title, its tabs and fields -->
<div class="card">
  <div class="head">
    <span class="title">
      {g.title}
      {#if g.name}<strong>{g.name}</strong>{/if}
    </span>
    {#if isMain}<span class="badge" title="The page’s main block: it decides which pages exist"
        >Main</span
      >{/if}
  </div>

  <Tabs
    class="card__tabs"
    label="Block"
    tabs={TABS}
    value={ui.blockTab}
    onpick={(id) => (ui.blockTab = id)}
  />

  <div class="card__body">
    {#if ui.blockTab === 'motion'}
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
      <!-- its source first (a block whose type shows items), then its settings and fields -->
      {#snippet lead()}
        <BlockSource {g} {live} {base} list={!!type.list} {shown} {sourceIds} {onsource} />
      {/snippet}
      <GroupFields
        {g}
        {live}
        {bridge}
        {sourceIds}
        {onsource}
        {bindings}
        lead={type.list || type.item || g.fields.some((f) => f.bindType) || block.source
          ? lead
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

  // Main: the block accent, a pill
  .badge {
    margin-left: auto;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    color: var(--c-block-accent);
    font-size: var(--fs-xs);
    line-height: 16px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-block-accent) 45%, transparent);
  }

  .card :global(.card__tabs) {
    margin-bottom: var(--space-4);
  }

  .card__body {
    padding-inline: var(--space-3);
  }
</style>
