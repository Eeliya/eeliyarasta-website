<!--
  Sources modal (Svelte trial). Same markup classes and behavior as the hand-built modal in
  src/editor/ui/panel-text.js: item list on the left, the selected item's fields on the right,
  add, delete with confirm, slug editable until saved. Mounted by panel-text.js.
-->
<script>
  import { tick, flushSync, onDestroy, untrack } from 'svelte';
  import { baseName } from '../../site/files.js';
  import { storeAdapter } from './store-adapter.svelte.js';
  import {
    itemName,
    itemMeta,
    pad,
    slugify,
    itemFields,
    parseValue,
    newItem,
  } from './source-items.js';

  // store/bridge: the editor's own; the callbacks hand control back to panel-text.js.
  let { store, bridge, onclose, onlistchange, onswitch } = $props();

  const data = storeAdapter(untrack(() => store));
  onDestroy(() => data.destroy());

  // What is shown is set by open(): panel-text calls it right after mount.
  let file = $state(null);
  let selected = $state(0);
  let confirming = $state(false);
  let highlight = $state(null);
  let slugBad = $state(false);
  let root = $state();
  let detail = $state();

  const list = $derived(data.current(file));
  const base = $derived(data.base(file) || []);
  const isList = $derived(Array.isArray(list));
  const index = $derived(isList ? Math.max(0, Math.min(selected, list.length - 1)) : 0);
  const item = $derived(isList ? list[index] : undefined);
  const fields = $derived(item ? itemFields(file, item, index) : []);
  const saved = $derived(!!item && base.some((b) => b?.slug === item.slug));
  const baseBySlug = $derived(new Map(base.map((b) => [b?.slug, b])));

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isDirty = (it) => !same(it, baseBySlug.get(it?.slug));
  const changed = (f) => !same(item?.[f.key], base[index]?.[f.key]);

  // Esc (src/editor/main.js) closes any open .modal through el.close().
  $effect(() => {
    root.close = onclose;
  });

  /** Keep an input showing the stored value, except while the user is typing in it. */
  const sync = (value) => (el) => {
    const v = String(value ?? '');
    if (document.activeElement !== el && el.value !== v) el.value = v;
  };

  function select(i) {
    selected = i;
    confirming = false;
    slugBad = false;
  }

  async function add() {
    const now = store.current[file];
    if (!Array.isArray(now)) return;
    select(now.length);
    store.set(file, '', [...now, newItem(now)], { source: 'panel' });
    onlistchange?.();
    await tick();
    detail?.querySelector('.tf__input:not([disabled])')?.focus();
  }

  function remove() {
    const now = store.current[file];
    const at = index;
    if (!Array.isArray(now) || !now[at]) return;
    select(Math.max(0, Math.min(at, now.length - 2)));
    store.set(
      file,
      '',
      now.filter((_, i) => i !== at),
      { source: 'panel' },
    );
    onlistchange?.();
  }

  async function askDelete() {
    confirming = true;
    await tick();
    detail?.querySelector('.src-detail__confirm .src-edit')?.focus();
  }

  function onField(f, e) {
    const v = parseValue(f.type, e.currentTarget.value);
    e.currentTarget.classList.toggle('is-invalid', v === undefined);
    if (v !== undefined) store.set(file, f.ptr, v, { key: `text:${f.edit}`, source: 'panel' });
  }

  function onSlug(e) {
    const v = slugify(e.currentTarget.value);
    const at = index;
    slugBad = !v || store.current[file].some((it, k) => k !== at && it?.slug === v);
    if (!slugBad) store.set(file, `/${at}/slug`, v, { key: `slug:${file}#${at}`, source: 'panel' });
  }

  function onSlugBlur(e) {
    e.currentTarget.value = item?.slug ?? '';
    slugBad = false;
  }

  /** Show `nextFile`, optionally at an item, optionally with one field focused + highlighted. */
  export function open(nextFile, nextIndex, edit) {
    if (nextFile !== file) {
      file = nextFile;
      select(0);
    }
    if (nextIndex !== undefined && nextIndex !== index) select(nextIndex);
    highlight = edit ?? null;
    if (!edit) return;
    flushSync();
    const row = root.querySelector(`.tf[data-edit="${CSS.escape(edit)}"]`);
    row?.querySelector('.tf__input')?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** The panel's field selection (preview click elsewhere clears it). */
  export function setSelected(edit) {
    highlight = edit ?? null;
  }

  export function where() {
    return { file, index };
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal src-modal"
  role="presentation"
  bind:this={root}
  onclick={(e) => e.target === root && onclose()}
>
  {#if file}
    <div
      class="modal__box src-modal__box"
      role="dialog"
      aria-modal="true"
      aria-label={baseName(file)}
    >
      <header class="src-modal__head">
        <h3 class="modal__title">{baseName(file)}</h3>
        <span class="src-modal__path">content/{file}</span>
        <button
          type="button"
          class="src-engine is-on"
          aria-pressed="true"
          title="Svelte version. Click for the hand-built one."
          onclick={onswitch}>Svelte</button
        >
        <button
          type="button"
          class="src-modal__x"
          title="Close (Esc)"
          aria-label="Close"
          onclick={() => onclose()}
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="src-modal__panes">
        <div class="src-list">
          {#if isList}
            <div class="src-list__head">
              <span>{list.length} item{list.length === 1 ? '' : 's'}</span>
              <button type="button" class="src-edit" onclick={add}>
                <i class="fa-solid fa-plus" aria-hidden="true"></i> Add
              </button>
            </div>
            <ul class="src-list__items">
              {#each list as it, i (i)}
                <li>
                  <button
                    type="button"
                    class={[
                      'src-list__item',
                      i === index && 'is-selected',
                      isDirty(it) && 'is-changed',
                    ]}
                    aria-current={i === index ? 'true' : undefined}
                    onclick={() => select(i)}
                  >
                    <span class="src-list__num">{pad(i)}</span>
                    <span class="src-list__text">
                      <span class="src-list__name">{itemName(it)}</span>
                      <span class="src-list__meta">{itemMeta(it)}</span>
                    </span>
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
        </div>

        <div class="src-detail" bind:this={detail}>
          {#if !isList}
            <p class="hint">{baseName(file)} is not a list.</p>
          {:else if !item}
            <p class="hint">No items yet. Add one on the left.</p>
          {:else}
            <div class="src-detail__head">
              <h4 class="src-item__title">{itemName(item)}</h4>
              {#if confirming}
                <span class="src-detail__confirm">
                  Delete {itemName(item)}?
                  <button type="button" class="src-edit" onclick={() => (confirming = false)}
                    >Cancel</button
                  >
                  <button type="button" class="src-edit src-edit--danger" onclick={remove}>
                    <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
                  </button>
                </span>
              {:else}
                <button
                  type="button"
                  class="src-edit src-edit--danger"
                  title="Delete {itemName(item)}"
                  onclick={askDelete}
                >
                  <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
                </button>
              {/if}
            </div>

            <div class="src-detail__fields">
              {#if 'slug' in item}
                <div class="tf">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="tf__label">
                    slug
                    <span class="src-detail__hint">
                      {saved ? 'fixed: it is the page URL' : 'page URL, fixed after Save'}
                    </span>
                  </label>
                  <input
                    class={['tf__input', slugBad && 'is-invalid']}
                    type="text"
                    spellcheck="false"
                    disabled={saved}
                    {@attach sync(item.slug)}
                    oninput={onSlug}
                    onblur={onSlugBlur}
                  />
                </div>
              {/if}
              {#each fields as f (f.edit)}
                <div
                  class={['tf', changed(f) && 'is-changed', highlight === f.edit && 'is-selected']}
                  data-edit={f.edit}
                >
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="tf__label">{f.key}<i class="dot" title="Changed"></i></label>
                  {#if f.type === 'block'}
                    <textarea
                      class="tf__input"
                      spellcheck="true"
                      rows={Math.min(
                        8,
                        Math.max(2, Math.ceil(String(item[f.key] ?? '').length / 42)),
                      )}
                      {@attach sync(item[f.key])}
                      onfocus={() => bridge.focusEdit?.(f.edit)}
                      oninput={(e) => onField(f, e)}></textarea>
                  {:else}
                    <input
                      class="tf__input"
                      type={f.type === 'number' ? 'number' : 'text'}
                      spellcheck={f.type !== 'number'}
                      {@attach sync(item[f.key])}
                      onfocus={() => bridge.focusEdit?.(f.edit)}
                      oninput={(e) => onField(f, e)}
                    />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
