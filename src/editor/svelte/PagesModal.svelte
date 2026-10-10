<!--
  Pages window: the pages in content/pages/. Every page is a folder, its URL, with its own
  file index.json inside (src/site/routes.js); the root is home's folder. Like the Source
  Explorer: the breadcrumb under the title is the URL of the folder shown; the list has its
  own page first (the row "/"), then the pages in it (click to enter), then its [slug] page;
  the selected row on the right.
  Add a page or a [slug] page (one page per item of a source) in any folder, rename or delete
  a page with its whole folder. Changes go straight to disk through the dev server
  (actions.pagesOp in main.js); the page menu and the preview follow. Where it is lives in
  ui.pagesWin (persist.js).
-->
<script>
  import Button from './Button.svelte';
  import { tick, flushSync } from 'svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { TEMPLATE, isSlug, pageFile, pageIdOf, sourceIdOf } from '../../site/files.js';
  import { pageTitle, pathOfId } from '../../site/routes.js';
  import { slugify } from '../../site/helpers.js';
  import { plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); actions: pagesOp, pickTarget (main.js)
  let { live, actions } = $props();

  const PROTECTED = ['home', '404'];
  let dialog = $state();
  let sel = $state(''); // a page id, or 'add' / 'add-template'
  let confirming = $state(false);
  let busy = $state(false);
  let newTitle = $state('');
  let newName = $state('');
  let newSource = $state('');
  const uid = $props.id();
  let renameTo = $state('');

  // the folder shown: a page id, '' = the root (home's folder)
  const folder = $derived(ui.pagesWin.folder);
  const own = $derived(folder || 'home');
  const join = (f, n) => (f ? `${f}/${n}` : n);
  const parentOf = (id) => id.slice(0, Math.max(0, id.lastIndexOf('/')));
  const nameOf = (id) => id.slice(id.lastIndexOf('/') + 1);
  const isTemplate = (id) => nameOf(id) === TEMPLATE;

  const ids = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(pageIdOf).filter(Boolean);
  });
  const sources = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(sourceIdOf).filter(Boolean).sort();
  });
  // the pages in this folder (home is the root's own page), 404 last
  const rank = (id) => (id === '404' ? 1 : 0);
  const pages = $derived(
    ids
      .filter((id) => id !== 'home' && parentOf(id) === folder && !isTemplate(id))
      .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1)),
  );
  const template = $derived(folder ? ids.find((id) => id === join(folder, TEMPLATE)) : undefined);
  /** Everything in a page's folder, e.g. ['people/[slug]', 'people/team']. */
  const below = (id) => (id === 'home' ? [] : ids.filter((p) => p.startsWith(`${id}/`)).sort());
  const data = (id) => live.current(pageFile(id)) || {};
  const titleOf = (id) => {
    if (id === 'home') return 'Home';
    if (isTemplate(id)) return '[slug]';
    const d = data(id);
    return (
      d.meta?.title ||
      pageTitle(d) ||
      nameOf(id)
        .replace(/-/g, ' ')
        .replace(/^./, (c) => c.toUpperCase())
    );
  };
  const changed = (id) =>
    JSON.stringify(live.current(pageFile(id))) !== JSON.stringify(live.base(pageFile(id)));
  const urlOf = (id) => (isTemplate(id) ? `/${id}` : pathOfId(id));
  // the breadcrumb: "/" (the root), then one crumb per folder in the URL, each going there
  const crumbs = $derived([
    { label: '/', onclick: () => goTo('') },
    ...(folder ? folder.split('/') : []).map((name, i, all) => ({
      label: `${name}/`,
      onclick: () => goTo(all.slice(0, i + 1).join('/')),
    })),
  ]);
  // a page's folder in content/
  const pathOf = (id) => `content/pages/${id === 'home' ? '' : `${id}/`}`;

  // the add form: a name from the title, unless typed
  const slug = $derived(newName || slugify(newTitle));
  const slugError = $derived(
    !slug
      ? ''
      : !isSlug(slug)
        ? 'Use a-z, 0-9 and dashes'
        : ids.includes(join(folder, slug))
          ? `${pathOfId(join(folder, slug))} already exists`
          : !folder && ['home', '404', 'edit', 'assets', 'media'].includes(slug)
            ? `"${slug}" is reserved`
            : '',
  );
  const renameError = $derived(
    !renameTo || renameTo === nameOf(sel)
      ? ''
      : !isSlug(renameTo)
        ? 'Use a-z, 0-9 and dashes'
        : ids.includes(join(parentOf(sel), renameTo))
          ? `${pathOfId(join(parentOf(sel), renameTo))} already exists`
          : '',
  );
  // [slug] pages: not at the root, not in 404, one per folder
  const templateBlock = $derived(
    !folder
      ? 'No [slug] page at the root: add it in a page folder'
      : folder === '404'
        ? 'Not in 404'
        : template
          ? 'This folder has its [slug] page'
          : '',
  );

  function select(id) {
    sel = id;
    confirming = false;
    renameTo = id && !['add', 'add-template'].includes(id) ? nameOf(id) : '';
    newTitle = newName = '';
    newSource = sources[0] || '';
  }

  /** Enter a page's folder ('' = the root), keeping the keyboard focus in the window. */
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
    if (res) after?.(res);
    return res;
  }

  const add = () =>
    run({ op: 'add', parent: folder, name: slug, title: newTitle.trim() }, () => select(''));
  const addTemplate = () =>
    run({ op: 'template', parent: folder, source: newSource }, (r) => select(r.id));
  // the open folder's own page renamed or deleted: follow it, or go up
  const rename = () =>
    run({ op: 'rename', id: sel, name: renameTo }, (r) =>
      sel === folder ? goTo(r.id).then(() => select(r.id)) : select(r.id),
    );
  const remove = () =>
    run({ op: 'delete', id: sel }, () => (sel === folder ? goTo(parentOf(folder)) : select('')));

  async function startAdd(kind) {
    select(kind);
    await tick();
    dialog.querySelector('.pg-detail input, .pg-detail [role="combobox"]')?.focus();
  }

  async function askDelete() {
    confirming = true;
    await tick();
    dialog.querySelector('.confirm button')?.focus();
  }

  function show(id) {
    const item = ui.pages.find((p) => (isTemplate(id) ? p.template === id : p.path === urlOf(id)));
    actions.pickTarget(item || { kind: 'page', path: urlOf(id), title: titleOf(id) });
  }

  /** Open the window (on its last folder). */
  export function open(next = ui.pagesWin.folder) {
    ui.pagesWin.folder = next === '' || (ids.includes(next) && !isTemplate(next)) ? next : '';
    select('');
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
<dialog
  class="modal__box pg-modal"
  aria-label="Pages"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
  onclose={() => (ui.pagesWin.open = false)}
>
  <ExplorerHead
    title="Pages"
    icon="fa-sitemap"
    {crumbs}
    back={folder ? 'Up one folder' : ''}
    onback={() => goTo(parentOf(folder))}
    onclose={() => dialog.close()}
  />

  <nav class="pg-list" aria-label="This page and the pages in its folder">
    <div class="row pg-list__head">
      <Button
        size="small"
        icon="plus"
        disabled={busy || folder === '404'}
        onclick={() => startAdd('add')}
      >
        Add page
      </Button>
      <Button
        size="small"
        icon="plus"
        disabled={busy || !!templateBlock}
        title={templateBlock}
        onclick={() => startAdd('add-template')}
      >
        Add [slug]
      </Button>
    </div>
    <ul class="list pg-list__items">
      <li>
        <ExplorerRow
          icon="fa-file-lines"
          name="/"
          meta="index.json · {titleOf(own)}"
          selected={sel === own}
          changed={changed(own)}
          aria-current={sel === own}
          onclick={() => select(own)}
        />
      </li>
      {#each pages as id (id)}
        <li>
          <ExplorerRow
            icon="fa-file-lines"
            enter
            name={titleOf(id)}
            meta="{urlOf(id)}{below(id).length
              ? ` · ${plural(below(id).length, 'page')} in it`
              : ''}"
            changed={changed(id)}
            data-folder={id}
            onclick={() => goTo(id)}
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
      <h4 class="pg-detail__title">New page in {pathOfId(own)}</h4>
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
      <p class="hint small">
        {slugError ||
          (slug ? `${pathOfId(join(folder, slug))}: ${pathOf(join(folder, slug))}index.json` : '')}
      </p>
      <div class="row">
        <Button size="small" onclick={() => select('')}>Cancel</Button>
        <Button size="small" icon="plus" disabled={!slug || !!slugError || busy} onclick={add}>
          Add page
        </Button>
      </div>
    {:else if sel === 'add-template'}
      <h4 class="pg-detail__title">New [slug] page in /{folder}/</h4>
      <p class="hint small">
        One page per item of a source, at /{folder}/&lt;slug&gt;/, with the album look. A page with
        the same name in this folder wins over it.
      </p>
      <div class="tf">
        <label class="tf__label" for="{uid}-source">Source</label>
        <Select
          id="{uid}-source"
          bind:value={newSource}
          options={sources.map((s) => ({ value: s, label: `sources/${s}.json` }))}
        />
      </div>
      <div class="row">
        <Button size="small" onclick={() => select('')}>Cancel</Button>
        <Button size="small" icon="plus" disabled={!newSource || busy} onclick={addTemplate}>
          Add [slug] page
        </Button>
      </div>
    {:else if sel && ids.includes(sel)}
      {@const fixed = PROTECTED.includes(sel)}
      {@const inside = below(sel)}
      <header class="pg-detail__head">
        <h4 class="pg-detail__title">{titleOf(sel)}</h4>
        {#if !confirming && !fixed}
          <Button variant="danger" size="small" icon="trash" onclick={askDelete}>Delete</Button>
        {/if}
      </header>
      {#if confirming}
        <div class="confirm pg-confirm">
          <span>
            Delete {urlOf(sel)}{inside.length
              ? ` and everything in it: ${inside.map(urlOf).join(', ')}`
              : ''}?
          </span>
          <span class="row">
            <Button size="small" onclick={() => (confirming = false)}>Cancel</Button>
            <Button variant="danger" size="small" icon="trash" disabled={busy} onclick={remove}>
              Delete
            </Button>
          </span>
        </div>
      {/if}
      <p class="hint small">content/{pageFile(sel)}</p>
      <div class="row">
        <Button
          size="small"
          icon="eye"
          title="Show {urlOf(sel)} in the preview"
          onclick={() => show(sel)}
        >
          Open in preview
        </Button>
      </div>

      {#if isTemplate(sel)}
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
          <span class="tf__label">Name in the URL (renames the folder, with everything in it)</span>
          <input
            class={['tf__input', renameError && 'is-invalid']}
            spellcheck="false"
            bind:value={renameTo}
          />
        </label>
        <p class="hint small">{renameError}</p>
        <div class="row">
          <Button
            size="small"
            icon="pen"
            disabled={!renameTo || renameTo === nameOf(sel) || !!renameError || busy}
            onclick={rename}
          >
            Rename
          </Button>
        </div>
      {/if}
    {:else}
      <p class="hint">
        Every page is a folder, its URL, with its own index.json inside. The first row, /, is
        {urlOf(own)} itself; click a page below it to see the pages in it.
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
    gap: 8px;
    padding: 0 0 12px;
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

  // the delete question: what goes, then Cancel / Delete
  .pg-confirm {
    display: grid;
    gap: 8px;
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
