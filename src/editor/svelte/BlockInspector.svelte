<!--
  One block of the page (ui.block), in three tabs:
    Content  its settings and texts (GroupFields.svelte)
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
    placeBlock(live.store, g.file, at, j, next);
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
  <GroupFields {g} {live} {bridge} {sourceIds} {onsource} />
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
