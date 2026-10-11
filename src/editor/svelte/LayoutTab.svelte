<!--
  A block's Layout tab (BlockInspector.svelte). Where a block is and how big is set in the
  preview (overlay.js: drag it, drag its handles); here only what can't be dragged. It edits
  the layout the preview shows (the desktop's, or the phone's in the mobile preview):
    Size              Auto (its content, the default) | Aspect (its width × a ratio: a preset
                      or a custom "w:h") | Rows (fixed); every block spans whole rows
                      (src/site/layout/flow.js)
    Link              free, or the block it follows and the gap (cells, negative overlaps);
                      Unlink. Linking is dragged in the preview (its top circle onto another
                      block's bottom circle)
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
  import { layerBlock, linkBlock, placeOnPhone, resetMobile, setBlock } from '../layout-ops.js';
  import { ASPECTS, PLACES, linkOf, ratioOf, sizeOf } from '../../site/layout/index.js';
  import { SCALE_TYPES, adjustOf } from '../../site/layout/type.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';

  let { g, live, at, j, base, block } = $props();

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
    leader ? `${BLOCK_TYPES[leader.type]?.label || leader.type} (${leader.id})` : '',
  );
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
  // the gap typed: a whole number of cells (negative overlaps)
  function setGap(v) {
    if (link && Number.isInteger(v)) linkBlock(live.store, g.file, at, j, link.to, v, { phone });
  }
  const unlink = () => linkBlock(live.store, g.file, at, j, null, 0, { phone });
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

<p class="hint small">{phone ? 'Phone layout (60 columns)' : 'Desktop layout (120 columns)'}</p>

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

<div class="line">
  <span class="tf__label">
    {#if link}Follows {leaderName || link.to}{:else}Free (not linked){/if}
  </span>
  <Button size="small" icon="link-slash" disabled={!link} onclick={unlink}>Unlink</Button>
</div>
{#if link}
  <div class="opt">
    <Field
      edit="{g.file}#{base}/{phone ? 'mobile/link' : 'link'}/gap"
      label="Gap below it (cells, negative overlaps)"
      type="number"
      value={link.gap}
      onvalue={setGap}
    />
  </div>
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
  block's bottom circle to link it.
</p>

<style lang="scss">
  // label above its control
  .opt {
    display: grid;
    gap: 4px;
    margin: 12px 0;

    .tf__label {
      margin: 0;
    }
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
