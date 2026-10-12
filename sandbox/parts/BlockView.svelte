<!-- mock: the block view with its section's settings at the top (open: editable, closed: a summary) -->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  import SectionIcon from '../../src/editor/svelte/SectionIcon.svelte';

  // (open: the approved, editable view; closed is the earlier summary variant)
  let { open = false } = $props();
  const HEIGHTS = [['rows'], [0], [1 / 3], [1 / 2], [1]];
  const WIDTHS = [['inside'], ['edge']];
</script>

<div class="plain" data-open={open}>
  <div class="phead">
    <span class="pleft"><Button icon="arrow-left" iconOnly label="Back to sections" /><span class="ptitle">Section 1</span></span>
    <Button size="small" icon="location-crosshairs" iconOnly label="Show in preview" />
  </div>
  <div class="fields">
    <div class="tf">
      <input class="tf__input" placeholder="Name" aria-label="Name" />
      <span class="tf__help hint">Optional: a #link to this section</span>
    </div>
    {#each [['Height', 'height', HEIGHTS, 4], ['Width', 'width', WIDTHS, 1]] as [title, kind, opts, now] (title)}
      <div class="tf is-half">
        <span class="tf__label">{title}</span>
        <div class="hset">
          {#each opts as [arg], i (i)}
            <button type="button" class={['hset__btn', now === i && 'is-active']}
              ><SectionIcon {kind} {arg} /></button
            >
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<div class="bcard">

<div class="head">
  <span class="title">Hero <strong>Eeliya Rasta</strong></span>
</div>

<div class="seg tabs">
  <button type="button" class="seg__btn is-active">Content</button>
  <button type="button" class="seg__btn">Layout</button>
  <button type="button" class="seg__btn">Motion</button>
</div>

<div class="tf">
  <span class="tf__label">Source item</span>
  <div class="card">
    <span class="plus"><i class="fa-solid fa-plus" aria-hidden="true"></i></span>
    <span class="txt"><b>No item</b><small>Pick an item to fill fields from it</small></span>
    <Button size="small">Choose</Button>
  </div>
</div>
<div class="row2">
  <div class="tf"><span class="tf__label">Name</span><input class="tf__input" value="Eeliya Rasta" /></div>
  <div class="tf"><span class="tf__label">Eyebrow</span><input class="tf__input" value="Portrait & editorial" /></div>
</div>
</div>

<style lang="scss">
  .plain { padding: 0 var(--space-1); }
  .phead { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
  .pleft { display: flex; align-items: center; gap: var(--space-2); }
  .ptitle { color: var(--c-text-faint); font-size: var(--fs-sm); letter-spacing: 0.08em; text-transform: uppercase; }
  .bcard { margin-top: var(--space-5); padding: var(--space-3); border-radius: var(--radius-lg); background: var(--c-card); }
  .bcard .head { margin-top: 0; }
  .sum { display: flex; gap: var(--space-2); color: var(--c-text-muted); }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .fields > :first-child { grid-column: 1 / -1; }
  .hint { text-align: right; }
  .hset { display: flex; gap: var(--space-1); height: var(--size-control); padding: var(--space-1); border-radius: var(--radius-md); box-shadow: inset 0 0 0 1px var(--c-line); justify-self: start; }
  .hset__btn { display: grid; place-items: center; width: 36px; height: 24px; padding: 0; border: 0; border-radius: var(--radius-sm); background: none; color: var(--c-text-muted);
    &.is-active { background: var(--c-fill-active); color: var(--c-accent); } }
  .head { display: flex; align-items: center; gap: var(--space-2); margin: var(--space-4) 0 var(--space-3); }
  .title { font-weight: 600; strong { color: var(--c-link); font-weight: 400; margin-left: var(--space-1); } }
  .tabs { margin-bottom: var(--space-4); }
  .card { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2); border: 1px dashed var(--c-line); border-radius: var(--radius-lg); }
  .plus { display: grid; place-items: center; width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--c-surface-2); color: var(--c-text-faint); }
  .txt { display: grid; flex: 1; gap: var(--space-1); b { font-weight: 400; color: var(--c-text-muted); } small { color: var(--c-text-faint); font-size: var(--fs-sm); } }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3); }
</style>
