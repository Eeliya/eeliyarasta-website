<!--
  The sandbox index: this machine's mocks (sandbox/mocks/, git-ignored), newest first, each
  opening live (?mock=name); delete one, or every mock older than N days (/__mocks,
  scripts/mock-api.mjs). The kit's demo (sandbox/kit/demo.svelte, tracked) is listed first.
  It refreshes by itself when a mock is added, changed or removed. Its own plain look: no
  editor styles or components (those are for the mocks only).
-->
<script>
  let mocks = $state([]);
  let days = $state(14);
  let error = $state('');

  const when = (ms) =>
    new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  async function load() {
    try {
      mocks = await (await fetch('/__mocks/list')).json();
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

<main>
  <h1>Mocks</h1>
  <table>
    <tbody>
      <tr>
        <td><a href="?mock=kit-demo">kit-demo</a></td>
        <td class="muted">the kit (tracked)</td>
        <td></td>
      </tr>
      {#each mocks as m (m.file)}
        <tr>
          <td><a href="?mock={encodeURIComponent(m.name)}">{m.name}</a></td>
          <td class="muted">{when(m.mtime)}</td>
          <td>
            <button
              type="button"
              aria-label="Delete {m.name}"
              onclick={() => remove({ name: m.file }, `Delete sandbox/mocks/${m.file}?`)}
              >Delete</button
            >
          </td>
        </tr>
      {:else}
        <tr
          ><td colspan="3" class="muted">No mocks yet: add sandbox/mocks/&lt;name&gt;.svelte</td
          ></tr
        >
      {/each}
    </tbody>
  </table>
  <p>
    Delete mocks older than
    <input type="number" min="0" step="1" aria-label="Days" bind:value={days} /> days
    <button
      type="button"
      disabled={!(days >= 0)}
      onclick={() =>
        remove(
          { olderThanDays: days },
          `Delete every mock last changed more than ${days} days ago?`,
        )}>Delete old</button
    >
  </p>
  {#if error}<p class="error">{error}</p>{/if}
</main>

<style>
  main {
    max-width: 640px;
  }
  h1 {
    margin: 0 0 16px;
    font-size: 20px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 6px 8px 6px 0;
    border-bottom: 1px solid #2a2a2a;
  }
  td:last-child {
    text-align: right;
  }
  a {
    color: #6cb6ff;
  }
  input {
    width: 4em;
  }
  .muted {
    color: #999;
  }
  .error {
    color: #ff7b72;
  }
</style>
