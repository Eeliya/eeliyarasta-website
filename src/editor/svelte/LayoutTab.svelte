<!--
  A block's Layout tab (BlockInspector.svelte). Where a block is and how big is set in the
  preview (overlay.js: drag it, drag its handles); here only what can't be dragged:
    Desktop | Mobile  which layout it edits; it also switches the preview (ui.viewport)
    Size              Rows (its rows, more when its content needs them) | Aspect (its width ×
                      a ratio: a preset or a custom "w:h") | Auto (its content); every block
                      spans whole rows (src/site/layout/flow.js)
    Placement         in the grid, sticky, fixed, fullscreen or pinned (desktop, or on phones)
    Layer             down / up, for blocks that overlap (desktop)
    Reset to stack    (Mobile) the section's blocks stack again on phones
-->
<script>
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { layerBlock, placeOnPhone, resetMobile, setBlock } from '../layout-ops.js';
  import { ASPECTS, PLACES, ratioOf, sizeOf } from '../../site/layout/index.js';

  let { g, live, at, j, base, block } = $props();

  const phone = $derived(ui.viewport === 'mobile');
  const size = $derived(sizeOf(block));
  const section = $derived.by(() => {
    live.version;
    return live.get(g.file, `/sections/${at}`) || {};
  });
  const phoneSet = $derived((section.blocks || []).some((b) => b?.mobile));

  const SIZES = [
    ['rows', 'Rows', 'Its rows, more when its content needs them'],
    ['aspect', 'Aspect', 'Its width × a ratio'],
    ['auto', 'Auto', 'As tall as its content'],
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
      size: next === 'rows' ? undefined : next,
      aspect: next === 'aspect' ? block.aspect || '4:5' : undefined,
    });
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
    <span class="tf__label">{phoneSet ? 'Phone layout set' : 'Stacks on phones'}</span>
    <Button
      size="small"
      icon="layer-group"
      disabled={!phoneSet}
      onclick={() => resetMobile(live.store, g.file, at)}>Reset to stack</Button
    >
  </div>
{/if}
<p class="hint small">Drag the block in the preview to move it, its handles to resize it.</p>

<style lang="scss">
  .tabs {
    margin-bottom: 16px;
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
