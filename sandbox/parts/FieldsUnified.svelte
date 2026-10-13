<!-- mock: a block's settings and content fields in one .fields grid (Field.svelte throughout),
     a full-row line between them. v: now | a (line) | b (line + "Content") -->
<script>
  import Field from '../../src/editor/svelte/Field.svelte';
  import Select from '../../src/editor/svelte/Select.svelte';
  import Tabs from '../../src/editor/svelte/Tabs.svelte';

  let { v = 'a', caption = '' } = $props();
  const LAYOUTS = [['staggered', 'Staggered'], ['grid', 'Grid'], ['row', 'Row']];
  const nop = () => {};
</script>

{#snippet source()}
  <div class="sc">
    <span class="sc__tile"><i class="fa-solid fa-table-cells"></i></span>
    <span class="sc__text">
      <span class="sc__label">Source list</span>
      <span class="sc__name">Places</span>
      <span class="sc__meta">places.json · 2 items</span>
    </span>
    <span class="choose">Change</span>
  </div>
{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  <div class="card">
    <div class="head">Photo grid <strong>Places</strong></div>
    <Tabs class="card__tabs" label="Block" tabs={[['c', 'Content'], ['l', 'Layout'], ['m', 'Motion']]} value="c" onpick={nop} />
    <div class="body">
      {#if v === 'now'}
        <div class="opts">
          <div class="opt full">{@render source()}</div>
          <div class="opt">
            <span class="tf__label">Layout</span>
            <Select value="staggered" options={LAYOUTS.map(([value, label]) => ({ value, label }))} onchange={nop} />
          </div>
        </div>
        <div class="fields gap-top">
          <Field label="Label" value="Places" onvalue={nop} />
          <Field label="Title" value="Where I photograph" onvalue={nop} />
          <Field label="Button" value="All places" onvalue={nop} />
        </div>
      {:else}
        <div class="fields">
          <div>{@render source()}</div>
          <Field label="Layout" type="select" value="staggered" options={LAYOUTS} onvalue={nop} />
          <div class={['sep', v === 'b' && 'sep--cap']} role="separator">
            {#if v === 'b'}<span>Content</span>{/if}
          </div>
          <Field label="Label" value="Places" onvalue={nop} />
          <Field label="Title" value="Where I photograph" onvalue={nop} />
          <Field label="Button" value="All places" onvalue={nop} />
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .col { width: 360px; display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; min-height: 32px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .card { padding: 12px 0; border-radius: var(--radius-lg); background: var(--c-card); }
  .head { display: flex; gap: 8px; margin-bottom: 12px; padding-inline: 12px; line-height: 20px;
    strong { color: var(--c-link); font-weight: 400; } }
  .card :global(.card__tabs) { margin-bottom: 16px; }
  .body { padding-inline: 12px; }

  // now: GroupFields' .opts / .opt
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .opt { min-width: 0; padding: 4px; .tf__label { min-height: 24px; } }
  .full { grid-column: 1 / -1; }
  .gap-top { margin-top: 16px; }

  // the line between the settings and the content: a full row, 1px
  .sep { height: 1px; margin: 4px 0; background: var(--c-line); }
  .sep--cap {
    display: flex; align-items: center; gap: 8px; height: 16px; background: none;
    color: var(--c-text-faint); font-size: var(--fs-sm); line-height: 16px;
    text-transform: uppercase; letter-spacing: 0.06em;
    &::after { content: ''; flex: 1; height: 1px; background: var(--c-line); }
  }

  // the source card as built (ItemPicker.svelte)
  .sc { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: var(--radius-md);
    background: var(--c-input); box-shadow: inset 0 0 0 1px var(--c-line); }
  .sc__tile { display: grid; place-items: center; flex: none; width: 48px; height: 48px;
    border-radius: var(--radius-md); background: var(--c-switch); color: var(--c-accent); }
  .sc__text { display: grid; flex: 1; min-width: 0; line-height: 16px; }
  .sc__label, .sc__meta { color: var(--c-text-muted); font-size: var(--fs-sm); }
  .sc__name { color: var(--c-text-strong); font-weight: 500; }
  .choose { padding: 0 12px; height: 32px; line-height: 32px; border-radius: var(--radius-pill);
    background: var(--c-text); color: var(--c-on-light); font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.06em; }
</style>
