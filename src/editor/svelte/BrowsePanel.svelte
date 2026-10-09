<!--
  Browse tab: how the editor works, the unsaved changes per file (before and after, with
  Discard), and the saved changes that are not published yet.
-->
<script>
  import PubFiles from './PubFiles.svelte';
  import { ui } from './ui.svelte.js';
  import { labelFor } from './content-groups.js';
  import { compile } from '../lib/pointer.js';
  import { MOD, plural } from '../lib/format.js';
  import { ANIMATIONS } from '../../site/files.js';

  // live: reactive store (live.svelte.js); onpublish(): opens the publish dialog
  let { live, onpublish } = $props();

  // Which Discard asks "Discard …?": a file name, 'all', or null.
  let confirming = $state(null);

  // The changed files and their changed values ({ path, value }), after every edit.
  const files = $derived.by(() => {
    live.version;
    return live.store.dirtyFiles().map((name) => ({ name, changes: live.store.changes(name) }));
  });
  const pubFiles = $derived(ui.pub?.files || []);
  const ahead = $derived(ui.pub?.ahead || 0);

  const label = (file, path) =>
    file === ANIMATIONS ? path.join(' › ') : labelFor(live.store, { file, ptr: compile(path) });
  const saved = (file, path) => live.store.getBase(file, compile(path));
  const show = (value) => (value === undefined ? '(removed)' : JSON.stringify(value).slice(0, 80));

  /** Discard the unsaved changes of some files (all when names is undefined). Undo brings them back. */
  function discard(names) {
    confirming = null;
    live.store.discard(names);
  }
</script>

<!-- Discard with an inline "Sure?" (like Delete in the Sources modal). -->
{#snippet discardButton(what, question)}
  {#if confirming === what}
    <span class="confirm">
      {question}
      <button
        type="button"
        class="btn-sm"
        onclick={() => (confirming = null)}
        {@attach (el) => el.focus()}
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn-sm btn-sm--danger"
        onclick={() => discard(what === 'all' ? undefined : [what])}
      >
        <i class="fa-solid fa-trash" aria-hidden="true"></i> Discard
      </button>
    </span>
  {:else}
    <button type="button" class="btn-sm btn-sm--danger" onclick={() => (confirming = what)}>
      <i class="fa-solid fa-trash" aria-hidden="true"></i>
      {what === 'all' ? 'Discard all changes' : 'Discard'}
    </button>
  {/if}
{/snippet}

<section class="ed-body">
  <section class="grp">
    <h4 class="grp__title">How it works</h4>
    <ul class="help">
      <li><b>Content</b> — click any outlined text in the preview and type.</li>
      <li>
        <b>Motion</b> — click an animated element to change its preset, timing, ease and scroll trigger.
        Changes replay live.
      </li>
      <li>
        Browse navigates like the real site. In the edit modes, hold Alt to click through links.
      </li>
      <li>
        <b>Save</b> writes content/*.json on this machine: a draft you can check in Browse. Nothing is
        pushed.
      </li>
      <li>
        <b>Publish</b> commits all saved content changes in one commit and pushes them to GitHub.
      </li>
    </ul>
    <p class="kbd-list">
      <span><kbd>{MOD}+E</kbd> edit mode</span>
      <span><kbd>{MOD}+S</kbd> save</span>
      <span><kbd>{MOD}+Z</kbd> undo</span>
      <span><kbd>Esc</kbd> deselect</span>
      <span><kbd>{MOD}+Shift+E</kbd> exit to live page</span>
    </p>
  </section>

  <section class="grp">
    <h4 class="grp__title">Unsaved changes{files.length ? '' : ': none'}</h4>
    {#each files as f (f.name)}
      <details class="chg" open>
        <summary>
          <code>content/{f.name}</code>
          <span class="muted">· {f.changes.length}</span>
          {@render discardButton(f.name, `Discard ${plural(f.changes.length, 'change')}?`)}
        </summary>
        <ul>
          {#each f.changes.slice(0, 40) as { path, value }, i (i)}
            {@const before = saved(f.name, path)}
            <li>
              <span class="chg__path">{label(f.name, path)}</span>
              {#if before !== undefined}<del class="chg__was">{show(before)}</del>{/if}
              <span class="chg__val">{show(value)}</span>
            </li>
          {/each}
        </ul>
      </details>
    {/each}
    {#if files.length}
      {@render discardButton('all', `Discard all ${plural(live.changes, 'unsaved change')}?`)}
    {/if}
  </section>

  <section class="grp">
    <h4 class="grp__title">Saved, not published{pubFiles.length || ahead ? '' : ': none'}</h4>
    {#if pubFiles.length}<PubFiles files={pubFiles} />{/if}
    {#if ahead}
      <p class="hint">
        {plural(ahead, 'commit')} on {ui.pub.branch} not pushed yet; Publish pushes {ahead === 1
          ? 'it'
          : 'them'} too.
      </p>
    {/if}
    {#if pubFiles.length || ahead}
      <button type="button" class="link" onclick={onpublish}>Publish…</button>
    {/if}
  </section>

  <section class="grp">
    <h4 class="grp__title">Later</h4>
    <p class="hint">
      Swapping and reordering album photos will be added here; for now edit content/sources/*.json
      and media/ by hand.
    </p>
  </section>
</section>

<style lang="scss">
  .help {
    margin: 0 0 12px;
    padding-left: 16px;
    color: var(--muted);

    li {
      margin: 4px 0;
    }

    b {
      color: var(--fg);
      font-weight: 500;
    }
  }

  .kbd-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    color: var(--muted);
    margin: 0;

    kbd {
      padding: 2px 6px;
      border-radius: 5px;
      box-shadow:
        inset 0 0 0 1px var(--line),
        0 1px 0 rgb(255 255 255 / 0.1);
      color: var(--fg);
    }
  }

  // changes
  .chg {
    margin-bottom: 10px;

    summary {
      cursor: pointer;
      margin-bottom: 6px;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0 0 0 12px;
      display: grid;
      gap: 4px;
    }
  }

  .chg__path {
    color: var(--fg);
    margin-right: 8px;
  }

  // the saved value, struck through, before the new one
  .chg__was {
    color: var(--muted);
    margin-right: 8px;
    word-break: break-word;
  }

  .chg__val {
    color: var(--fg);
    word-break: break-word;
  }

  .chg summary .btn-sm,
  .chg summary .confirm {
    margin-left: 6px;
  }
</style>
