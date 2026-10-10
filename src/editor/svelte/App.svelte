<!--
  The editor shell: the site preview on the left, the side panel on the right with the
  tabs, the toolbar, the current tab's panel and the Save / Publish footer. Also the
  publish dialog, the toasts and the keyboard shortcuts.
  main.js holds the logic: it changes `ui` (ui.svelte.js) and passes `actions`.
-->
<script>
  import Button from './Button.svelte';
  import PageMenu from './PageMenu.svelte';
  import Select from './Select.svelte';
  import BrowsePanel from './BrowsePanel.svelte';
  import ContentPanel from './ContentPanel.svelte';
  import MotionPanel from './MotionPanel.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import PublishDialog from './PublishDialog.svelte';
  import PagesModal from './PagesModal.svelte';
  import MediaModal from './MediaModal.svelte';
  import { openMedia } from './media.svelte.js';
  import Toasts from './Toasts.svelte';
  import { ui } from './ui.svelte.js';
  import { writeUrl } from './persist.js';
  import { MOD, plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: setMode, pickTarget, save, refreshStatus, pagesOp
  let { live, bridge, actions } = $props();

  let publishDialog = $state();
  let pagesModal = $state();
  const publish = () => publishDialog.open();

  // [mode, label, icon]: a tab with an icon shows only the icon
  const TABS = [
    ['browse', 'Browse'],
    ['text', 'Content'],
    ['motion', 'Motion'],
    ['settings', 'Settings', 'fa-gear'],
  ];
  const mobile = $derived(ui.viewport === 'mobile');
  const unpublished = $derived(ui.pub?.files || []);
  const ahead = $derived(ui.pub?.ahead || 0);
  const unpublishedChanges = $derived(unpublished.reduce((n, f) => n + (f.changes || 1), 0));
  // the footer's status line: what is left to do (unsaved, to publish, to push) or done
  const pending = $derived.by(() => {
    const details = [
      unpublished.length &&
        `${plural(unpublishedChanges, 'saved change')} not published (${plural(unpublished.length, 'file')})`,
      ahead && `${plural(ahead, 'commit')} not pushed`,
      ui.pub?.error && `Publish unavailable: ${ui.pub.error}`,
      ui.status,
    ]
      .filter(Boolean)
      .join('\n');
    const line = (kind, text) => ({ kind, text, details });
    if (live.changes) return line('unsaved', 'Unsaved changes');
    if (!ui.pub) return line('none', 'Checking…');
    if (ui.pub.error) return line('none', 'Publish unavailable');
    if (unpublished.length)
      return line('pending', `${plural(unpublishedChanges, 'change')} to publish`);
    if (ahead) return line('pending', `${plural(ahead, 'commit')} to push`);
    return line('clean', 'All published');
  });
  const branch = $derived(ui.pub?.branch ? `origin/${ui.pub.branch}` : 'GitHub');

  // The tab, Menu/Footer, the open Source Explorer item and library animation in the URL (persist.js).
  $effect(writeUrl);

  $effect(() => {
    document.title = `${live.changes ? '● ' : ''}Editor · Eeliya Rasta`;
  });

  /** Keyboard shortcuts, also while the preview has focus (it forwards them: bridge 'key'). */
  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    // Ctrl+Z in a text field of the panel undoes the typing there, not an editor step
    // (switches, sliders and selects have none: there it is the editor's undo).
    const inField =
      e.target instanceof Element &&
      e.target.matches?.('textarea, input:not([type="checkbox"], [type="range"])') &&
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
      <!-- Editor | mobile view, undo, redo -->
      <h1 class="ed-brand">Editor</h1>
      <!-- the icon shows the view a click switches to -->
      <Button
        icon={mobile ? 'desktop' : 'mobile-screen-button'}
        iconOnly
        label={mobile ? 'Switch to desktop view' : 'Switch to mobile view'}
        onclick={() => (ui.viewport = mobile ? 'desktop' : 'mobile')}
      />
      <Button
        icon="rotate-left"
        iconOnly
        label="Undo ({MOD}+Z)"
        disabled={!live.canUndo}
        onclick={() => live.store.undo()}
      />
      <Button
        icon="rotate-right"
        iconOnly
        label="Redo ({MOD}+Shift+Z)"
        disabled={!live.canRedo}
        onclick={() => live.store.redo()}
      />

      <nav class="seg seg--pill" aria-label="Mode">
        {#each TABS as [mode, label, icon] (mode)}
          <button
            type="button"
            class={['seg__btn', icon && 'seg__btn--icon', ui.mode === mode && 'is-active']}
            aria-label={icon && label}
            title={icon && label}
            onclick={() => actions.setMode(mode)}
          >
            {#if icon}<i class={['fa-solid', icon]} aria-hidden="true"></i>{:else}{label}{/if}
          </button>
        {/each}
      </nav>

      <!-- [ page / component | Pages | Media ], then the item of a [slug] page on its own row -->
      <div class="ed-bar">
        <PageMenu items={ui.pages} value={ui.target} onchange={actions.pickTarget} />
        <Button
          icon="sitemap"
          iconOnly
          label="Pages"
          title="Pages: add, rename, delete"
          onclick={() => pagesModal.open()}
        />
        <Button
          icon="images"
          iconOnly
          label="Media"
          title="Media: every photo, upload, alt text"
          onclick={() => openMedia({ key: ui.media.key })}
        />
        {#if ui.target?.items}
          <!-- a [slug] page: which item's page the preview shows -->
          <div class="ed-bar__item">
            <Select
              aria-label="Item"
              value={ui.path}
              options={ui.target.items.map((i) => ({ value: i.path, label: i.title }))}
              onchange={(path) => actions.pickTarget(ui.target, path)}
            />
          </div>
        {/if}
      </div>
    </header>

    {#if ui.mode === 'text'}
      <ContentPanel {live} {bridge} />
    {:else if ui.mode === 'motion'}
      <MotionPanel {live} {bridge} onsettings={() => actions.setMode('settings')} />
    {:else if ui.mode === 'settings'}
      <SettingsPanel {live} {bridge} />
    {:else}
      <BrowsePanel {live} onpublish={publish} />
    {/if}

    <footer class="ed-foot">
      <!-- one short line before Save / Publish; the details in its tooltip -->
      <p class="ed-pending" data-kind={pending.kind} title={pending.details} role="status">
        {#if pending.kind !== 'none'}<i class="ed-pending__dot"></i>{/if}
        <span>{pending.text}</span>
      </p>
      <Button
        title="Write the changes to content/*.json as a draft ({MOD}+S)"
        disabled={!live.changes || ui.saving || ui.publishing}
        onclick={() => actions.save()}
      >
        {ui.saving ? 'Saving…' : `Save${live.changes ? ` · ${live.changes}` : ''}`}
      </Button>
      <Button
        variant="primary"
        title="Commit all saved content changes in one commit and push to {branch}"
        disabled={ui.publishing || (!unpublished.length && !ahead && !live.changes)}
        onclick={publish}
      >
        {ui.publishing
          ? 'Publishing…'
          : `Publish${unpublished.length ? ` · ${unpublishedChanges}` : ''}`}
      </Button>
    </footer>
  </aside>

  <PublishDialog {live} {actions} bind:this={publishDialog} />
  <PagesModal {live} {actions} bind:this={pagesModal} />
  <MediaModal {live} {bridge} {actions} />
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
    border-radius: 16px;
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 0.08),
      0 30px 80px -30px rgb(0 0 0 / 0.9);
    transition:
      width 0.5s var(--ease-out),
      height 0.5s var(--ease-out);
    background: var(--bg);
  }

  .ed-stage.is-mobile .ed-frame {
    width: 392px;
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
    border-radius: 20px;
    overflow: hidden;
    background: var(--bg-2);
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

  // [ Editor | mobile | undo | redo ], then the tabs and the page menu on full rows
  .ed-head {
    padding: 16px 16px 12px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, auto);
    align-items: center;
    gap: 12px 4px;
    border-bottom: 1px solid var(--line);

    > .seg,
    > .ed-bar {
      grid-column: 1 / -1;
    }
  }

  .ed-brand {
    margin: 0;
    font-family: var(--f-display);
    font-size: 22px;
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.01em;
  }

  .ed-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
  }

  .ed-bar__item {
    grid-column: 1 / -1;
    display: flex;
  }

  // [ status line | Save | Publish ]
  .ed-foot {
    border-top: 1px solid var(--line);
    padding: 12px 16px 16px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
  }

  .ed-pending {
    min-width: 0;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    line-height: 16px;
    color: var(--muted);

    span {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &:is([data-kind='pending'], [data-kind='unsaved']) {
      color: var(--fg);
    }

    &__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #b9f0c4;
      flex: none;
    }

    &:is([data-kind='pending'], [data-kind='unsaved']) .ed-pending__dot {
      background: #ffcf7a;
      box-shadow: 0 0 0 3px rgb(255 207 122 / 0.15);
    }
  }

  @media (width <= 900px) {
    .ed-stage {
      inset: 0 0 50vh;
      padding: 8px;
    }
    .ed-panel {
      inset: auto 8px 8px;
      width: auto;
      height: calc(50vh - 16px);
    }
  }
</style>
