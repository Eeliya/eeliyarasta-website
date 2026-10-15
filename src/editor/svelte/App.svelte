<!--
  The editor shell: the site preview on the left, the side panel on the right with the
  toolbar (page menu; Sources, Media, Pages | phone, undo, redo; the mode tabs), the current
  tab's panel and the Save / Publish footer. Also the
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
  // The Source Explorer lives in the Content tab (ContentPanel.svelte); it opens itself when
  // ui.explorer.open is set (SourcesModal.svelte), on the list of files.
  function openSources() {
    ui.explorer = { open: true, file: '', index: 0, field: '' };
    if (ui.mode !== 'text') actions.setMode('text');
  }

  // [mode, label, icon]: a tab with an icon shows only the icon
  const TABS = [
    ['browse', 'Browse'],
    ['text', 'Content'],
    ['motion', 'Motion'],
    ['settings', 'Settings'],
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

  // The tab, Header/Footer, the open Source Explorer item and library animation in the URL (persist.js).
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
      // Content tab: then the selected link, else the selected block (the panel shows the
      // sections again, the grid hides); not while typing in a field of the panel.
      const open = document.querySelector('dialog[open]');
      if (open) open.close();
      else {
        const picked = !!bridge.selected;
        if (picked) bridge.select(null);
        if (ui.mode === 'text' && !inField) {
          if (ui.link) ui.link = null;
          else if (ui.block || ui.section) {
            ui.selection = null;
            ui.block = null;
            ui.section = null;
          } else if (ui.selSection) {
            ui.selSection = null;
          } else if (!picked) actions.lockPart(); // nothing picked, a site part open: locked
        } else if (ui.mode === 'motion' && !inField && !picked) actions.lockPart();
      }
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
      <!-- the page or site part shown, full width; the item of a [slug] page under it -->
      <div class="ed-row">
        <PageMenu items={ui.pages} value={ui.target} onchange={actions.pickTarget} />
      </div>
      {#if ui.target?.items}
        <div class="ed-row">
          <Select
            aria-label="Item"
            value={ui.path}
            options={ui.target.items.map((i) => ({ value: i.path, label: i.title }))}
            onchange={(path) => actions.pickTarget(ui.target, path)}
          />
        </div>
      {/if}
      <!-- [ Sources | Media | Pages ] ... [ phone | undo | redo ] (quiet icon buttons) -->
      <div class="ed-row ed-tools">
        <Button
          icon="database"
          iconOnly
          label="Sources"
          title="Sources: people, places, projects (the lists in content/en/sources/)"
          onclick={openSources}
        />
        <Button
          icon="images"
          iconOnly
          label="Media"
          title="Media: every photo, upload, alt text"
          onclick={() => openMedia({ key: ui.media.key })}
        />
        <Button
          icon="sitemap"
          iconOnly
          label="Pages"
          title="Pages: add, rename, delete"
          onclick={() => pagesModal.open()}
        />
        <span class="ed-tools__gap"></span>
        <!-- a toggle: the phone view, on (the accent) or off -->
        <Button
          icon="mobile-screen-button"
          iconOnly
          label="Phone view"
          aria-pressed={mobile}
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
      </div>
      <!-- the modes: evenly spread, the picked one with a white line; their line ends the toolbar -->
      <nav class="ed-modes" aria-label="Mode">
        {#each TABS as [mode, label] (mode)}
          <button
            type="button"
            class={['ed-modes__btn', ui.mode === mode && 'is-active']}
            aria-current={ui.mode === mode ? 'page' : undefined}
            onclick={() => actions.setMode(mode)}
          >
            {label}
          </button>
        {/each}
      </nav>
    </header>

    {#if ui.mode === 'text'}
      <ContentPanel {live} {bridge} {actions} />
    {:else if ui.mode === 'motion'}
      <MotionPanel {live} {bridge} />
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
  @use '../styles/mixins' as *;

  .ed-stage {
    position: absolute;
    inset: 0 calc(var(--panel-w) + 24px) 0 0;
    padding: var(--space-3) 0 var(--space-3) var(--space-3);
    display: grid;
    place-items: center;
  }

  // the preview iframe
  .ed-frame {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: var(--radius-xl);
    box-shadow:
      0 0 0 1px var(--c-fill-active),
      0 30px 80px -30px var(--c-scrim);
    transition:
      width 0.5s var(--ease-out),
      height 0.5s var(--ease-out);
    background: var(--c-bg-site);
  }

  .ed-stage.is-mobile .ed-frame {
    width: 392px;
    height: min(844px, 100%);
    border-radius: var(--radius-3xl);
  }

  .ed-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: var(--panel-w);
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-2xl);
    overflow: hidden;
    background: var(--c-surface);
    box-shadow:
      inset 0 1px 0 var(--white-a14),
      inset 0 0 0 1px var(--c-fill-active),
      0 24px 60px -20px var(--c-scrim),
      0 2px 10px var(--black-a40);
  }

  // the tab panels (child components) may shrink
  .ed-panel > :global(*) {
    min-width: 0;
  }

  // [ page menu ], [ Sources Media Pages ... phone undo redo ], then the modes; 16px edges
  .ed-head {
    flex: none;
    padding-top: var(--space-4);
    @include stack(var(--space-2));
  }

  .ed-row {
    display: flex;
    min-width: 0;
    padding-inline: var(--space-4);

    > :global(*) {
      flex: 1;
      min-width: 0;
    }
  }

  // icon buttons: their glyphs on the 16px edges (a quiet 32px button, its icon 16px)
  .ed-tools {
    align-items: center;
    gap: var(--space-1);
    padding-inline: var(--space-3);

    > :global(*) {
      flex: none;
    }
  }

  .ed-tools__gap {
    flex: 1 !important;
  }

  .ed-modes {
    display: flex;
    margin-top: var(--space-1);
    box-shadow: inset 0 -2px 0 var(--c-line);
  }

  .ed-modes__btn {
    flex: 1;
    height: 32px;
    padding: 0;
    border: 0;
    background: none;
    @include muted;
    font-weight: 600; // every mode: no width change when picked
    letter-spacing: 0.06em;
    line-height: 16px;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      color 0.2s,
      box-shadow 0.2s;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
      color: var(--c-text);
    }

    &.is-active {
      color: var(--c-text-strong);
      box-shadow: inset 0 -2px 0 var(--c-text-strong);
    }
  }

  // [ status line | Save | Publish ]
  .ed-foot {
    border-top: 1px solid var(--c-line);
    padding: var(--space-3) var(--space-4) var(--space-4);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-2);
  }

  .ed-pending {
    min-width: 0;
    margin: 0;
    @include row(var(--space-2));
    @include muted;
    line-height: 16px;

    span {
      @include ellipsis;
    }

    &:is([data-kind='pending'], [data-kind='unsaved']) {
      color: var(--c-text);
    }

    &__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-round);
      background: var(--c-success);
      flex: none;
    }

    &:is([data-kind='pending'], [data-kind='unsaved']) .ed-pending__dot {
      background: var(--c-warning);
      box-shadow: 0 0 0 4px var(--amber-300-a15);
    }
  }

  @media (width <= 900px) {
    .ed-stage {
      inset: 0 0 50vh;
      padding: var(--space-2);
    }
    .ed-panel {
      inset: auto 8px 8px;
      width: auto;
      height: calc(50vh - 16px);
    }
  }
</style>
