<!--
  Publish dialog: what will be committed (the saved content files, plus the unsaved edits
  when "Save first" is ticked), a commit message, then commit + push through the dev server
  (it commits files in content/ only). Shows the result or the error; a failed push can be
  retried. App.svelte calls open().
-->
<script>
  import { tick } from 'svelte';
  import PubFiles from './PubFiles.svelte';
  import { ui } from './ui.svelte.js';
  import { toast } from './toasts.svelte.js';
  import * as source from '../source.js';
  import { plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); actions: save({ quiet }), refreshStatus()
  let { live, actions } = $props();

  let dialog = $state();
  let textarea = $state();
  let pub = $state(null); // /__editor/status when the dialog opened
  let dirty = $state([]); // files with unsaved edits when the dialog opened
  let edits = $state(0); // number of unsaved edits
  let saveFirst = $state(false);
  let message = $state('');
  let touched = false; // the user typed a message: don't replace it
  let phase = $state(''); // 'Saving…' | 'Publishing…' while busy
  let retry = $state(''); // button label after an error: 'Try again' | 'Retry push'
  let result = $state(null); // { ok: response } or { error }

  const branch = $derived(pub?.branch || 'main');
  // The files the commit will have: their names, and the list shown (saved files first,
  // then the files with only unsaved edits).
  const names = $derived(
    [...new Set([...(pub?.files || []).map((f) => f.name), ...(saveFirst ? dirty : [])])].sort(),
  );
  const listed = $derived([
    ...(pub?.files || []).map((f) => ({
      ...f,
      note:
        saveFirst && dirty.includes(f.name)
          ? ` + ${plural(changes(f.name), 'unsaved change')}`
          : '',
    })),
    ...(saveFirst ? dirty : [])
      .filter((name) => !pub.files.some((p) => p.name === name))
      .map((name) => ({
        path: `content/${name}`,
        status: 'modified',
        changes: changes(name),
        note: ' · unsaved, saved first',
      })),
  ]);
  const published = $derived(!!result?.ok);

  const defaultMessage = (files) =>
    files.length
      ? `Content: update ${files.map((n) => n.replace(/^.*\//, '').replace(/\.json$/, '')).join(', ')} (visual editor)`
      : '';
  const changes = (file) => live.store.changes(file).length;

  export async function open() {
    if (ui.publishing || dialog.open) return;
    await actions.refreshStatus();
    if (ui.pub?.error)
      return toast(`Can't publish: ${ui.pub.error}`, { kind: 'error', timeout: 0 });
    pub = $state.snapshot(ui.pub) || { files: [], ahead: 0 };
    dirty = live.store.dirtyFiles();
    edits = live.changes;
    saveFirst = dirty.length > 0;
    touched = false;
    retry = '';
    result = null;
    message = defaultMessage(names);
    dialog.showModal();
    await tick();
    textarea?.focus();
    textarea?.select();
  }

  function onSaveFirst() {
    if (!touched) message = defaultMessage(names);
  }

  async function publish() {
    if (names.length && !message.trim()) return textarea.focus();
    result = null;
    ui.publishing = true;
    try {
      if (saveFirst && live.store.dirtyFiles().length) {
        phase = 'Saving…';
        if (!(await actions.save({ quiet: true })))
          throw new Error('Saving the unsaved edits failed, nothing was published.');
      }
      phase = 'Publishing…';
      const res = await source.publish(message.trim());
      result = { ok: res };
      toast(`Published ${res.short}`, {
        kind: 'ok',
        timeout: 0,
        link: { href: res.url, label: 'View commit' },
      });
      ui.status = `Published ${res.short} · ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      result = { error: err };
      if (err.committed) {
        // The commit exists locally: only the push is left.
        saveFirst = false;
        dirty = [];
        pub.files = [];
        pub.ahead = Math.max(1, pub.ahead || 0);
        retry = 'Retry push';
      } else retry = 'Try again';
      ui.status = err.committed ? `Commit ${err.short} not pushed` : 'Publish failed';
    } finally {
      phase = '';
      ui.publishing = false;
      await actions.refreshStatus();
    }
  }
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<dialog
  class="modal__box"
  aria-label="Publish to GitHub"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <h3 class="modal__title">Publish to GitHub</h3>
  {#if pub}
    <p class="hint">
      Commits the saved content changes in <b>one commit</b> and runs
      <code>git push origin {branch}</code>. Only files in <code>content/</code> are committed.
    </p>

    {#if !published}
      {#if dirty.length}
        <label class="pub-save">
          <input type="checkbox" bind:checked={saveFirst} onchange={onSaveFirst} />
          Save my {plural(edits, 'unsaved edit')} first and include {edits === 1 ? 'it' : 'them'}
        </label>
      {/if}
      {#if names.length}<PubFiles files={listed} />{/if}
      {#if pub.ahead}
        <p class="hint">
          Also pushes {plural(pub.ahead, 'earlier commit')} not on {pub.upstream ||
            `origin/${branch}`} yet:
        </p>
        <ul class="list commits">
          {#each pub.unpushed || [] as c (c.hash)}<li><code>{c.hash}</code> {c.subject}</li>{/each}
        </ul>
      {/if}
      {#if names.length}
        <label class="tf">
          <span class="tf__label">Commit message</span>
          <textarea
            class="tf__input"
            rows="3"
            bind:this={textarea}
            bind:value={message}
            oninput={() => (touched = true)}></textarea>
        </label>
      {/if}
    {/if}

    {#if result?.ok}
      {@const res = result.ok}
      <p class="pub-ok">
        <i class="fa-solid fa-check" aria-hidden="true"></i> Published
        <a href={res.url} target="_blank" rel="noopener">
          <code>{res.short}</code>
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        </a>
        to origin/{res.branch}
      </p>
      <p class="hint">
        <a href={res.url} target="_blank" rel="noopener" class="pub-url">{res.url}</a>
      </p>
      <p class="hint">
        {res.files?.length
          ? `Committed: ${res.files.join(', ')}`
          : 'Pushed the earlier commits; there were no new content changes.'}
      </p>
    {:else if result?.error}
      {@const err = result.error}
      <p class="error">
        {err.committed ? `Committed locally as ${err.short}, but the push failed.` : err.message}
      </p>
      {#if err.committed}
        <p class="hint">
          {err.error}. The commit stays on your machine; Publish again to retry the push.
        </p>
      {/if}
      {#if err.hint}<p class="pub-hint">{err.hint}</p>{/if}
      {#if err.output}<pre class="pub-out">{err.output}</pre>{/if}
    {/if}
  {/if}

  <footer class="modal__actions">
    <button type="button" class="btn" onclick={() => dialog.close()}>
      {published ? 'Close' : 'Cancel'}
    </button>
    {#if pub && !published}
      <button
        type="button"
        class="btn btn--primary"
        disabled={!!phase || (!names.length && !pub.ahead)}
        onclick={publish}
      >
        {phase || retry || (names.length ? 'Publish' : `Push ${plural(pub.ahead, 'commit')}`)}
      </button>
    {/if}
  </footer>
</dialog>

<style lang="scss">
  .error {
    color: #ff8a7a;
    margin: 8px 0 0;
  }

  .pub-save {
    display: flex;
    gap: 12px;
    align-items: center;
    margin: 0 0 16px;
    padding: 12px;
    border-radius: 12px;
    background: rgb(255 207 122 / 0.08);
    box-shadow: inset 0 0 0 1px rgb(255 207 122 / 0.25);
    cursor: pointer;

    input {
      accent-color: #ffcf7a;
    }
  }

  .commits {
    margin: -4px 0 12px;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);

    code {
      color: var(--hi);
    }
  }

  .pub-ok {
    font-size: 15px;
    margin: 12px 0 8px;
    color: #b9f0c4;

    a {
      color: inherit;
    }

    code {
      font-size: 14px;
      color: inherit;
    }
  }

  .pub-url {
    word-break: break-all;
  }

  .pub-hint {
    margin: 8px 0;
    padding: 12px;
    border-radius: 12px;
    background: rgb(255 138 122 / 0.08);
    box-shadow: inset 0 0 0 1px rgb(255 138 122 / 0.25);
  }

  .pub-out {
    margin: 8px 0 0;
    padding: 12px;
    max-height: 180px;
    overflow: auto;
    border-radius: 12px;
    background: rgb(0 0 0 / 0.5);
    box-shadow: inset 0 0 0 1px var(--line);
    font: 11px/1.5 var(--f-mono);
    color: #ffb4a8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
