<!--
  Source Explorer: the lists in content/sources/ (people, places, projects, ...). On the left
  the files as tabs (with their item counts) above the file's items, on the right the
  selected item's fields. ContentPanel.svelte calls open() from its Sources button, a grid's
  Source edit button or a click on a list item in the preview: a file, an item or one field.
-->
<script>
  import { tick, flushSync } from 'svelte';
  import Field from './Field.svelte';
  import { ui } from './ui.svelte.js';
  import { isSource } from './content-groups.js';
  import { baseName, sourceIdOf } from '../../site/files.js';
  import { itemName, itemMeta, pad, slugify, itemFields, newItem } from './source-items.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  let dialog = $state();
  let file = $state('');
  let selected = $state(0);
  let confirming = $state(false); // "Delete X?" is showing
  let slugBad = $state(false);

  const files = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).filter(isSource).sort();
  });
  const list = $derived(live.current(file));
  const base = $derived(live.base(file) || []);
  const isList = $derived(Array.isArray(list));
  const index = $derived(isList ? Math.max(0, Math.min(selected, list.length - 1)) : 0);
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
  const fieldChanged = (f) => !same(item?.[f.key], base[index]?.[f.key]);

  /** Show the stored value in an input, except while the user is typing in it. */
  const show = (value) => (el) => {
    const text = String(value ?? '');
    if (document.activeElement !== el && el.value !== text) el.value = text;
  };

  function select(i) {
    selected = i;
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

  /** Show the items of another file. */
  function pickFile(next) {
    if (next === file) return;
    file = next;
    select(0);
  }

  /**
   * Show a file (default: the last one shown, else the first), at its first item or at item
   * nextIndex, optionally focusing one field.
   */
  export function open(nextFile = file || files[0], nextIndex = 0, edit = null) {
    file = nextFile;
    select(nextIndex);
    flushSync(); // render now, so the field below exists
    if (!dialog.open) dialog.showModal();
    const field = edit && dialog.querySelector(`[data-edit="${CSS.escape(edit)}"]`);
    if (!field) return;
    field.querySelector('.tf__input').focus({ preventScroll: true });
    field.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="modal__box src-modal"
  aria-label="Sources"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <header class="src-modal__head">
    <h3 class="modal__title">Sources</h3>
    <span class="src-modal__path">content/{file}</span>
    <button
      type="button"
      class="src-modal__x"
      title="Close (Esc)"
      aria-label="Close"
      onclick={() => dialog.close()}
    >
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  </header>

  <nav class="src-list" aria-label="Items">
    <div class="seg seg--small src-files" role="tablist" aria-label="Source files">
      {#each files as f (f)}
        {@const items = live.current(f)}
        <button
          type="button"
          role="tab"
          class={['seg__btn', f === file && 'is-active']}
          aria-selected={f === file}
          title="content/{f}"
          onclick={() => pickFile(f)}
        >
          {sourceIdOf(f)}
          {Array.isArray(items) ? items.length : '!'}
        </button>
      {/each}
    </div>
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
            <button
              type="button"
              class={[
                'src-list__item',
                i === index && 'is-selected',
                isChanged(it) && 'is-changed',
              ]}
              aria-current={i === index}
              onclick={() => select(i)}
            >
              <span class="src-list__num">{pad(i)}</span>
              <span class="src-list__name">{itemName(it)}</span>
              <span class="src-list__meta">{itemMeta(it)}</span>
              <i class="dot" title="Changed"></i>
            </button>
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
          label={f.key}
          type={f.type}
          value={item[f.key]}
          changed={fieldChanged(f)}
          selected={ui.selection?.edit === f.edit}
          onfocus={() => bridge.focusEdit(f.edit)}
          onvalue={(value) =>
            live.store.set(file, f.ptr, value, { key: `text:${f.edit}`, source: 'panel' })}
        />
      {/each}
    {/if}
  </section>
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

  .src-modal__head {
    grid-column: 1 / -1;
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 20px 22px 14px;
    border-bottom: 1px solid var(--line);

    .modal__title {
      margin: 0;
    }
  }

  .src-modal__path {
    color: var(--muted);
    font-size: 10.5px;
  }

  .src-modal__x {
    margin-left: auto;
    align-self: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 14px;
    cursor: pointer;

    &:hover {
      color: var(--fg);
      background: rgb(255 255 255 / 0.06);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--hi);
    }
  }

  // left: the file tabs, then the list
  .src-list {
    overflow: auto;
    padding: 14px 12px 18px;
    border-right: 1px solid var(--line);
  }

  // list name (people.json -> people) + item count, in normal case so they fit
  .src-files {
    flex-wrap: wrap;
    margin-bottom: 14px;

    .seg__btn {
      padding-inline: 6px;
      font-size: 10.5px;
      letter-spacing: 0;
      text-transform: none;
    }
  }

  .src-list__head {
    justify-content: space-between;
    padding: 0 6px 10px;
    color: var(--muted);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .src-list__items {
    gap: 2px;
  }

  // number | name / meta | changed dot
  .src-list__item {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 2px 10px;
    padding: 8px 10px;
    border: 0;
    border-radius: 10px;
    background: none;
    text-align: left;
    cursor: pointer;
    color: var(--fg);

    .dot {
      display: none;
      grid-column: 3;
      grid-row: 1 / 3;
      margin: 0;
    }

    &.is-changed .dot {
      display: inline-block;
    }

    &:hover {
      background: rgb(255 255 255 / 0.05);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--hi);
    }

    &.is-selected {
      background: rgb(159 211 255 / 0.2);
    }
  }

  .src-list__num {
    grid-row: 1 / 3;
    color: var(--muted);
    font-size: 10px;
  }

  .src-list__name,
  .src-list__meta {
    grid-column: 2;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .src-list__meta {
    color: var(--muted);
    font-size: 10.5px;
  }

  .src-list__note {
    margin: 12px 6px 0;
  }

  // right: the selected item
  .src-detail {
    overflow: auto;
    padding: 16px 22px 22px;
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .src-detail__head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 30px;
    margin-bottom: 2px;

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
