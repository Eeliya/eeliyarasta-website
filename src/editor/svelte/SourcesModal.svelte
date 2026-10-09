<!--
  Sources modal: edit one list from content/sources/ (people, places, projects, ...).
  The items on the left, the selected item's fields on the right. ContentPanel.svelte calls
  open() to show a file, an item or one field (after a click in the preview).
-->
<script>
  import { tick, flushSync } from 'svelte';
  import Field from './Field.svelte';
  import { ui } from './ui.svelte.js';
  import { baseName } from '../../site/files.js';
  import { itemName, itemMeta, pad, slugify, itemFields, newItem } from './source-items.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  let dialog = $state();
  let file = $state('');
  let selected = $state(0);
  let confirming = $state(false); // "Delete X?" is showing
  let slugBad = $state(false);

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
    dialog.querySelector('.src-detail__confirm button')?.focus();
  }

  function onSlug(e) {
    const slug = slugify(e.currentTarget.value);
    const at = index;
    slugBad = !slug || live.store.current[file].some((it, k) => k !== at && it?.slug === slug);
    if (!slugBad)
      live.store.set(file, `/${at}/slug`, slug, { key: `slug:${file}#${at}`, source: 'panel' });
  }

  /** Show a file, at its first item or at item nextIndex, optionally focusing one field. */
  export function open(nextFile, nextIndex = 0, edit = null) {
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
  aria-label={baseName(file)}
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <header class="src-modal__head">
    <h3 class="modal__title">{baseName(file)}</h3>
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
    {#if isList}
      <header class="src-list__head">
        {list.length} item{list.length === 1 ? '' : 's'}
        <button type="button" class="src-edit" onclick={add}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Add
        </button>
      </header>
      <ul class="src-list__items">
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
          <span class="src-detail__confirm">
            Delete {itemName(item)}?
            <button type="button" class="src-edit" onclick={() => (confirming = false)}>
              Cancel
            </button>
            <button type="button" class="src-edit src-edit--danger" onclick={remove}>
              <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
            </button>
          </span>
        {:else}
          <button type="button" class="src-edit src-edit--danger" onclick={askDelete}>
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
