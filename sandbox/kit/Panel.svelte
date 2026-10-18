<!--
  The editor's side panel, App.svelte's markup with its own styles (styles.js): the tools row
  (Sources, Media … Preview | phone, undo, redo), the mode tabs, the page head (PageHead.svelte's
  look: ← title / path; page: { title, path }, false hides it), the page tabs (the real Tabs),
  the scroll body (.ed-body) and the Save / Publish footer.
    mode     'text' | 'motion' | 'settings' | 'preview' (default 'text'; preview: ▶ on, no mode tabs)
    tab      the page tab shown (default 'sections'); tabs: false hides them
    height   the panel's height (default 844px)       pending  the footer's line
    changes  unsaved changes (Save · N)               children the body
-->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  import Tabs from '../../src/editor/svelte/Tabs.svelte';
  import { APP } from './styles.js';

  let {
    mode = 'text',
    tab = 'sections',
    tabs = true,
    page = { title: 'Home', path: '/' },
    height = '844px',
    pending = 'Everything is published',
    changes = 0,
    children,
  } = $props();
  const MODES = [
    ['text', 'Content'],
    ['motion', 'Motion'],
    ['settings', 'Settings'],
  ];
  const PAGE_TABS = [
    ['sections', 'Sections'],
    ['transitions', 'Transitions'],
    ['seo', 'SEO'],
  ];
</script>

<div class={APP}>
  <aside class="ed-panel kit-panel" style:height>
    <header class="ed-head">
      <div class="ed-row ed-tools">
        <Button icon="database" iconOnly label="Sources" />
        <Button icon="images" iconOnly label="Media" />
        <span class="ed-tools__gap"></span>
        <Button icon="play" iconOnly label="Preview" aria-pressed={mode === 'preview'} />
        <span class="ed-tools__sep" aria-hidden="true"></span>
        <Button icon="mobile-screen-button" iconOnly label="Phone view" aria-pressed={false} />
        <Button icon="rotate-left" iconOnly label="Undo" disabled={!changes} />
        <Button icon="rotate-right" iconOnly label="Redo" disabled />
      </div>
      {#if mode !== 'preview'}
        <nav class="ed-modes" aria-label="Mode">
          {#each MODES as [m, label] (m)}
            <button type="button" class={['ed-modes__btn', mode === m && 'is-active']}
              >{label}</button
            >
          {/each}
        </nav>
      {/if}
    </header>
    {#if page && (mode === 'text' || mode === 'motion')}
      <div class="kit-ph">
        <Button size="small" icon="arrow-left" iconOnly label="Pages" />
        <div>
          <b>{page.title}</b>
          <span>{page.path}</span>
        </div>
      </div>
    {/if}
    {#if tabs && mode === 'text'}
      <Tabs
        tabs={PAGE_TABS}
        value={tab}
        onpick={() => {}}
        label="Page"
        class="page-tabs"
        id="kit-tabs"
      />
    {/if}
    <section class="ed-body">{@render children?.()}</section>
    <footer class="ed-foot">
      <p class="ed-pending" data-kind={changes ? 'unsaved' : 'none'} role="status">
        {#if changes}<i class="ed-pending__dot"></i>{/if}<span
          >{changes ? 'Unsaved changes' : pending}</span
        >
      </p>
      <Button disabled={!changes}>{`Save${changes ? ` · ${changes}` : ''}`}</Button>
      <Button variant="primary">Publish</Button>
    </footer>
  </aside>
</div>

<style lang="scss">
  // in place, not fixed to the window's right edge (App's .ed-panel is absolute)
  :global(.kit-app) > .kit-panel {
    position: relative;
    inset: auto;
  }

  // PageHead.svelte's box: 16px edges, 48px; the title over its path
  .kit-ph {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    min-height: 48px;
    padding: var(--space-4) var(--space-4) 0;
    box-sizing: content-box;

    div {
      display: grid;
      font-size: var(--fs-base);
      line-height: 20px;
    }

    b {
      color: var(--c-text-strong);
      font-weight: 500;
    }

    span {
      color: var(--c-text-muted);
    }
  }

  // ContentPanel's page tabs padding (its :global rule only lives while it is mounted)
  .kit-panel > :global(.page-tabs) {
    flex: none;
    padding: var(--space-3) var(--space-1) 0;
  }
</style>
