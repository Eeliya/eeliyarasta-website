<!--
  A block's Layout tab (BlockInspector.svelte). Where a block is and how big is set in the
  preview (overlay.js: drag it, drag its handles); here only what can't be dragged. It edits
  the layout the preview shows (the desktop's, or the phone's in the mobile preview):
    At the top, read only: where it is and how big in cells (its columns as stored, its rows as
    the preview resolved them: --fr / --frs, src/client/modules/rows.js), and the block it
    follows with the gap. Linking and unlinking are dragged in the preview (overlay.js: its top
    circle onto another block's bottom circle; dragged off, or the line picked + Delete), the
    gap by dragging the block up or down.
    Size              Auto (its content, the default) | Aspect (its width × a ratio: a preset
                      or a custom "w:h") | Rows (fixed); every block spans whole rows
                      (src/site/layout/flow.js)
    Scale text        (text blocks) its text in cells, relative to its styles (Settings >
                      Typography), and its % of them (src/site/layout/type.js)
    Placement         in the grid, sticky, fixed, fullscreen or pinned (desktop, or on phones)
    Layer             down / up, for blocks that overlap (desktop)
    Reset phone       (phone) the section's blocks show their desktop layout halved again
-->
<script>
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { layerBlock, placeOnPhone, resetMobile, setBlock } from '../layout-ops.js';
  import {
    ASPECTS,
    PLACES,
    linkOf,
    phoneAreaOf,
    placeOf,
    ratioOf,
    sizeOf,
  } from '../../site/layout/index.js';
  import { SCALE_TYPES, adjustOf } from '../../site/layout/type.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';
  import { nameOf } from './content-groups.js';

  // el: the block's element in the preview (its resolved rows), or null
  let { g, live, at, j, base, block, el = null } = $props();

  const phone = $derived(ui.viewport === 'mobile');
  const size = $derived(sizeOf(block));
  const section = $derived.by(() => {
    live.version;
    return live.get(g.file, `/sections/${at}`) || {};
  });
  const phoneSet = $derived((section.blocks || []).some((b) => b?.mobile));
  const link = $derived(linkOf(block, phone));
  const leader = $derived(link && (section.blocks || []).find((b) => b?.id === link.to));
  const leaderName = $derived(
    leader ? nameOf(leader) || BLOCK_TYPES[leader.type]?.label || leader.id : link?.to || '',
  );
  // its rows as the preview shows them (rows.js rewrites --fr / --frs as content and links
  // move it): read again whenever the element's style changes
  let shown = $state(null);
  $effect(() => {
    if (!el) return void (shown = null);
    const read = () => {
      const v = (k) => parseInt(el.style.getPropertyValue(k), 10);
      shown = { row: v('--fr'), rows: v('--frs') };
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => watch.disconnect();
  });
  const area = $derived.by(() => {
    const a = phone ? phoneAreaOf(block) : placeOf(block.pos);
    const ok = (n) => Number.isInteger(n) && n > 0;
    return {
      ...a,
      row: ok(shown?.row) ? shown.row : a.row,
      rows: ok(shown?.rows) ? shown.rows : a.rows,
    };
  });
  const scalable = $derived(SCALE_TYPES.includes(block.type));

  const SIZES = [
    ['auto', 'Auto', 'As tall as its content'],
    ['aspect', 'Aspect', 'Its width × a ratio'],
    ['rows', 'Rows', 'Its rows, fixed'],
  ];
  const CUSTOM = 'custom';
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
    if (next === size) return;
    setBlock(live.store, g.file, at, j, {
      size: next === 'auto' ? undefined : next,
      aspect: next === 'aspect' ? block.aspect || '4:5' : undefined,
    });
  }
  function setScale(patch, k) {
    const next = { on: block.scale?.on === true, ...block.scale, ...patch };
    if (next.adjust === 100) delete next.adjust;
    const keep = next.on || next.adjust !== undefined;
    setBlock(live.store, g.file, at, j, { scale: keep ? next : undefined }, k);
  }
  function setRatio(v) {
    custom = v === CUSTOM;
    if (!custom && v !== block.aspect) setBlock(live.store, g.file, at, j, { aspect: v });
  }
  // custom "w:h": stored once it is a ratio
  function typeRatio(v) {
    if (ratioOf(v)) setBlock(live.store, g.file, at, j, { aspect: v.trim() }, key('aspect'));
  }
</script>

<div class="where">
  <span
    class="tf__label"
    title={phone ? 'Phone layout (60 columns)' : 'Desktop layout (120 columns)'}
  >
    col {area.col} · row {area.row} · {area.span} × {area.rows}
  </span>
  <span class="tf__label">
    {#if link}follows {leaderName}, gap {link.gap}{:else}free (not linked){/if}
  </span>
</div>

<div class="opt">
  <span class="tf__label">Size</span>
  <div class="seg" role="radiogroup" aria-label="Size">
    {#each SIZES as [id, label, title] (id)}
      <button
        type="button"
        role="radio"
        aria-checked={size === id}
        {title}
        class={['seg__btn', size === id && 'is-active']}
        onclick={() => setSize(id)}>{label}</button
      >
    {/each}
  </div>
</div>
{#if size === 'aspect'}
  <div class="opt">
    <span class="tf__label">Ratio (width:height)</span>
    <div class="seg ratios" role="radiogroup" aria-label="Aspect ratio">
      {#each [...ASPECTS, CUSTOM] as r (r)}
        <button
          type="button"
          role="radio"
          aria-checked={ratioPick === r}
          class={['seg__btn', ratioPick === r && 'is-active']}
          onclick={() => setRatio(r)}>{r === CUSTOM ? 'Custom' : r}</button
        >
      {/each}
    </div>
  </div>
  {#if ratioPick === CUSTOM}
    <div class="opt">
      <Field
        edit="{g.file}#{base}/aspect"
        label="Custom ratio (width:height)"
        placeholder="5:7"
        value={block.aspect ?? ''}
        onvalue={typeRatio}
      />
    </div>
  {/if}
{/if}

{#if scalable}
  <div class="opt">
    <Field
      edit="{g.file}#{base}/scale/on"
      label="Scale text with the grid"
      type="boolean"
      value={block.scale?.on === true}
      help="Its text in cells, by its styles (Settings › Typography), never under their minimum"
      onvalue={(v) => setScale({ on: v === true })}
    />
  </div>
  {#if block.scale?.on}
    <div class="opt">
      <Field
        edit="{g.file}#{base}/scale/adjust"
        label="Text size (% of its styles)"
        type="number"
        value={Math.round(adjustOf(block) * 100)}
        onvalue={(v) => v >= 10 && v <= 1000 && setScale({ adjust: v }, key('scale'))}
      />
    </div>
  {/if}
{/if}

{#if !phone}
  <div class="opt">
    <span class="tf__label">Placement</span>
    <Select
      aria-label="Placement"
      value={block.place ?? 'none'}
      options={places}
      onchange={(v) => setBlock(live.store, g.file, at, j, { place: v === 'none' ? undefined : v })}
    />
  </div>
  <div class="line">
    <span class="tf__label">Layer</span>
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
{:else}
  <div class="opt">
    <span class="tf__label">Placement on phones</span>
    <Select
      aria-label="Placement on phones"
      value={block.mobile?.place ?? 'none'}
      options={places}
      onchange={(v) => placeOnPhone(live.store, g.file, at, j, v)}
    />
  </div>
  <div class="line">
    <span class="tf__label">{phoneSet ? 'Phone layout set' : 'Desktop layout, halved'}</span>
    <Button
      size="small"
      icon="rotate-left"
      disabled={!phoneSet}
      onclick={() => resetMobile(live.store, g.file, at)}>Reset phone</Button
    >
  </div>
{/if}
<p class="hint small">
  Drag the block in the preview to move it, its handles to resize it, its top circle onto another
  block's bottom circle to link it. Drag the circle off, or pick the line and press Delete, to
  unlink it.
</p>

<style lang="scss">
  // where it is: two small read-only lines
  .where {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;

    .tf__label {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
  }

  // label above its control
  .opt {
    display: grid;
    gap: 4px;
    margin: 12px 0;

    .tf__label {
      margin: 0;
    }
  }

  // the closing hint, apart from the last row
  .hint:last-of-type {
    margin-top: 16px;
  }

  // the ratios: four to a row, in one box
  .ratios {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;

    .tf__label {
      flex: 1;
      margin: 0;
    }
  }
</style>
