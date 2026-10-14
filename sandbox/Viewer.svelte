<!--
  The sandbox index: this machine's mocks (sandbox/mocks/, git-ignored), newest first, each
  opening live (?mock=name); delete one, or every mock older than N days (/__mocks,
  scripts/mock-api.mjs). The kit's demo (sandbox/kit/demo.svelte, tracked) is listed first.
  It refreshes by itself when a mock is added, changed or removed.
-->
<script>
  import Button from '../src/editor/svelte/Button.svelte';

  let mocks = $state([]);
  let days = $state(14);
  let error = $state('');

  const when = (ms) =>
    new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  async function load() {
    try {
      const r = await fetch('/__mocks/list');
      mocks = await r.json();
      error = '';
    } catch (e) {
      error = `Could not list the mocks: ${e.message}`;
    }
  }

  async function remove(body, ask) {
    if (!confirm(ask)) return;
    const r = await fetch('/__mocks/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await r.json();
    error = r.ok ? '' : out.error;
    await load();
  }

  load();
  import.meta.hot?.on('mocks:changed', load);
</script>

<h3 class="modal__title">Mocks</h3>
<ul class="sb-list">
  <li class="sb-row">
    <a href="?mock=kit-demo">kit-demo</a>
    <span class="hint">the kit (tracked)</span>
  </li>
  {#each mocks as m (m.file)}
    <li class="sb-row">
      <a href="?mock={encodeURIComponent(m.name)}">{m.name}</a>
      <span class="hint">{when(m.mtime)}</span>
      <Button
        size="small"
        icon="trash"
        iconOnly
        label="Delete {m.name}"
        onclick={() => remove({ name: m.file }, `Delete sandbox/mocks/${m.file}?`)}
      />
    </li>
  {:else}
    <li class="sb-row">
      <span class="hint">No mocks yet: add sandbox/mocks/&lt;name&gt;.svelte</span>
    </li>
  {/each}
</ul>
<div class="sb-row">
  <span>Delete older than</span>
  <input
    class="tf__input sb-days"
    type="number"
    min="0"
    step="1"
    aria-label="Days"
    bind:value={days}
  />
  <span>days</span>
  <Button
    size="small"
    variant="danger"
    label="Delete"
    disabled={!(days >= 0)}
    onclick={() =>
      remove({ olderThanDays: days }, `Delete every mock last changed more than ${days} days ago?`)}
  />
</div>
{#if error}<p class="hint sb-error">{error}</p>{/if}
