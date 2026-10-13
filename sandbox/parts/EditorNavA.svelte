<!-- mock: variants of editor nav A (picker + tools on top, modes as underline tabs), each with
     the page tabs below. v: a0 (A as mocked, 8px edges) | a1..a5. a1..a5 align every edge at
     16px (text and controls), lines run the full width. -->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  import Tabs from '../../src/editor/svelte/Tabs.svelte';
  import PageMenu from '../../src/editor/svelte/PageMenu.svelte';
  import Section from '../../src/editor/svelte/Section.svelte';

  let { v = 'a0', caption = '' } = $props();
  const nop = () => {};
  const PAGES = [
    { kind: 'part', id: 'header', title: 'Header', path: '---' },
    { kind: 'part', id: 'footer', title: 'Footer', path: '---' },
    { kind: 'page', path: '/', title: 'Eeliya Rasta: Photography', group: 'Pages' },
  ];
  const MODES = [
    ['browse', 'Browse'],
    ['text', 'Content'],
    ['motion', 'Motion'],
    ['settings', 'Settings'],
  ];
  const PTABS = [
    ['sections', 'Sections'],
    ['transitions', 'Transitions'],
    ['seo', 'SEO'],
  ];
</script>

{#snippet tools()}
  <Button icon="mobile-screen-button" iconOnly label="Phone view" onclick={nop} />
  <Button icon="rotate-left" iconOnly label="Undo" onclick={nop} />
  <Button icon="rotate-right" iconOnly label="Redo" disabled onclick={nop} />
{/snippet}
{#snippet libs()}
  <Button icon="database" iconOnly label="Sources" onclick={nop} />
  <Button icon="sitemap" iconOnly label="Pages" onclick={nop} />
  <Button icon="images" iconOnly label="Media" onclick={nop} />
{/snippet}
{#snippet picker()}<PageMenu items={PAGES} value={PAGES[2]} onchange={nop} />{/snippet}
{#snippet modes(cls = '')}<Tabs
    tabs={MODES}
    value="text"
    onpick={nop}
    label="Mode"
    class={cls}
  />{/snippet}
{#snippet ptabs(cls = '')}<Tabs
    tabs={PTABS}
    value="sections"
    onpick={nop}
    label="Page"
    class={cls}
  />{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  <div class={['ptp', `is-${v}`]}>
    {#if v === 'r1' || v === 'r2'}
      <div class="row one">{@render picker()}</div>
      <div class="row two">
        {#if v === 'r1'}
          <Button icon="database" iconOnly label="Sources" onclick={nop} />
          <Button icon="images" iconOnly label="Media" onclick={nop} />
          <Button icon="sitemap" iconOnly label="Pages" onclick={nop} />
        {:else}
          <button type="button" class="qb"
            ><i class="fa-solid fa-database" aria-hidden="true"></i>Sources</button
          >
          <button type="button" class="qb"
            ><i class="fa-solid fa-images" aria-hidden="true"></i>Media</button
          >
          <button type="button" class="qb"
            ><i class="fa-solid fa-sitemap" aria-hidden="true"></i>Pages</button
          >
        {/if}
        <span></span>
        {@render tools()}
      </div>
      <div class="gap12">{@render modes('al')}</div>
      <div class="gap12">{@render ptabs('al')}</div>
    {:else if v === 'a0'}
      <div class="row r8">{@render picker()}{@render tools()}</div>
      <div class="gap12">{@render modes()}</div>
      <div class="row libs r8">{@render libs()}</div>
      <div class="gap12">{@render ptabs()}</div>
    {:else if v === 'a1'}
      <div class="row">{@render picker()}{@render tools()}</div>
      <div class="gap12">{@render modes('al')}</div>
      <div class="row libs">{@render libs()}</div>
      {@render ptabs('al quiet')}
    {:else if v === 'a2'}
      <div class="row">{@render picker()}{@render tools()}</div>
      <div class="gap12 mrow">{@render modes('al')}<span class="mlibs">{@render libs()}</span></div>
      <div class="gap8">{@render ptabs('al quiet nolines')}</div>
    {:else if v === 'a3'}
      <div class="row title">{@render picker()}{@render tools()}</div>
      <div class="gap8 mrow">{@render modes('al')}<span class="mlibs">{@render libs()}</span></div>
      <div class="chips">
        {#each PTABS as [t, l] (t)}<button
            type="button"
            class={['chip', t === 'sections' && 'is-active']}>{l}</button
          >{/each}
      </div>
    {:else if v === 'a4'}
      <div class="row">{@render picker()}{@render tools()}</div>
      <div class="gap12">{@render modes('al')}</div>
      <div class="row split">
        {@render ptabs('al nolines')}<span class="mlibs">{@render libs()}</span>
      </div>
    {:else}
      <div class="row lp">{@render picker()}{@render libs()}</div>
      <div class="gap12 mrow">
        {@render modes('al')}<span class="mlibs">{@render tools()}</span>
      </div>
      <div class="gap8">{@render ptabs('al quiet nolines')}</div>
    {/if}
    <div class="pane">
      <Section title="Section 1" name="Eeliya Rasta" open={false}
        >{#snippet bar()}<input
            type="checkbox"
            class="switch"
            checked
            aria-label="Show"
          />{/snippet}</Section
      >
      <Section title="Section 2" name="Statement" open={false}
        >{#snippet bar()}<input
            type="checkbox"
            class="switch"
            checked
            aria-label="Show"
          />{/snippet}</Section
      >
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
    height: 400px;
    padding-top: var(--space-4);
    background: var(--c-surface);
    border-radius: var(--radius-2xl);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px var(--c-fill-active);
  }
  // a row of controls: 16px from the edges (a0: 8px, as Eeliya's toolbar now)
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, auto);
    align-items: center;
    gap: var(--space-1);
    padding-inline: var(--space-4);
  }
  .row.r8 {
    padding-inline: var(--space-2);
  }
  .row.lp {
    grid-template-columns: minmax(0, 1fr) repeat(3, auto);
  }
  .one {
    grid-template-columns: minmax(0, 1fr);
  }
  .two {
    grid-template-columns: repeat(3, auto) minmax(0, 1fr) repeat(3, auto);
    padding-top: var(--space-2);
  }
  // a quiet labelled utility: icon + text, no fill, 32px
  .qb {
    height: 32px;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    &:hover {
      color: var(--c-text);
    }
  }
  .two .qb:first-child {
    margin-left: calc(-1 * var(--space-2));
  }
  .libs {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-2);
  }
  .gap12 {
    padding-top: var(--space-3);
  }
  .gap8 {
    padding-top: var(--space-2);
  }
  // tabs whose first label starts at 16px: 4px + the tab's own 12px
  .ptp :global(.al) {
    padding-inline: var(--space-1);
  }
  // page tabs, quieter: sentence case, no tracking
  .ptp :global(.quiet .tabs__btn) {
    text-transform: none;
    letter-spacing: 0;
    font-size: var(--fs-sm);
  }
  .ptp :global(.nolines) {
    box-shadow: none;
  }
  .mrow {
    display: flex;
    align-items: center;
    box-shadow: inset 0 -1px 0 var(--c-line);
  }
  .mrow :global(.tabs) {
    box-shadow: none;
    flex: 1;
  }
  .mlibs {
    display: flex;
    gap: var(--space-1);
    padding-right: var(--space-4);
  }
  .split {
    display: flex;
    padding-inline: 0 0;
    padding-top: var(--space-2);
    align-items: center;
  }
  .split :global(.tabs) {
    flex: 1;
  }
  .title :global(.sel__value) {
    font-family: var(--f-display);
    font-size: var(--fs-xl);
  }
  .chips {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4) 0;
  }
  .chip {
    height: 24px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .chip.is-active {
    background: var(--c-fill-active);
    color: var(--c-text-strong);
  }
  .pane {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
