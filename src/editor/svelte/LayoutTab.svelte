<!--
  A block's Layout tab (BlockInspector.svelte), for the desktop grid or the phone's:
    Desktop | Mobile  which layout it edits; it also switches the preview (ui.viewport)
    Desktop  size (rows | aspect ratio, a preset or custom "w:h" | auto), its area (column 1–24,
             columns, first row, rows: not for aspect / auto), placement, layer, and Fit rows
             to content (the rows its content needs at this width, measured in the preview)
    Mobile   its area on the phone grid (12 columns): editing it turns a stacking section into
             that grid, the other blocks keeping their places; placement on phones; Reset to
             stack (the section's blocks stack again, no phone placements)
  Arrange (overlay.js) drags the same values: the phone area in the mobile preview.
-->
<script>
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import {
    layerBlock,
    placeBlock,
    placeMobile,
    placeOnPhone,
    resetMobile,
    setBlock,
  } from '../layout-ops.js';
  import { contentRows, stackAreas } from '../overlay.js';
  import {
    ASPECTS,
    COLS,
    MCOLS,
    PLACES,
    hasMobileArea,
    placeOf,
    ratioOf,
    sizeOf,
  } from '../../site/layout/index.js';

  let { g, live, bridge, at, j, base, block } = $props();

  const phone = $derived(ui.viewport === 'mobile');
  const size = $derived(sizeOf(block));
  const pos = $derived(placeOf(block.pos));
  const marea = $derived(hasMobileArea(block.mobile) ? placeOf(block.mobile, MCOLS) : null);
  const z = $derived(Number.isInteger(block.z) ? block.z : 0);
  const section = $derived.by(() => {
    live.version;
    return live.get(g.file, `/sections/${at}`) || {};
  });
  const phoneSet = $derived((section.blocks || []).some((b) => b?.mobile));

  const SIZES = [
    { value: 'rows', label: 'Rows' },
    { value: 'aspect', label: 'Aspect ratio' },
    { value: 'auto', label: 'Auto (its content)' },
  ];
  const CUSTOM = 'custom';
  const ratios = [
    ...ASPECTS.map((a) => ({ value: a, label: a })),
    { value: CUSTOM, label: 'Custom…' },
  ];
  let custom = $state(false);
  const ratioPick = $derived(
    custom || (block.aspect && !ASPECTS.includes(block.aspect)) ? CUSTOM : (block.aspect ?? '4:5'),
  );

  const NAMES = {
    'top-left': 'top left',
    'top-center': 'top',
    'top-right': 'top right',
    center: 'centre',
    'bottom-left': 'bottom left',
    'bottom-center': 'bottom',
    'bottom-right': 'bottom right',
  };
  const placeLabel = (p) => {
    if (p === 'none') return 'None (in the grid)';
    if (p === 'fullscreen') return 'Fullscreen (behind, a background)';
    if (p === 'pinned') return 'Pinned (while its section scrolls)';
    const [kind, ...corner] = p.split('-');
    return `${kind === 'sticky' ? 'Sticky' : 'Fixed'}: ${NAMES[corner.join('-')]}`;
  };
  const places = [
    { group: '', options: [{ value: 'none', label: placeLabel('none') }] },
    {
      group: 'Sticky (in its section)',
      options: PLACES.filter((p) => p.startsWith('sticky-')).map((p) => ({
        value: p,
        label: placeLabel(p),
      })),
    },
    {
      group: 'Fixed (the whole page)',
      options: PLACES.filter((p) => p.startsWith('fixed-')).map((p) => ({
        value: p,
        label: placeLabel(p),
      })),
    },
    {
      group: 'Screen',
      options: ['fullscreen', 'pinned'].map((p) => ({ value: p, label: placeLabel(p) })),
    },
  ];

  const key = (k) => `layout:${g.file}#${base}/${k}`;

  function setSize(next) {
    custom = false;
    setBlock(live.store, g.file, at, j, {
      size: next === 'rows' ? undefined : next,
      aspect: next === 'aspect' ? block.aspect || '4:5' : undefined,
    });
  }
  function setRatio(v) {
    custom = v === CUSTOM;
    if (!custom) setBlock(live.store, g.file, at, j, { aspect: v });
  }
  // custom "w:h": stored once it is a ratio
  function typeRatio(v) {
    if (ratioOf(v)) setBlock(live.store, g.file, at, j, { aspect: v.trim() }, key('aspect'));
  }

  function place(k, v) {
    const n = Math.max(1, Math.round(v));
    const next = { ...pos, [k]: n };
    if (k === 'col') next.col = Math.min(n, COLS);
    next.span = Math.min(next.span, COLS - next.col + 1);
    placeBlock(live.store, g.file, at, j, next, key(`pos/${k}`));
  }

  /** The phone areas of the section's blocks where they stack now (from the preview). */
  function stackNow() {
    const win = bridge.doc?.defaultView;
    const sec = bridge.doc?.querySelector(`[data-sec="${CSS.escape(section.id)}"]`);
    return win && sec && !sec.classList.contains('sec--mgrid') ? stackAreas(sec, win) : {};
  }
  function placePhone(k, v) {
    const from = marea || stackNow()[block.id] || placeOf({}, MCOLS);
    const n = Math.max(1, Math.round(v));
    const next = { ...from, [k]: n };
    if (k === 'col') next.col = Math.min(n, MCOLS);
    next.span = Math.min(next.span, MCOLS - next.col + 1);
    placeMobile(live.store, g.file, at, j, next, { stack: stackNow(), key: key(`mobile/${k}`) });
  }

  // Fit rows to content: measured in the preview, at the desktop width
  const el = () => bridge.doc?.querySelector(`[data-block="${CSS.escape(block.id)}"]`);
  function fitRows() {
    const node = el();
    if (!node) return;
    place('rows', contentRows(node, bridge.doc.defaultView));
  }
</script>

<div class="seg tabs" role="tablist" aria-label="Layout for">
  {#each [['desktop', 'Desktop'], ['mobile', 'Mobile']] as [id, label] (id)}
    <button
      type="button"
      role="tab"
      aria-selected={ui.viewport === id}
      class={['seg__btn', ui.viewport === id && 'is-active']}
      onclick={() => (ui.viewport = id)}>{label}</button
    >
  {/each}
</div>

{#if !phone}
  <div class="opts">
    <div class="opt">
      <span class="tf__label">Size</span>
      <Select aria-label="Size" value={size} options={SIZES} onchange={setSize} />
    </div>
    {#if size === 'aspect'}
      <div class="opt">
        <span class="tf__label">Ratio</span>
        <Select aria-label="Aspect ratio" value={ratioPick} options={ratios} onchange={setRatio} />
      </div>
    {/if}
  </div>
  {#if size === 'aspect' && ratioPick === CUSTOM}
    <div class="row">
      <Field
        edit="{g.file}#{base}/aspect"
        label="Custom ratio (width:height)"
        placeholder="5:7"
        value={block.aspect ?? ''}
        onvalue={typeRatio}
      />
    </div>
  {/if}
  <div class="fields">
    {#each [['col', 'Column (1–24)'], ['span', 'Columns'], ['row', 'Row'], ['rows', 'Rows']] as [k, label] (k)}
      {#if k !== 'rows' || size === 'rows'}
        <Field
          edit="{g.file}#{base}/pos/{k}"
          {label}
          type="number"
          half
          value={pos[k]}
          changed={live.changed(g.file, `${base}/pos/${k}`)}
          onvalue={(v) => place(k, v)}
        />
      {/if}
    {/each}
  </div>
  <div class="row">
    <span class="tf__label">Placement</span>
    <Select
      aria-label="Placement"
      value={block.place ?? 'none'}
      options={places}
      onchange={(v) => setBlock(live.store, g.file, at, j, { place: v === 'none' ? undefined : v })}
    />
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
  {#if size === 'rows'}
    <div class="layer">
      <span class="tf__label">Rows its content needs at this width</span>
      <Button size="small" icon="arrows-up-down" onclick={fitRows}>Fit rows to content</Button>
    </div>
  {/if}
  <p class="hint small">
    The section is a grid of {COLS} columns and rows of 8px; a row grows when its content needs more.
    An aspect-ratio or auto block takes one row, which grows to hold it. Sticky blocks are held below
    the header while their section scrolls; fixed ones stay at a screen corner. Turn on Arrange to drag
    the block and its edges in the preview.
  </p>
{:else}
  {#if marea}
    <div class="fields">
      {#each [['col', 'Column (1–12)'], ['span', 'Columns'], ['row', 'Row'], ['rows', 'Rows']] as [k, label] (k)}
        {#if k !== 'rows' || size === 'rows'}
          <Field
            edit="{g.file}#{base}/mobile/{k}"
            {label}
            type="number"
            half
            value={marea[k]}
            changed={live.changed(g.file, `${base}/mobile/${k}`)}
            onvalue={(v) => placePhone(k, v)}
          />
        {/if}
      {/each}
    </div>
  {:else}
    <p class="hint small">
      On phones this section's blocks stack full width, in their order. Drag one with Arrange (or
      <button type="button" class="link" onclick={() => placePhone('col', 1)}>place it</button>) to
      lay the section out on the phone grid of {MCOLS} columns instead.
    </p>
  {/if}
  <div class="row">
    <span class="tf__label">Placement on phones</span>
    <Select
      aria-label="Placement on phones"
      value={block.mobile?.place ?? 'none'}
      options={places}
      onchange={(v) => placeOnPhone(live.store, g.file, at, j, v)}
    />
  </div>
  <div class="layer">
    <span class="tf__label">{phoneSet ? 'Phone layout set' : 'Stacks on phones'}</span>
    <Button
      size="small"
      icon="layer-group"
      disabled={!phoneSet}
      onclick={() => resetMobile(live.store, g.file, at)}>Reset to stack</Button
    >
  </div>
  <p class="hint small">
    Without a phone placement a block is in the page's flow on phones (not sticky, fixed or pinned).
    Reset to stack removes the phone areas and placements of every block in this section.
  </p>
{/if}

<style lang="scss">
  .tabs {
    margin-bottom: 16px;
  }

  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .opt {
    min-width: 0;
  }

  .row {
    margin: 12px 0;
  }

  .layer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;

    .tf__label {
      flex: 1;
      margin: 0;
    }
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
</style>
