<!--
  A block's item (BlockInspector.svelte): one button naming it ("people.json · Eeliya Rasta",
  or None / This page's item) that opens a window listing the sources, then a source's items,
  with a search over what is listed. None clears it.
    value     the block's { source, id } or null
    sourceIds the content/en/sources/ ids; itemsOf(id) its items; nameOf(id, item) a name
    none      the label of no item; onpick({ source, id } | undefined)
-->
<script>
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';

  let { value, sourceIds, itemsOf, nameOf, none = 'None', onpick } = $props();

  let dialog = $state();
  let source = $state(''); // the source open in the list ('' = the list of sources)
  let query = $state('');

  const current = $derived.by(() => {
    if (!value?.source) return none;
    const it = itemsOf(value.source).find((i) => i?.id === value.id);
    return `${value.source}.json · ${it ? nameOf(value.source, it) : '—'}`;
  });
  const q = $derived(query.trim().toLowerCase());
  const sources = $derived(sourceIds.filter((id) => !q || id.toLowerCase().includes(q)));
  const items = $derived(
    source
      ? itemsOf(source)
          .map((it, i) => ({ it, i, name: nameOf(source, it) }))
          .filter((r) => !q || r.name.toLowerCase().includes(q))
      : [],
  );

  async function focusFirst() {
    await tick();
    (dialog.querySelector('.xrow.is-selected') || dialog.querySelector('.ip-search'))?.focus();
  }
  function open() {
    source = value?.source || '';
    query = '';
    dialog.showModal();
    focusFirst();
  }
  function enter(id) {
    source = id;
    query = '';
    focusFirst();
  }
  function pick(next) {
    onpick(next);
    dialog.close();
  }
</script>

<Button size="small" title="Pick the item this block shows" aria-haspopup="dialog" onclick={open}>
  <span class="ip-current">{current}</span>
</Button>

<dialog
  class="modal__box ip-modal"
  aria-label="Item"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <ExplorerHead
    title="Item"
    icon="fa-database"
    crumbs={[
      { label: 'Sources', onclick: source ? () => enter('') : undefined },
      ...(source ? [{ label: `${source}.json` }] : []),
    ]}
    sep="/"
    back={source ? 'Back to sources' : ''}
    onback={() => enter('')}
    onclose={() => dialog.close()}
  />
  <div class="ip-body">
    <input
      class="tf__input ip-search"
      type="search"
      placeholder={source ? 'Search items' : 'Search sources'}
      aria-label="Search"
      bind:value={query}
    />
    <div class="ip-list">
      {#if !source}
        <ExplorerRow
          icon="fa-ban"
          name={none}
          meta="No item: the fields show their own text"
          selected={!value?.source}
          onclick={() => pick(undefined)}
        />
        {#each sources as id (id)}
          <ExplorerRow
            icon="fa-database"
            name="{id}.json"
            meta="{itemsOf(id).length} items"
            selected={value?.source === id}
            enter
            onclick={() => enter(id)}
          />
        {/each}
      {:else}
        {#each items as r (r.it?.id ?? r.i)}
          <ExplorerRow
            lead={String(r.i + 1).padStart(2, '0')}
            name={r.name}
            selected={value?.source === source && value?.id === r.it?.id}
            onclick={() => pick({ source, id: r.it.id })}
          />
        {:else}
          <p class="hint small">Nothing found.</p>
        {/each}
      {/if}
    </div>
  </div>
</dialog>

<style lang="scss">
  .ip-current {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dialog.ip-modal {
    width: min(480px, 92vw);
    max-height: min(560px, calc(100vh - 64px));
    padding: 0;
    overflow: hidden;

    &[open] {
      display: flex;
      flex-direction: column;
    }
  }

  .ip-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
    padding: var(--space-4) var(--space-3) var(--space-4);
  }

  .ip-search {
    box-sizing: border-box;
    width: 100%;
    height: var(--size-control);
  }

  .ip-list {
    display: grid;
    gap: var(--space-1);
    overflow: auto;
  }
</style>
