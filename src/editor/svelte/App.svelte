<!--
  The editor shell: the site preview on the left, the side panel on the right with the
  tabs, the toolbar, the current tab's panel and the Save / Publish footer. Also the
  publish dialog, the toasts and the keyboard shortcuts.
  main.js holds the logic: it changes `ui` (ui.svelte.js) and passes `actions`.
-->
<script>
  import PageMenu from './PageMenu.svelte';
  import BrowsePanel from './BrowsePanel.svelte';
  import ContentPanel from './ContentPanel.svelte';
  import MotionPanel from './MotionPanel.svelte';
  import PublishDialog from './PublishDialog.svelte';
  import Toasts from './Toasts.svelte';
  import { ui } from './ui.svelte.js';
  import { MOD, plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: setMode, pickTarget, save, refreshStatus
  let { live, bridge, actions } = $props();

  let publishDialog = $state();
  const publish = () => publishDialog.open();

  const TABS = [
    ['browse', 'Browse'],
    ['text', 'Content'],
    ['motion', 'Motion'],
  ];
  const mobile = $derived(ui.viewport === 'mobile');
  const unpublished = $derived(ui.pub?.files || []);
  const ahead = $derived(ui.pub?.ahead || 0);
  const unpublishedChanges = $derived(unpublished.reduce((n, f) => n + (f.changes || 1), 0));
  const branch = $derived(ui.pub?.branch ? `origin/${ui.pub.branch}` : 'GitHub');

  $effect(() => {
    document.title = `${live.changes ? '● ' : ''}Editor · Eeliya Rasta`;
  });

  /** Keyboard shortcuts, also while the preview has focus (it forwards them: bridge 'key'). */
  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    // Ctrl+Z in a field of the panel undoes the typing there, not an editor step.
    const inField =
      e.target instanceof Element &&
      e.target.matches?.('input, textarea, select') &&
      e.target.ownerDocument === document;
    if (mod && k === 's') {
      e.preventDefault();
      actions.save();
    } else if (mod && k === 'e' && e.shiftKey) {
      e.preventDefault();
      location.href = bridge.path() || '/';
    } else if (mod && k === 'e') {
      e.preventDefault();
      actions.setMode(ui.mode === 'browse' ? ui.lastEdit : 'browse');
    } else if (mod && (k === 'z' || k === 'y') && !inField) {
      e.preventDefault();
      if (k === 'y' || e.shiftKey) live.store.redo();
      else live.store.undo();
    } else if (e.key === 'Escape') {
      // A dialog closes itself on Esc; this also covers Esc pressed in the preview.
      const open = document.querySelector('dialog[open]');
      if (open) open.close();
      else if (bridge.selected) bridge.select(null);
    }
  }
  $effect(() => bridge.on('key', onKey)); // once: the bridge never changes

  /** Leaving the page with unsaved edits: the browser asks first. */
  function onBeforeUnload(e) {
    if (live.store.dirtyFiles().length) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
</script>

<svelte:window onkeydown={onKey} onbeforeunload={onBeforeUnload} />

{#if ui.loadError}
  <p class="ed-boot">Could not load content: {ui.loadError}</p>
{:else}
  <main class={['ed-stage', mobile && 'is-mobile']}>
    <iframe class="ed-frame" title="Site preview" {@attach bridge.attach}></iframe>
  </main>

  <aside class="ed-panel">
    <header class="ed-head">
      <h1 class="ed-brand">Editor <small class="ed-source">dev · local files</small></h1>

      <nav class="seg" aria-label="Mode">
        {#each TABS as [mode, label] (mode)}
          <button
            type="button"
            class={['seg__btn', ui.mode === mode && 'is-active']}
            onclick={() => actions.setMode(mode)}>{label}</button
          >
        {/each}
      </nav>

      <div class="ed-bar" role="toolbar">
        <PageMenu items={ui.pages} value={ui.target} onchange={actions.pickTarget} />
        <!-- the icon shows the view a click switches to -->
        <button
          type="button"
          class="icon-btn"
          title={mobile ? 'Switch to desktop view' : 'Switch to mobile view'}
          onclick={() => (ui.viewport = mobile ? 'desktop' : 'mobile')}
        >
          <i
            class={['fa-solid', mobile ? 'fa-desktop' : 'fa-mobile-screen-button']}
            aria-hidden="true"
          ></i>
        </button>
        <button
          type="button"
          class="icon-btn"
          title="Undo ({MOD}+Z)"
          disabled={!live.canUndo}
          onclick={() => live.store.undo()}
        >
          <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="icon-btn"
          title="Redo ({MOD}+Shift+Z)"
          disabled={!live.canRedo}
          onclick={() => live.store.redo()}
        >
          <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    {#if ui.mode === 'text'}
      <ContentPanel {live} {bridge} />
    {:else if ui.mode === 'motion'}
      <MotionPanel {live} {bridge} />
    {:else}
      <BrowsePanel {live} onpublish={publish} />
    {/if}

    <footer class="ed-foot">
      <p class="ed-pending" data-kind={unpublished.length || ahead ? 'pending' : 'clean'}>
        {#if !ui.pub}
          <span class="muted">Checking for unpublished changes…</span>
        {:else if ui.pub.error}
          <span class="muted">Publish unavailable: {ui.pub.error}</span>
        {:else}
          <i class="ed-pending__dot"></i>
          {#if unpublished.length}
            <span>
              <b>{plural(unpublishedChanges, 'saved change')}</b>
              not published · {plural(unpublished.length, 'file')}
            </span>
          {:else}
            <span class="muted">Everything saved is published</span>
          {/if}
          {#if ahead}
            <span class="muted">· {plural(ahead, 'commit')} not pushed</span>
          {/if}
        {/if}
      </p>
      <p class="ed-status" role="status" aria-live="polite">{ui.status}</p>
      <button
        type="button"
        class="btn-ghost"
        title="Write the changes to content/*.json as a draft ({MOD}+S)"
        disabled={!live.changes || ui.saving || ui.publishing}
        onclick={() => actions.save()}
      >
        {ui.saving ? 'Saving…' : `Save${live.changes ? ` · ${live.changes}` : ''}`}
      </button>
      <button
        type="button"
        class="btn-primary"
        title="Commit all saved content changes in one commit and push to {branch}"
        disabled={ui.publishing || (!unpublished.length && !ahead && !live.changes)}
        onclick={publish}
      >
        {ui.publishing
          ? 'Publishing…'
          : `Publish${unpublished.length ? ` · ${unpublishedChanges}` : ''}`}
      </button>
    </footer>
  </aside>

  <PublishDialog {live} {actions} bind:this={publishDialog} />
  <Toasts />
{/if}

<style lang="scss">
  .ed-stage {
    position: absolute;
    inset: 0 calc(var(--panel-w) + 24px) 0 0;
    padding: 12px 0 12px 12px;
    display: grid;
    place-items: center;
  }

  // the preview iframe
  .ed-frame {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 14px;
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 0.08),
      0 30px 80px -30px rgb(0 0 0 / 0.9);
    transition:
      width 0.5s var(--ease-out),
      height 0.5s var(--ease-out);
    background: var(--bg);
  }

  .ed-stage.is-mobile .ed-frame {
    width: 390px;
    height: min(844px, 100%);
    border-radius: 28px;
  }

  .ed-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: var(--panel-w);
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    overflow: hidden;
    // glass: see-through and blurred over the stage
    background: rgb(22 22 22 / 0.62);
    -webkit-backdrop-filter: blur(24px) saturate(170%);
    backdrop-filter: blur(24px) saturate(170%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.14),
      inset 0 0 0 1px rgb(255 255 255 / 0.08),
      0 24px 60px -20px rgb(0 0 0 / 0.9),
      0 2px 10px rgb(0 0 0 / 0.4);
  }

  // the tab panels (child components) may shrink
  .ed-panel > :global(*) {
    min-width: 0;
  }

  .ed-head {
    padding: 16px 16px 12px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    border-bottom: 1px solid var(--line);
  }

  // "Editor" + the source pill (h1 > small)
  .ed-brand {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin: 0;
    font-family: var(--f-display);
    font-size: 22px;
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.01em;
  }

  .ed-source {
    font-family: var(--f-mono);
    font-size: 10px;
    line-height: 1.5;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #b9f0c4;
    padding: 4px 8px;
    border-radius: 999px;
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .ed-bar {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  // pending line and status on their own rows, then [ empty | Save | Publish ]
  .ed-foot {
    border-top: 1px solid var(--line);
    padding: 10px 16px 14px;
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 8px;
  }

  .ed-foot > .btn-ghost {
    grid-column: 2;
  }

  .ed-pending {
    grid-column: 1 / -1;
    margin: 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 4px;
    font-size: 11px;
    color: var(--muted);

    b {
      color: var(--fg);
      font-weight: 500;
    }

    &__dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-right: 4px;
      background: #b9f0c4;
      flex: none;
    }

    &[data-kind='pending'] .ed-pending__dot {
      background: #ffcf7a;
      box-shadow: 0 0 0 3px rgb(255 207 122 / 0.15);
    }
  }

  .ed-status {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--faint);
    font-size: 10.5px;
    min-height: 1.5em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 900px) {
    .ed-stage {
      inset: 0 0 50vh 0;
      padding: 8px;
    }
    .ed-panel {
      top: auto;
      left: 8px;
      right: 8px;
      bottom: 8px;
      width: auto;
      height: calc(50vh - 16px);
    }
  }
</style>
