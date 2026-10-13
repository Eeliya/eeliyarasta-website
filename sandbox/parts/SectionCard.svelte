<!-- mock: the block view's section settings (Back header, Name, Height | Width) in a bordered
     card above the block's filled card. v: now | a (border, header outside) | b (border, header
     inside) | c (border, header as the card's title row, a line under it). Includes Eeliya's
     uncommitted tweaks: no toolbar line, 12px above the page tabs. -->
<script>
  import Tabs from '../../src/editor/svelte/Tabs.svelte';
  import Field from '../../src/editor/svelte/Field.svelte';
  import Button from '../../src/editor/svelte/Button.svelte';
  import SectionIcon from '../../src/editor/svelte/SectionIcon.svelte';

  let { v = 'now', caption = '' } = $props();
  const nop = () => {};
  const HEIGHTS = [
    ['custom', 'rows'],
    ['fit', 0],
    ['third', 1 / 3],
    ['half', 1 / 2],
    ['full', 1],
  ];
  const WIDTHS = [
    ['contained', 'inside'],
    ['full', 'edge'],
  ];
</script>

{#snippet head()}
  <div class="sh">
    <Button icon="arrow-left" iconOnly label="Back to sections" onclick={nop} />
    <span class="st">Section 1</span>
    <Button
      size="small"
      icon="location-crosshairs"
      iconOnly
      label="Show in preview"
      onclick={nop}
    />
  </div>
{/snippet}

{#snippet settings()}
  <div class="fields">
    <Field
      label="Name"
      bare
      placeholder="Name"
      value=""
      help="Optional: a #link to this section"
      onvalue={nop}
    />
    <div class="tf is-half">
      <span class="tf__label">Height</span>
      <div class="hset">
        {#each HEIGHTS as [k, a] (k)}<button
            type="button"
            class={['hset__btn', k === 'full' && 'is-active']}
            ><SectionIcon kind="height" arg={a} /></button
          >{/each}
      </div>
    </div>
    <div class="tf is-half">
      <span class="tf__label">Width</span>
      <div class="hset">
        {#each WIDTHS as [k, a] (k)}<button
            type="button"
            class={['hset__btn', k === 'contained' && 'is-active']}
            ><SectionIcon kind="width" arg={a} /></button
          >{/each}
      </div>
    </div>
  </div>
{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  <div class="ptp">
    <Tabs
      tabs={[
        ['sections', 'Sections'],
        ['transitions', 'Transitions'],
        ['seo', 'SEO'],
      ]}
      value="sections"
      onpick={nop}
      label="Page"
      class="ptabs"
    />
    <div class="pane">
      {#if v === 'now'}
        <div class="top">{@render head()}{@render settings()}</div>
      {:else if v === 'a'}
        <div class="top">
          {@render head()}
          <div class="box">{@render settings()}</div>
        </div>
      {:else if v === 'b'}
        <div class="top box">{@render head()}{@render settings()}</div>
      {:else}
        <div class="top box is-titled">
          <div class="boxhead">{@render head()}</div>
          <div class="boxbody">{@render settings()}</div>
        </div>
      {/if}
      <div class="card">
        <div class="head"><span class="title">Hero <strong>Eeliya Rasta</strong></span></div>
        <Tabs
          tabs={[
            ['content', 'Content'],
            ['layout', 'Layout'],
            ['motion', 'Motion'],
          ]}
          value="content"
          onpick={nop}
          label="Block"
          class="card__tabs"
        />
        <div class="card__body fields">
          <Field label="Title" value="Eeliya Rasta" onvalue={nop} />
          <Field label="Subtitle" value="Photography · Amsterdam" onvalue={nop} />
          <Field label="Photo" type="image" value="places/kasteel-de-haar/02.jpg" onvalue={nop} />
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .col {
    width: 384px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cap {
    margin: 0;
    min-height: 48px;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 16px;
  }
  .ptp {
    height: 760px;
    background: var(--c-surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .ptp :global(.ptabs) {
    padding-top: 12px;
  }
  .pane {
    padding: 16px;
    display: flex;
    flex-direction: column;
  }
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .fields > :global(:not(.is-half)) {
    grid-column: 1 / -1;
  }
  .top {
    display: grid;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .box {
    padding: var(--space-3);
    border: 1px solid var(--c-line);
    border-radius: var(--radius-lg);
  }
  .box.is-titled {
    padding: 0;
    gap: 0;
  }
  .boxhead {
    padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
    border-bottom: 1px solid var(--c-line);
  }
  .boxbody {
    padding: var(--space-3);
  }
  .sh {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
  }
  .st {
    color: var(--c-text);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .hset {
    display: flex;
    gap: var(--space-1);
    height: var(--size-control);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--c-line);
    justify-self: start;
  }
  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    height: 24px;
    width: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
  }
  .hset__btn.is-active {
    background: var(--c-fill-active);
    color: var(--c-accent);
  }
  .card {
    padding: var(--space-3) 0;
    border-radius: var(--radius-lg);
    background: var(--c-card);
  }
  .head {
    display: flex;
    margin-bottom: var(--space-3);
    padding-inline: var(--space-3);
  }
  .title {
    display: flex;
    gap: var(--space-2);
    font-size: var(--fs-base);
    strong {
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
