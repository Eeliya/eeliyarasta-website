<!--
  The editor shell: the site preview on the left, the side panel on the right with the
  tabs, the toolbar, the current tab's panel and the Save / Publish footer.
  main.js holds the logic: it changes `ui` (ui.svelte.js) and passes `actions`.
-->
<script>
  import PageMenu from './PageMenu.svelte';
  import ContentPanel from './ContentPanel.svelte';
  import { ui } from './ui.svelte.js';
  import { MOD, plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: setMode, pickTarget, save, publish
  let { live, bridge, actions } = $props();

  // Browse and Motion are not Svelte yet: main.js renders them into this element.
  let body = $state();
  export const panelBody = () => body;

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
</script>

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
  {/if}
  <!-- not Svelte yet: Browse and Motion render into this (see main.js renderBody) -->
  <section class="ed-body" hidden={ui.mode === 'text'} bind:this={body}></section>

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
      onclick={actions.save}
    >
      {ui.saving ? 'Saving…' : `Save${live.changes ? ` · ${live.changes}` : ''}`}
    </button>
    <button
      type="button"
      class="btn-primary"
      title="Commit all saved content changes in one commit and push to {branch}"
      disabled={ui.publishing || (!unpublished.length && !ahead && !live.changes)}
      onclick={actions.publish}
    >
      {ui.publishing
        ? 'Publishing…'
        : `Publish${unpublished.length ? ` · ${unpublishedChanges}` : ''}`}
    </button>
  </footer>
</aside>
