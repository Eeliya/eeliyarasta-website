<!-- mock: the editor panel's top (brand, phone/undo/redo, modes, page picker, Sources/Pages/Media)
     v: now | a (underline mode tabs) | b (icon rail) | c (two rows + breadcrumbs) | d (one row,
     segmented icons). Eeliya's spacing: 8px sides, no line under the toolbar, 12px above the page tabs. -->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  import Tabs from '../../src/editor/svelte/Tabs.svelte';
  import PageMenu from '../../src/editor/svelte/PageMenu.svelte';
  import Section from '../../src/editor/svelte/Section.svelte';

  let { v = 'now', caption = '' } = $props();
  const nop = () => {};
  const PAGES = [
    { kind: 'part', id: 'header', title: 'Header', path: '---' },
    { kind: 'part', id: 'footer', title: 'Footer', path: '---' },
    { kind: 'page', path: '/', title: 'Eeliya Rasta: Photography', group: 'Pages' },
  ];
  const page = PAGES[2];
  const MODES = [
    ['browse', 'Browse', 'fa-compass'],
    ['text', 'Content', 'fa-pen'],
    ['motion', 'Motion', 'fa-wand-magic-sparkles'],
    ['settings', 'Settings', 'fa-gear'],
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
{#snippet pill()}
  <nav class="seg seg--pill" aria-label="Mode">
    {#each MODES as [m, label, icon] (m)}
      <button
        type="button"
        class={['seg__btn', m === 'settings' && 'seg__btn--icon', m === 'text' && 'is-active']}
      >
        {#if m === 'settings'}<i class={['fa-solid', icon]}></i>{:else}{label}{/if}
      </button>
    {/each}
  </nav>
{/snippet}
{#snippet body()}
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
{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  <div class={['ptp', v === 'b' && 'is-rail']}>
    {#if v === 'b'}
      <nav class="rail" aria-label="Mode">
        {#each MODES as [m, label, icon] (m)}
          <button
            type="button"
            class={['rail__btn', m === 'text' && 'is-active']}
            title={label}
            aria-label={label}><i class={['fa-solid', icon]}></i></button
          >
        {/each}
        <span class="rail__gap"></span>
        {@render tools()}
      </nav>
    {/if}
    <div class="main">
      {#if v === 'now'}
        <header class="head">
          <h1 class="brand">Editor</h1>
          {@render tools()}
          <div class="full">{@render pill()}</div>
          <div class="full bar">
            <PageMenu items={PAGES} value={page} onchange={nop} />{@render libs()}
          </div>
        </header>
      {:else if v === 'a'}
        <header class="head">
          <div class="full bar">
            <PageMenu items={PAGES} value={page} onchange={nop} />{@render tools()}
          </div>
        </header>
        <div class="modes">
          <Tabs tabs={MODES.map(([m, l]) => [m, l])} value="text" onpick={nop} label="Mode" />
        </div>
        <div class="libs">{@render libs()}</div>
      {:else if v === 'b'}
        <header class="head">
          <div class="full bar">
            <PageMenu items={PAGES} value={page} onchange={nop} />{@render libs()}
          </div>
        </header>
      {:else if v === 'c'}
        <header class="head">
          <h1 class="brand">Editor</h1>
          {@render tools()}
          <div class="full">{@render pill()}</div>
          <div class="full crumbs">
            <button type="button" class="crumb">Site</button><i class="fa-solid fa-chevron-right"
            ></i>
            <button type="button" class="crumb is-here"
              >Home <i class="fa-solid fa-chevron-down"></i></button
            ><i class="fa-solid fa-chevron-right"></i>
            <button type="button" class="crumb">Section 1</button><i
              class="fa-solid fa-chevron-right"
            ></i>
            <span class="crumb is-last">Hero</span>
            <span class="crumbs__libs">{@render libs()}</span>
          </div>
        </header>
      {:else}
        <header class="head">
          <div class="full bar d">
            <PageMenu items={PAGES} value={page} onchange={nop} />
            <nav class="seg seg--pill" aria-label="Mode">
              {#each MODES as [m, label, icon] (m)}<button
                  type="button"
                  class={['seg__btn', 'seg__btn--icon', m === 'text' && 'is-active']}
                  title={label}
                  aria-label={label}><i class={['fa-solid', icon]}></i></button
                >{/each}
            </nav>
          </div>
          <div class="full bar d2">{@render tools()}<span></span>{@render libs()}</div>
        </header>
      {/if}
      {@render body()}
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
    height: 440px;
    background: var(--c-surface);
    border-radius: var(--radius-2xl);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px var(--c-fill-active);
  }
  .ptp.is-rail {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
  }
  .main {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .head {
    padding: var(--space-4) var(--space-2) 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, auto);
    align-items: center;
    gap: var(--space-3) var(--space-1);
  }
  .full {
    grid-column: 1 / -1;
  }
  .brand {
    margin: 0;
    font-family: var(--f-display);
    font-size: var(--fs-2xl);
    font-weight: 400;
    line-height: 1;
  }
  .bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, auto);
    align-items: center;
    gap: var(--space-1);
  }
  .bar.d {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .bar.d2 {
    grid-template-columns: repeat(3, auto) 1fr repeat(3, auto);
  }
  .modes {
    padding-top: var(--space-3);
  }
  .libs {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-2) 0;
  }
  .main :global(.ptabs) {
    padding-top: 12px;
  }
  .pane {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-4) 0;
    border-right: 1px solid var(--c-line);
  }
  .rail__gap {
    flex: 1;
  }
  .rail__btn {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--c-text-muted);
  }
  .rail__btn.is-active {
    background: var(--c-fill-active);
    color: var(--c-accent);
  }
  .crumbs {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: 32px;
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    i {
      font-size: var(--fs-xs);
    }
  }
  .crumb {
    height: 24px;
    padding: 0 var(--space-1);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
    font: inherit;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap;
  }
  .crumb.is-here {
    color: var(--c-text);
    background: var(--c-fill-active);
  }
  .crumb.is-last {
    color: var(--c-accent);
    display: inline-flex;
  }
  .crumbs__libs {
    margin-left: auto;
    display: flex;
    gap: var(--space-1);
  }
</style>
