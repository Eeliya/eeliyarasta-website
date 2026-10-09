<!--
  Pages window: the page files in content/pages/, whose folders are the site's URLs
  (src/site/routes.js). Folder-style like the Source Explorer: a folder's sub-folders, pages
  and [slug] page on the left, the selected one on the right. Add a page, turn on children
  (its folder), add a [slug] page (one page per item of a source), rename, delete. Changes
  go straight to disk through the dev server (actions.pagesOp in main.js); the page menu
  and the preview follow. Where it is lives in ui.pagesWin (persist.js).
-->
<script>
  import { tick, flushSync } from 'svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import { ui } from './ui.svelte.js';
  import * as source from '../source.js';
  import { TEMPLATE, isSlug, pageIdOf, sourceIdOf } from '../../site/files.js';
  import { pathOfId } from '../../site/routes.js';
  import { slugify } from '../../site/helpers.js';
  import { plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); actions: pagesOp, pickTarget (main.js)
  let { live, actions } = $props();

  const PROTECTED = ['home', '404'];
  let dialog = $state();
  let diskFolders = $state([]); // from the dev server: empty folders too
  let sel = $state(''); // a page id, or 'add' / 'add-template'
  let confirming = $state(false);
  let busy = $state(false);
  let newTitle = $state('');
  let newName = $state('');
  let newSource = $state('');

  const folder = $derived(ui.pagesWin.folder);
  const join = (f, n) => (f ? `${f}/${n}` : n);
  const parentOf = (id) => id.slice(0, Math.max(0, id.lastIndexOf('/')));
  const nameOf = (id) => id.slice(id.lastIndexOf('/') + 1);
  const fileOf = (id) => `pages/${id}.json`;

  const ids = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(pageIdOf).filter(Boolean).sort();
  });
  const sources = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(sourceIdOf).filter(Boolean).sort();
  });
  const folders = $derived([...new Set([...diskFolders, ...ids.map(parentOf).filter(Boolean)])]);
  const subFolders = $derived(folders.filter((f) => parentOf(f) === folder && f !== folder));
  // home first and 404 last, like the site's routes
  const rank = (id) => (id === 'home' ? 0 : id === '404' ? 2 : 1);
  const pages = $derived(
    ids
      .filter((id) => parentOf(id) === folder && nameOf(id) !== TEMPLATE)
      .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1)),
  );
  const template = $derived(ids.find((id) => id === join(folder, TEMPLATE)));
  const below = (id) => ids.filter((p) => p.startsWith(`${id}/`));
  const data = (id) => live.current(fileOf(id)) || {};
  const titleOf = (id) => {
    const d = data(id);
    if (id === 'home') return 'Home';
    return (
      d.meta?.title ||
      d.title ||
      nameOf(id)
        .replace(/-/g, ' ')
        .replace(/^./, (c) => c.toUpperCase())
    );
  };
  const changed = (id) =>
    JSON.stringify(live.current(fileOf(id))) !== JSON.stringify(live.base(fileOf(id)));
  const urlOf = (id) => (id.endsWith(TEMPLATE) ? `/${id}` : pathOfId(id));

  // the add form: a name from the title, unless typed
  const slug = $derived(newName || slugify(newTitle));
  const slugError = $derived(
    !slug
      ? ''
      : !isSlug(slug)
        ? 'Use a-z, 0-9 and dashes'
        : ids.includes(join(folder, slug)) || folders.includes(join(folder, slug))
          ? `${urlOf(join(folder, slug))} already exists`
          : '',
  );

  // rename: the selected page's new name
  let renameTo = $state('');
  const renameError = $derived(
    !renameTo || renameTo === nameOf(sel)
      ? ''
      : !isSlug(renameTo)
        ? 'Use a-z, 0-9 and dashes'
        : ids.includes(join(parentOf(sel), renameTo))
          ? `${pathOfId(join(parentOf(sel), renameTo))} already exists`
          : '',
  );

  async function loadFolders() {
    try {
      diskFolders = await source.pageFolders();
    } catch {
      diskFolders = [];
    }
  }

  function select(id) {
    sel = id;
    confirming = false;
    renameTo = id && !['add', 'add-template'].includes(id) ? nameOf(id) : '';
    newTitle = newName = '';
    newSource = sources[0] || '';
  }

  /** Enter a folder ('' = content/pages/), keeping the keyboard focus in the window. */
  async function goTo(next) {
    const from = folder;
    ui.pagesWin.folder = next;
    select('');
    await tick();
    const back = from && dialog.querySelector(`[data-folder="${CSS.escape(from)}"]`);
    (back || dialog.querySelector('.xrow'))?.focus();
  }

  async function run(body, after) {
    busy = true;
    const res = await actions.pagesOp(body);
    busy = false;
    await loadFolders();
    if (res) after?.(res);
    return res;
  }

  const add = () =>
    run({ op: 'add', folder, name: slug, title: newTitle.trim() }, (r) => select(r.id));
  const addTemplate = () => run({ op: 'template', folder, source: newSource }, (r) => select(r.id));
  const children = (id) => run({ op: 'children', id }, () => goTo(id));
  const rename = () => run({ op: 'rename', id: sel, name: renameTo }, (r) => select(r.id));
  const remove = () => run({ op: 'delete', id: sel }, () => select(''));

  async function startAdd(kind) {
    select(kind);
    await tick();
    dialog.querySelector('.pg-detail input, .pg-detail select')?.focus();
  }

  async function askDelete() {
    confirming = true;
    await tick();
    dialog.querySelector('.confirm button')?.focus();
  }

  /** Open the window (on its last folder). */
  export function open(next = ui.pagesWin.folder) {
    ui.pagesWin.folder = next === '' || folders.includes(next) ? next : '';
    select('');
    loadFolders();
    flushSync();
    if (!dialog.open) dialog.showModal();
    ui.pagesWin.open = true;
    dialog.querySelector('.xrow')?.focus();
  }

  // Open again after a refresh (persist.js), once the content is loaded.
  $effect(() => {
    if (ui.pagesWin.open && ids.length && !dialog.open) tick().then(() => open());
  });
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="modal__box pg-modal"
  aria-label="Pages"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
  onclose={() => (ui.pagesWin.open = false)}
>
  <ExplorerHead
    title="Pages"
    path="content/pages/{folder ? `${folder}/` : ''}"
    back={folder ? 'Up one folder' : ''}
    onback={() => goTo(parentOf(folder))}
    onclose={() => dialog.close()}
  />

  <nav class="pg-list" aria-label="Pages in this folder">
    <header class="row pg-list__head">
      {plural(pages.length + (template ? 1 : 0), 'page')}
      <span>
        <button type="button" class="btn-sm" disabled={busy} onclick={() => startAdd('add')}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Page
        </button>
        {#if folder && !template}
          <button
            type="button"
            class="btn-sm"
            disabled={busy}
            onclick={() => startAdd('add-template')}
          >
            <i class="fa-solid fa-plus" aria-hidden="true"></i> [slug]
          </button>
        {/if}
      </span>
    </header>
    <ul class="list pg-list__items">
      {#each subFolders as f (f)}
        <li>
          <ExplorerRow
            icon="fa-folder"
            name="{nameOf(f)}/"
            meta={plural(below(f).length, 'page')}
            data-folder={f}
            onclick={() => goTo(f)}
          />
        </li>
      {/each}
      {#each pages as id (id)}
        <li>
          <ExplorerRow
            icon="fa-file-lines"
            name={titleOf(id)}
            meta={urlOf(id)}
            selected={sel === id}
            changed={changed(id)}
            aria-current={sel === id}
            onclick={() => select(id)}
          />
        </li>
      {/each}
      {#if template}
        <li>
          <ExplorerRow
            icon="fa-layer-group"
            name="[slug]"
            meta="a page per item of {data(template).config?.source || '?'}"
            selected={sel === template}
            changed={changed(template)}
            aria-current={sel === template}
            onclick={() => select(template)}
          />
        </li>
      {/if}
    </ul>
  </nav>

  <section class="pg-detail">
    {#if sel === 'add'}
      <h4 class="pg-detail__title">New page in /{folder ? `${folder}/` : ''}</h4>
      <label class="tf">
        <span class="tf__label">Title</span>
        <input class="tf__input" bind:value={newTitle} placeholder="My page" />
      </label>
      <label class="tf">
        <span class="tf__label">Name in the URL</span>
        <input
          class={['tf__input', slugError && 'is-invalid']}
          spellcheck="false"
          bind:value={newName}
          placeholder={slugify(newTitle) || 'my-page'}
        />
      </label>
      <p class="hint small">{slugError || (slug ? `${pathOfId(join(folder, slug))}` : '')}</p>
      <div class="row">
        <button type="button" class="btn-sm" onclick={() => select('')}>Cancel</button>
        <button type="button" class="btn-sm" disabled={!slug || !!slugError || busy} onclick={add}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Add page
        </button>
      </div>
    {:else if sel === 'add-template'}
      <h4 class="pg-detail__title">New [slug] page in /{folder}/</h4>
      <p class="hint small">
        One page per item of a source, at /{folder}/&lt;slug&gt;/, with the album look. A page with
        the same name in this folder wins over it.
      </p>
      <label class="tf">
        <span class="tf__label">Source</span>
        <select class="tf__input f__select" bind:value={newSource}>
          {#each sources as s (s)}<option value={s}>sources/{s}.json</option>{/each}
        </select>
      </label>
      <div class="row">
        <button type="button" class="btn-sm" onclick={() => select('')}>Cancel</button>
        <button type="button" class="btn-sm" disabled={!newSource || busy} onclick={addTemplate}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Add [slug] page
        </button>
      </div>
    {:else if sel && ids.includes(sel)}
      {@const isTemplate = nameOf(sel) === TEMPLATE}
      {@const fixed = PROTECTED.includes(sel)}
      {@const inside = below(sel)}
      <header class="pg-detail__head">
        <h4 class="pg-detail__title">{isTemplate ? '[slug]' : titleOf(sel)}</h4>
        {#if confirming}
          <span class="confirm">
            Delete {urlOf(sel)}{inside.length ? ` and ${plural(inside.length, 'page')} in it` : ''}?
            <button type="button" class="btn-sm" onclick={() => (confirming = false)}>Cancel</button
            >
            <button type="button" class="btn-sm btn-sm--danger" disabled={busy} onclick={remove}>
              <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
            </button>
          </span>
        {:else if !fixed}
          <button type="button" class="btn-sm btn-sm--danger" onclick={askDelete}>
            <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
          </button>
        {/if}
      </header>
      <p class="hint small">content/{fileOf(sel)}</p>
      <div class="row">
        <button
          type="button"
          class="btn-sm"
          onclick={() =>
            actions.pickTarget(
              ui.pages.find((p) => (isTemplate ? p.template === sel : p.path === urlOf(sel))) || {
                kind: 'page',
                path: urlOf(sel),
                title: '',
              },
            )}
        >
          <i class="fa-solid fa-eye" aria-hidden="true"></i> Show {urlOf(sel)}
        </button>
      </div>

      {#if isTemplate}
        <p class="hint small">
          A page per item of sources/{data(sel).config?.source}.json, at /{parentOf(
            sel,
          )}/&lt;slug&gt;/ (the item's slug, else its name). Its labels are in the Content tab.
        </p>
      {:else if fixed}
        <p class="hint small">
          The {sel === 'home' ? 'home' : '404'} page can't be renamed or deleted.
        </p>
      {:else}
        <label class="tf">
          <span class="tf__label">Name in the URL</span>
          <input
            class={['tf__input', renameError && 'is-invalid']}
            spellcheck="false"
            bind:value={renameTo}
          />
        </label>
        <p class="hint small">{renameError}</p>
        <div class="row">
          <button
            type="button"
            class="btn-sm"
            disabled={!renameTo || renameTo === nameOf(sel) || !!renameError || busy}
            onclick={rename}
          >
            <i class="fa-solid fa-pen" aria-hidden="true"></i> Rename
          </button>
          {#if folders.includes(sel)}
            <button type="button" class="btn-sm" onclick={() => goTo(sel)}>
              <i class="fa-solid fa-folder-open" aria-hidden="true"></i> Open {nameOf(sel)}/
            </button>
          {:else}
            <button type="button" class="btn-sm" disabled={busy} onclick={() => children(sel)}>
              <i class="fa-solid fa-folder-plus" aria-hidden="true"></i> Turn on children
            </button>
          {/if}
        </div>
      {/if}
    {:else}
      <p class="hint">
        Folders here are the site's URLs: {folder ? `${folder}.json` : 'people.json'} is /{folder ||
          'people'}/, the pages in {folder || 'people'}/ are below it. Pick a page, or add one.
      </p>
    {/if}
  </section>
</dialog>

<style lang="scss">
  // like the Sources modal: header on top, the folder left, the selected page right
  dialog.pg-modal {
    width: min(880px, 92vw);
    height: min(640px, calc(100vh - 64px));
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }
  }

  .pg-list {
    overflow: auto;
    padding: 16px 12px 20px;
    border-right: 1px solid var(--line);
  }

  .pg-list__head {
    justify-content: space-between;
    padding: 0 8px 12px;
    color: var(--muted);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pg-list__items {
    gap: 4px;
  }

  .pg-detail {
    overflow: auto;
    padding: 16px 24px 24px;
    display: grid;
    align-content: start;
    gap: 12px;

    .hint {
      margin: 0;
    }
  }

  .pg-detail__head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 32px;
  }

  .pg-detail__title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg);
  }
</style>
