<!--
  A source field (always a whole row of its field grid), labelled "Source list" (mode source)
  or "Source item" (mode item): its label, what it is set to (read only) and a button that opens a window to
  pick it. Every source-using block has one (BlockInspector.svelte, GroupFields.svelte).
    mode      'item'   a block's item, { source, id } or null: a source, then one of its items;
                       it shows "people.json · Eeliya Rasta" and opens on that source's items
              'source' a source id ('' or null: none): it stops at the sources, the current
                       one highlighted; it shows "people.json"
    value, changed (its changed dot), none (the label of no value, null: none can't be
    picked), sourceIds, itemsOf(id) a source's items, nameOf(id, item) an item's name,
    onpick(value | undefined)
    onsource(file, index, edit, then): open the Source Explorer (SourcesModal.svelte); each
              row's edit button closes this window and opens it there, and this window opens
              again on the same source or item when the Source Explorer closes (then)
-->
<script>
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';

  let {
    mode = 'item',
    value,
    changed = false,
    none = 'None',
    sourceIds,
    itemsOf,
    nameOf = () => '',
    onpick,
    onsource,
  } = $props();

  const items_ = $derived(mode === 'item');
  // always named by what it picks: a whole list, or one item of one
  const label = $derived(items_ ? 'Source item' : 'Source list');
  const current = $derived(items_ ? value?.source || '' : value || '');
  const uid = $props.id();
  let dialog = $state();
  let source = $state(''); // the source open in the list ('' = the list of sources)
  let query = $state('');

  const shown = $derived.by(() => {
    if (!current) return none ?? '—';
    if (!items_) return `${current}.json`;
    const it = itemsOf(current).find((i) => i?.id === value.id);
    return `${current}.json · ${it ? nameOf(current, it) : '—'}`;
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

  async function focus(id = '') {
    await tick();
    const row = id && dialog.querySelector(`[data-pick="${CSS.escape(id)}"]`);
    (
      row ||
      dialog.querySelector('.xrow.is-selected') ||
      dialog.querySelector('.ip-search')
    )?.focus();
  }
  /** Open on the current source's items (a block's item), else on the sources. */
  export function open(at = items_ ? current : '', id = '') {
    source = items_ ? at : '';
    query = '';
    if (!dialog.open) dialog.showModal();
    focus(id || (!items_ ? at : ''));
  }
  function enter(id) {
    source = id;
    query = '';
    focus();
  }
  function pick(next) {
    onpick(next);
    dialog.close();
  }
  // edit a source (index -1: its list) or one of its items in the Source Explorer
  function edit(id, index = -1, itemId = '') {
    dialog.close();
    onsource(`sources/${id}.json`, Math.max(0, index), null, () =>
      open(items_ ? (index < 0 && !itemId ? '' : id) : '', itemId || id),
    );
  }
</script>

{#snippet row(props, editLabel, onedit)}
  <div class="ip-row">
    <ExplorerRow {...props} />
    {#if onsource}
      <Button size="small" icon="pen-to-square" iconOnly label={editLabel} onclick={onedit} />
    {/if}
  </div>
{/snippet}

<div class={['opt', changed && 'is-changed']}>
  <span class="tf__label" id="{uid}-label">{label}<i class="dot" title="Changed"></i></span>
  <div class="ip-field">
    <span class={['ip-value', !current && 'is-none']} title={shown}>{shown}</span>
    <Button
      size="small"
      aria-haspopup="dialog"
      aria-describedby="{uid}-label"
      title={items_ ? 'Pick the item this block shows' : 'Pick the source'}
      onclick={() => open()}>Change</Button
    >
  </div>
</div>

<dialog
  class="modal__box ip-modal"
  aria-label={label}
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <ExplorerHead
    title={label}
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
        {#if none !== null}
          <ExplorerRow
            icon="fa-ban"
            name={none}
            meta={items_ ? 'No item: the fields show their own text' : 'No source'}
            selected={!current}
            onclick={() => pick(undefined)}
          />
        {/if}
        {#each sources as id (id)}
          {@render row(
            {
              icon: 'fa-database',
              name: `${id}.json`,
              meta: `${itemsOf(id).length} items`,
              selected: current === id,
              enter: items_,
              'data-pick': id,
              onclick: () => (items_ ? enter(id) : pick(id)),
            },
            `Edit ${id}.json in the Source Explorer`,
            () => edit(id),
          )}
        {/each}
      {:else}
        {#each items as r (r.it?.id ?? r.i)}
          {@render row(
            {
              lead: String(r.i + 1).padStart(2, '0'),
              name: r.name,
              selected: current === source && value?.id === r.it?.id,
              'data-pick': r.it?.id,
              onclick: () => pick({ source, id: r.it.id }),
            },
            `Edit ${r.name} in the Source Explorer`,
            () => edit(source, r.i, r.it?.id),
          )}
        {:else}
          <p class="hint small">Nothing found.</p>
        {/each}
      {/if}
    </div>
  </div>
</dialog>

<style lang="scss">
  .opt {
    grid-column: 1 / -1;
    min-width: 0;
    padding: var(--space-1);

    // (as the block settings' labels beside it: GroupFields.svelte)
    .tf__label {
      min-height: 24px;
    }

    .dot {
      display: none;
    }

    &.is-changed .dot {
      display: inline-block;
    }
  }

  // [ people.json · Eeliya Rasta   (Change) ]
  .ip-field {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-control);
  }

  .ip-value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: var(--fs-base);
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-none {
      color: var(--c-text-muted);
    }
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
    padding: var(--space-4) var(--space-3);
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

  // a row and its edit button
  .ip-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);

    > :global(.xrow) {
      flex: 1;
      min-width: 0;
    }
  }
</style>
