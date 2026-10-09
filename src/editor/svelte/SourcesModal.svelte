<!--
  Source Explorer: the lists in content/sources/ (people, places, projects, ...). It starts on
  the files with their item counts; click one to enter it: its items on the left, the
  selected item's fields on the right, Back returns to the files. ContentPanel.svelte calls
  open() from its Sources button (the files), and from a grid's Source edit button or a click
  on a list item in the preview (straight into that file, item or field).
  Where it is lives in ui.explorer, so persist.js can bring it back after a refresh.
-->
<script>
  import { tick, flushSync } from 'svelte';
  import Field from './Field.svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import { ui } from './ui.svelte.js';
  import { isSource } from './content-groups.js';
  import { baseName } from '../../site/files.js';
  import {
    itemName,
    itemMeta,
    pad,
    slugify,
    itemFields,
    newItem,
    valueAt,
  } from './source-items.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  let dialog = $state();
  const file = $derived(ui.explorer.file); // '' = the list of files
  let confirming = $state(false); // "Delete X?" is showing
  let slugBad = $state(false);

  const files = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).filter(isSource).sort();
  });
  const list = $derived(live.current(file));
  const base = $derived(live.base(file) || []);
  const isList = $derived(Array.isArray(list));
  const index = $derived(isList ? Math.max(0, Math.min(ui.explorer.index, list.length - 1)) : 0);
  const item = $derived(isList ? list[index] : undefined);
  const fields = $derived(item ? itemFields(file, item, index) : []);
  const saved = $derived(!!item && base.some((b) => b?.slug === item.slug));

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // An item is changed when it differs from the saved item with the same slug.
  const isChanged = (it) =>
    !same(
      it,
      base.find((b) => b?.slug === it?.slug),
    );
  const fieldChanged = (f) => !same(valueAt(item, f.path), valueAt(base[index], f.path));
  const fileChanged = (f) => !same(live.current(f), live.base(f));

  /** Show the stored value in an input, except while the user is typing in it. */
  const show = (value) => (el) => {
    const text = String(value ?? '');
    if (document.activeElement !== el && el.value !== text) el.value = text;
  };

  function select(i) {
    ui.explorer.index = i;
    confirming = false;
    slugBad = false;
  }

  async function add() {
    const now = live.store.current[file];
    select(now.length);
    live.store.set(file, '', [...now, newItem(now)], { source: 'panel' });
    await tick();
    dialog.querySelector('.tf__input:not([disabled])')?.focus();
  }

  function remove() {
    const now = live.store.current[file];
    const at = index;
    select(Math.max(0, Math.min(at, now.length - 2)));
    const rest = now.filter((_, i) => i !== at);
    live.store.set(file, '', rest, { source: 'panel' });
  }

  async function askDelete() {
    confirming = true;
    await tick();
    dialog.querySelector('.confirm button')?.focus();
  }

  function onSlug(e) {
    const slug = slugify(e.currentTarget.value);
    const at = index;
    slugBad = !slug || live.store.current[file].some((it, k) => k !== at && it?.slug === slug);
    if (!slugBad)
      live.store.set(file, `/${at}/slug`, slug, { key: `slug:${file}#${at}`, source: 'panel' });
  }

  /** Enter a file ('' = back to the list of files), keeping the keyboard focus in the modal. */
  async function goTo(next) {
    const from = file;
    ui.explorer.file = next;
    select(0);
    await tick();
    const back = from && dialog.querySelector(`[data-file="${CSS.escape(from)}"]`);
    (back || dialog.querySelector('.xrow'))?.focus();
  }

  /**
   * Open on the list of files, or straight into a file at item nextIndex, optionally
   * focusing one field.
   */
  export function open(nextFile = '', nextIndex = 0, edit = null) {
    ui.explorer.file = files.includes(nextFile) ? nextFile : '';
    select(nextIndex);
    flushSync(); // render now, so the field below exists
    if (!dialog.open) dialog.showModal();
    ui.explorer.open = true;
    const field = edit && dialog.querySelector(`[data-edit="${CSS.escape(edit)}"]`);
    if (!field) return void (file || dialog.querySelector('.xrow').focus());
    field.querySelector('.tf__input').focus({ preventScroll: true });
    field.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Open again after a refresh (persist.js), once the files are loaded.
  $effect(() => {
    const { file, index } = ui.explorer;
    // (after a tick: open() renders at once, which an effect may not do)
    if (ui.explorer.open && files.length && !dialog.open) tick().then(() => open(file, index));
  });
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="modal__box src-modal"
  aria-label="Sources"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
  onclose={() => (ui.explorer.open = false)}
>
  <ExplorerHead
    title="Sources"
    path="content/{file || 'sources/'}"
    icon={file ? 'fa-file-lines' : 'fa-folder-open'}
    back={file ? 'Back to files' : ''}
    onback={() => goTo('')}
    onclose={() => dialog.close()}
  />

  {#if !file}
    <ul class="list src-files" aria-label="Source files">
      {#each files as f (f)}
        {@const items = live.current(f)}
        <li>
          <ExplorerRow
            icon="fa-file-lines"
            name={baseName(f)}
            meta={Array.isArray(items) ? `${items.length} items` : 'not a list'}
            changed={fileChanged(f)}
            data-file={f}
            onclick={() => goTo(f)}
          />
        </li>
      {/each}
    </ul>
  {:else}
    <nav class="src-list" aria-label="Items">
      {#if isList}
        <header class="row src-list__head">
          {list.length} item{list.length === 1 ? '' : 's'}
          <button type="button" class="btn-sm" onclick={add}>
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Add
          </button>
        </header>
        <ul class="list src-list__items">
          {#each list as it, i (i)}
            <li>
              <ExplorerRow
                lead={pad(i)}
                name={itemName(it)}
                meta={itemMeta(it)}
                selected={i === index}
                changed={isChanged(it)}
                aria-current={i === index}
                onclick={() => select(i)}
              />
            </li>
          {/each}
        </ul>
        {#if list.length !== base.length}
          <p class="hint small src-list__note">
            Added and deleted items show in the preview after Save.
          </p>
        {/if}
      {/if}
    </nav>

    <section class="src-detail">
      {#if !isList}
        <p class="hint">{baseName(file)} is not a list.</p>
      {:else if !item}
        <p class="hint">No items yet. Add one on the left.</p>
      {:else}
        <header class="src-detail__head">
          <h4 class="src-item__title">{itemName(item)}</h4>
          {#if confirming}
            <span class="confirm">
              Delete {itemName(item)}?
              <button type="button" class="btn-sm" onclick={() => (confirming = false)}>
                Cancel
              </button>
              <button type="button" class="btn-sm btn-sm--danger" onclick={remove}>
                <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
              </button>
            </span>
          {:else}
            <button type="button" class="btn-sm btn-sm--danger" onclick={askDelete}>
              <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
            </button>
          {/if}
        </header>

        {#if 'slug' in item}
          <!-- the slug is the page URL: editable until the item is saved -->
          <label class="tf">
            <span class="tf__label">
              slug
              <span class="src-detail__hint">
                {saved ? 'fixed: it is the page URL' : 'page URL, fixed after Save'}
              </span>
            </span>
            <input
              class={['tf__input', slugBad && 'is-invalid']}
              spellcheck="false"
              disabled={saved}
              {@attach show(item.slug)}
              oninput={onSlug}
              onblur={(e) => {
                e.currentTarget.value = item.slug;
                slugBad = false;
              }}
            />
          </label>
        {/if}

        {#each fields as f (f.edit)}
          <Field
            edit={f.edit}
            label={f.label}
            type={f.type}
            value={valueAt(item, f.path)}
            changed={fieldChanged(f)}
            selected={ui.selection?.edit === f.edit}
            onfocus={() => bridge.focusEdit(f.edit)}
            onvalue={(value) =>
              live.store.set(file, f.ptr, value, { key: `text:${f.edit}`, source: 'panel' })}
          />
        {/each}
      {/if}
    </section>
  {/if}
</dialog>

<style lang="scss">
  // the Sources modal is a <dialog>: header on top, item list left, item fields right
  dialog.src-modal {
    width: min(1100px, 92vw);
    height: calc(100vh - 64px);
    max-height: 900px;
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }
  }

  // the list of files, across the whole modal
  .src-files {
    grid-column: 1 / -1;
    align-content: start;
    gap: 4px;
    overflow: auto;
    padding: 16px 12px 20px;
  }

  // left: the file's items
  .src-list {
    overflow: auto;
    padding: 16px 12px 20px;
    border-right: 1px solid var(--line);
  }

  .src-list__head {
    justify-content: space-between;
    padding: 0 8px 12px;
    color: var(--muted);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .src-list__items {
    gap: 4px;
  }

  .src-list__note {
    margin: 12px 8px 0;
  }

  // right: the selected item
  .src-detail {
    overflow: auto;
    padding: 16px 24px 24px;
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .src-detail__head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 32px;
    margin-bottom: 4px;

    .src-item__title {
      flex: 1;
      min-width: 0;
    }
  }

  .src-detail__hint {
    margin-left: auto;
    color: var(--muted);
    font-size: 10px;
  }

  .src-detail :global(.tf__input:disabled) {
    color: var(--muted);
    cursor: not-allowed;
  }

  .src-item__title {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg);
  }
</style>
