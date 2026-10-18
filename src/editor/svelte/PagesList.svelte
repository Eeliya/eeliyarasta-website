<!--
  Pages (the Content tab, while ui.pagesWin.open): the site's pages one folder at a time
  (src/editor/lib/page-tree.js). The top: the site parts (Header, Footer), then home's folder.
    header      ← (up one level, Esc) | the folder's page title, its path under it (each part
                goes there) | Own page (off: the folder's URL opens its first sub page, "As /")
    own row     "this page" (no icon): the folder's own page
    Sub items   its pages in the menu (nav.json), in the menu's order: the grip drags one to
                another place (the menu's order); its [slug] page pinned last (a lock, no drag)
    Not linked  every page not in the menu (All), or the ones under this folder (This folder)
  A click selects a row and shows it in the preview; a double click (or Enter) goes into a
  folder, or opens a page (its Sections, Transitions, SEO: PageHead.svelte goes back). The
  link button adds a page to the menu or takes it out (one undo step, saved with Save); +
  opens Add page (AddPageModal.svelte); Delete asks over the row: one line when nothing links
  to it, else with where its address and links go (a redirect). Adding and deleting go to
  disk at once (actions.pagesOp in main.js).
-->
<script>
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import AddPageModal from './AddPageModal.svelte';
  import { ui } from './ui.svelte.js';
  import { toast } from './toasts.svelte.js';
  import { listDrag, rowsOf } from './list-drag.svelte.js';
  import { NAV, pageFile } from '../../site/files.js';
  import { parentId, pathOfId } from '../../site/routes.js';
  import {
    crumbsOf,
    levelOf,
    pageIds,
    linkPage,
    linksTo,
    movePage,
    unlinkPage,
  } from '../lib/page-tree.js';
  import { plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); actions: pickTarget, pagesOp (main.js)
  let { live, actions } = $props();

  const GONE = '(gone)';
  const SITE_PARTS = [
    { id: 'header', title: 'Header', sub: 'The menu and its labels' },
    { id: 'footer', title: 'Footer', sub: 'Its sections and blocks' },
  ];
  let filter = $state('all');
  let sel = $state('');
  let asking = $state(''); // the row whose delete is asked
  let redirectTo = $state('');
  let busy = $state(false);
  let root = $state();
  let subList = $state();
  let addModal = $state();

  const level = $derived(ui.pagesWin.folder);
  // a folder that is gone (deleted, undone, a stale URL): the top
  $effect(() => {
    if (level && !pageIds(files).includes(level)) ui.pagesWin.folder = '';
  });
  // the store's files, a new object per change (the store edits its own in place)
  const files = $derived((live.version, { ...live.store.current }));
  const L = $derived(levelOf(files, level, filter));
  const movable = $derived(L.sub.filter((r) => !r.template));

  /** The page menu entry (main.js pageEntries) of page id. */
  const entryOf = (row) =>
    ui.pages.find((p) => (row.template ? p.template === row.id : p.path === row.path && !p.items));

  function go(next) {
    ui.pagesWin.folder = next;
    sel = '';
    asking = '';
    tick().then(() => root?.querySelector('.prow__open')?.focus());
  }
  function show(row) {
    const entry = row.part
      ? ui.pages.find((p) => p.kind === 'part' && p.id === row.id)
      : entryOf(row);
    if (entry) actions.pickTarget(entry);
  }
  function open(row) {
    show(row);
    ui.pagesWin.open = false;
  }
  function pick(row) {
    sel = row.id;
    show(row);
  }
  // a double click, or Enter / Space (a click without a pointer): into a folder, else open
  const into = (row) =>
    row.kids && !row.template && !row.self && !row.part ? go(row.id) : open(row);
  const onclick = (e, row) => (e.detail === 0 ? into(row) : pick(row));

  function setNav(next, what) {
    if (!next)
      return void toast(`Can't move ${what} there: dropdowns go one level deep`, { kind: 'error' });
    live.store.set(NAV, '/header', next.header, { source: 'panel', structure: true });
  }
  const pidOf = (id) => files[pageFile(id)]?.id;
  function toggleLink(row) {
    const nav = live.current(NAV) || {};
    if (row.linked) return setNav(unlinkPage(nav, row.pid));
    setNav(linkPage(nav, row.pid, row.title, level ? pidOf(level) : null));
    toast(`${row.title} is in the menu now (Content › Header to change it)`, { kind: 'ok' });
  }
  function setOwn(on) {
    live.store.set(pageFile(level), '/ownPage', on ? undefined : false, {
      source: 'panel',
      structure: true,
    });
  }

  // ---- reorder: the Sub items' grips (the menu's order)
  const ld = listDrag({
    lists: () => [rowsOf(subList, '[data-prow]')],
    shape: () => movable.map((r) => r.id).join(),
    ondrop: (d) => {
      const from = movable[d.j];
      const rest = movable.filter((_, i) => i !== d.j);
      const to = d.over.to;
      const place = to < rest.length ? { before: rest[to].pid } : { after: rest.at(-1).pid };
      setNav(movePage(live.current(NAV) || {}, from.pid, place), from.title);
    },
    scroller: () => subList,
    grabbing: true,
    edgeScroll: true,
    swallowClick: true,
  });
  const drag = $derived(ld.drag);

  // ---- delete
  const heavyOf = (row) => linksTo(files, row.pid, pageFile(row.id)) > 0;
  // its links outside the menu (the menu's own items are "In the menu")
  const others = (row) =>
    linksTo(files, row.pid, pageFile(row.id)) - linksTo({ [NAV]: files[NAV] }, row.pid);
  async function ask(row) {
    asking = row.id;
    redirectTo = pathOfId(parentId(row.id) || 'home');
    await tick();
    root?.querySelector('.prow__ask .ask-btns > :last-child')?.focus();
  }
  const redirectOptions = (row) => [
    ...ui.pages
      .filter(
        (p) => p.kind === 'page' && !p.items && p.path !== '/404/' && !p.path.startsWith(row.path),
      )
      .map((p) => ({ value: p.path, label: p.title, hint: p.path })),
    { value: GONE, label: 'No redirect (the page is gone)' },
  ];
  async function remove(row, heavy) {
    const redirect = heavy && redirectTo !== GONE ? redirectTo : null;
    busy = true;
    const res = await actions.pagesOp({ op: 'delete', id: row.id, redirect });
    busy = false;
    asking = '';
    // no redirect: its menu item goes too (a link to no page)
    if (res && row.linked && !redirect) setNav(unlinkPage(live.current(NAV) || {}, row.pid));
    if (res && row.id === level) go(parentId(level));
  }
  const askKey = (e) => e.key === 'Escape' && (e.stopPropagation(), (asking = ''));

  function onkeydown(e) {
    if (e.key !== 'Escape' || !level || asking || e.target.closest('[role="alertdialog"]')) return;
    e.stopPropagation();
    go(parentId(level));
  }
</script>

<!-- a row: [lead | title / path | As / | N › | link trash], its delete confirm over it -->
{#snippet row(r, { drag: j = -1 } = {})}
  {@const lifted = j >= 0 && drag?.j === j && drag.moving}
  <li
    class={['prow', sel === r.id && 'is-sel', lifted && 'is-lifted', j >= 0 && ld.dropAt(j)]}
    style:translate={lifted ? `0 ${drag.dy}px` : null}
    data-prow={j >= 0 ? j : undefined}
  >
    {#if j >= 0}
      <button
        type="button"
        class="prow__lead prow__grip"
        aria-label="Move {r.title} (drag: its place in the menu)"
        title="Drag to reorder"
        onpointerdown={(e) => ld.grab(e, { j })}
        ><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></button
      >
    {:else if r.template}
      <span class="prow__lead prow__pin" title="Always last: one page per item"
        ><i class="fa-solid fa-lock" aria-hidden="true"></i></span
      >
    {:else}
      <span class="prow__lead" aria-hidden="true"></span>
    {/if}
    <button
      type="button"
      class="prow__open"
      title={r.part
        ? `Double click: open the ${r.title}`
        : `content/${pageFile(r.id)} · double click: ${r.kids && !r.template && !r.self ? 'go inside' : 'open'}`}
      onclick={(e) => onclick(e, r)}
      ondblclick={() => into(r)}
    >
      <span class="prow__title">
        {#if r.template}<i class="fa-solid fa-layer-group" aria-hidden="true"></i>{/if}
        <span>{r.title}</span>
        {#if r.self}<span class="prow__tag">this page</span>{/if}
        {#if !r.part && live.changed(pageFile(r.id), '')}
          <i class="prow__dot" title="Unsaved changes" aria-label="Unsaved changes"></i>
        {/if}
      </span>
      <span class={['prow__path', r.part && 'is-muted']}>{r.part ? r.sub : r.seg}</span>
    </button>
    {#if r.asRoot}
      <span class="prow__at" title="{L.path} opens it (its own page is off)">As /</span>
    {/if}
    {#if r.template}
      <span class="prow__kids">{plural(r.items ?? 0, 'page')}</span>
    {:else if r.kids && !r.self}
      <span class="prow__kids" title="{plural(r.kids, 'page')} in it"
        >{r.kids}<i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span
      >
    {/if}
    {#if r.noindex}
      <i
        class="fa-solid fa-eye-slash prow__flag"
        title="Hidden from search engines (SEO: noindex)"
        aria-label="Hidden from search engines"
      ></i>
    {/if}
    {#if !r.self && !r.part}
      {#if !r.template}
        <Button
          size="small"
          icon={r.linked ? 'link-slash' : 'link'}
          iconOnly
          label={r.linked ? `Take ${r.title} out of the menu` : `Add ${r.title} to the menu`}
          onclick={() => toggleLink(r)}
        />
      {/if}
      <Button
        size="small"
        icon="trash"
        iconOnly
        label={r.fixed ? `${r.title} can't be deleted` : `Delete ${r.title}`}
        disabled={r.fixed || busy}
        onclick={() => ask(r)}
      />
    {/if}
    {#if asking === r.id}
      {@const heavy = heavyOf(r)}
      {#if heavy}
        <!-- anchored to the row, over the rows below: nothing moves -->
        <div
          class="prow__ask prow__ask--page"
          role="alertdialog"
          tabindex="-1"
          aria-label="Delete {r.title}?"
          onkeydown={askKey}
        >
          <div class="prow__q">
            <p>Delete {r.title}?</p>
            <span
              >{[
                r.linked && 'In the menu',
                others(r) && `${plural(others(r), 'link')} to it`,
                r.kids && `${plural(r.kids, 'page')} in it ${r.kids === 1 ? 'goes' : 'go'} too`,
              ]
                .filter(Boolean)
                .join(' · ')}</span
            >
          </div>
          <div class="tf">
            <span class="tf__label">Visitors and links to it go to</span>
            <Select
              aria-label="Redirect to"
              value={redirectTo}
              options={redirectOptions(r)}
              onchange={(v) => (redirectTo = v)}
            />
          </div>
          <p class="hint small">
            {redirectTo === GONE
              ? 'No redirect: its address shows the 404 page; its menu item goes, links to it stay.'
              : `A redirect (Settings › Redirects) sends ${r.path} there; links to it are updated.`}
          </p>
          <span class="ask-btns">
            <Button
              size="small"
              variant="danger"
              icon="trash"
              iconOnly
              label="Delete"
              disabled={busy}
              onclick={() => remove(r, true)}
            />
            <Button size="small" onclick={() => (asking = '')}>Cancel</Button>
          </span>
        </div>
      {:else}
        <div
          class="prow__ask"
          role="alertdialog"
          tabindex="-1"
          aria-label="Delete {r.title}?"
          onkeydown={askKey}
        >
          <span class="prow__ask-q">Delete {r.title}?</span>
          <span class="ask-btns">
            <Button
              size="small"
              variant="danger"
              icon="trash"
              iconOnly
              label="Delete"
              disabled={busy}
              onclick={() => remove(r, false)}
            />
            <Button size="small" onclick={() => (asking = '')}>Cancel</Button>
          </span>
        </div>
      {/if}
    {/if}
  </li>
{/snippet}

{#snippet head(title, n, add, withFilter = false)}
  <div class="pl-head">
    <span class="pl-head__title">{title}</span>
    {#if n !== undefined}<span class="pl-head__n">{n}</span>{/if}
    {#if withFilter}
      <span class="pl-filter" role="group" aria-label="Show">
        <button type="button" aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}
          >All</button
        >
        <button
          type="button"
          aria-pressed={filter === 'here'}
          disabled={!level}
          title={level ? `Only the pages under ${L.path}` : 'At the top: every page is under /'}
          onclick={() => (filter = 'here')}>This folder</button
        >
      </span>
    {/if}
    {#if add}
      <Button
        size="small"
        icon="plus"
        iconOnly
        label={add.label}
        disabled={level === '404'}
        onclick={() => addModal.open({ level, linked: add.linked })}
      />
    {/if}
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pl" bind:this={root} {onkeydown}>
  <!-- [ ← ]  Title            Own page ◯
              / photography/ -->
  <div class="pl-top">
    {#if level}
      <Button
        size="small"
        icon="arrow-left"
        iconOnly
        label="Up one level (Esc)"
        onclick={() => go(parentId(level))}
      />
    {/if}
    <div class="pl-top__main">
      <h2 class="pl-top__title">{L.title}</h2>
      <nav class="pl-top__path" aria-label="Where you are">
        {#each crumbsOf(level) as c, i (c.level)}
          {#if i === crumbsOf(level).length - 1}
            <span class="pl-top__crumb is-current" aria-current="location">{c.label}</span>
          {:else}
            <button type="button" class="pl-top__crumb" onclick={() => go(c.level)}
              >{c.label}</button
            >
          {/if}
        {/each}
      </nav>
    </div>
    {#if L.canOwn || L.own === null}
      <label
        class="pl-top__own"
        title={L.own ? `${L.path} is its own page` : `${L.path} opens its first sub page (302)`}
      >
        Own page
        <input
          type="checkbox"
          class="switch"
          role="switch"
          checked={!!L.own}
          onchange={(e) => setOwn(e.currentTarget.checked)}
        />
      </label>
    {/if}
  </div>

  {#if !level}
    {@render head('Site')}
    <ul class="pl-rows">
      {#each SITE_PARTS as p (p.id)}{@render row({ ...p, part: true })}{/each}
    </ul>
  {/if}

  {#if L.own}
    <ul class="pl-rows">{@render row(L.own)}</ul>
  {/if}

  {@render head('Sub items', L.sub.length, { label: 'Add a sub item (in the menu)', linked: true })}
  <ul class="pl-rows" bind:this={subList}>
    {#each L.sub as r, i (r.id)}
      {@render row(r, { drag: r.template ? -1 : i })}
    {/each}
  </ul>
  {#if !L.sub.length}<p class="hint small">No pages of {L.path} in the menu</p>{/if}

  {@render head(
    'Not linked',
    L.notLinked.length,
    { label: 'Add a page (not in the menu)', linked: false },
    true,
  )}
  <ul class="pl-rows">
    {#each L.notLinked as r (r.id)}{@render row(r)}{/each}
  </ul>
  {#if !L.notLinked.length}
    <p class="hint small">
      {filter === 'here' ? `None under ${L.path}` : 'Every page is in the menu'}
    </p>
  {/if}
</div>

<AddPageModal bind:this={addModal} {live} {actions} />

<style lang="scss">
  @use '../styles/mixins' as *;

  .pl {
    @include stack(var(--space-2));
    align-content: start;
  }

  // [ ← | title / path | Own page ◯ ]: 48px, the title on the rows' text edge
  .pl-top {
    @include row(var(--space-2));
    min-height: 48px;
    margin-bottom: var(--space-1);
  }

  .pl-top__main {
    @include stack(0);
    flex: 1;
    min-width: 0;
  }

  .pl-top__title {
    @include ellipsis;
    margin: 0;
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    line-height: 20px;
  }

  .pl-top__path {
    @include row(0);
    flex-wrap: wrap;
    font-size: var(--fs-base);
    line-height: 20px;
  }

  .pl-top__crumb {
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-link);
    font: inherit;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      @include focus-ring;
    }

    &.is-current {
      color: var(--c-text-muted);
      cursor: default;
      text-decoration: none;
    }
  }

  .pl-top__own {
    @include row(var(--space-2));
    @include muted;
    flex: none;
    cursor: pointer;
  }

  // a group's label: SUB ITEMS 2 …… [All | This folder] +
  .pl-head {
    @include row(var(--space-2));
    height: 24px;
    margin-top: var(--space-2);
    padding-right: var(--space-1);

    > :global(.btn) {
      margin-left: auto;
      opacity: 0.3;
    }

    &:hover > :global(.btn),
    > :global(.btn:focus-visible) {
      opacity: 1;
    }
  }

  .pl-head__title {
    @include muted;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .pl-head__n {
    @include muted;
    color: var(--c-text-faint);
  }

  // Not linked's filter: [ All | This folder ], 24px, the picked one white
  .pl-filter {
    @include row(0);
    margin-left: auto;
    border-radius: var(--radius-pill);
    box-shadow: inset 0 0 0 1px var(--c-line);

    button {
      @include muted;
      height: 24px;
      padding: 0 var(--space-2);
      border: 0;
      border-radius: var(--radius-pill);
      background: none;
      font: inherit;
      font-size: var(--fs-2xs);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      cursor: pointer;

      &[aria-pressed='true'] {
        color: var(--c-bg);
        background: var(--c-text);
      }

      &:disabled {
        cursor: default;
        opacity: 0.4;
      }

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  .pl-head:has(.pl-filter) > :global(.btn) {
    margin-left: 0;
  }

  .pl-rows {
    @include stack(var(--space-1));
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // a page card: [ lead 28px | title / path | … | buttons ], 48px, the top-level 12px corners
  .prow {
    @include row(0);
    position: relative;
    min-height: 48px;
    padding-right: var(--space-1);
    border-radius: var(--radius-lg);
    background: var(--c-surface-2);
    box-shadow: inset 0 0 0 1px transparent;

    > :global(.btn),
    > .prow__grip {
      flex: none;
      opacity: 0.3;
    }

    &:is(:hover, :focus-within) {
      box-shadow: inset 0 0 0 1px var(--c-line-hover);
    }

    &.is-sel {
      box-shadow: inset 0 0 0 1px var(--c-line-peek);
    }

    &:is(:hover, :focus-within, .is-sel, .is-lifted) > :global(.btn),
    &:is(:hover, :focus-within, .is-sel, .is-lifted) > .prow__grip {
      opacity: 1;
    }
  }

  // dragging: the row lifts and follows the pointer; a line in the gap where it lands
  .prow.is-lifted {
    z-index: 2;
    background: var(--c-surface-3);
    box-shadow:
      inset 0 0 0 1px var(--c-line-peek),
      0 18px 40px -12px var(--c-scrim);
  }

  .prow:global(.is-drop-before)::before,
  .prow:global(.is-drop-after)::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    border-top: 2px solid var(--c-accent);
  }

  .prow:global(.is-drop-before)::before {
    top: -4px;
  }

  .prow:global(.is-drop-after)::after {
    bottom: -4px;
  }

  // the grip (or the lock, or nothing): 28 × 48 at the left edge
  .prow__lead {
    display: grid;
    flex: none;
    place-items: center;
    align-self: stretch;
    width: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }

  .prow__grip {
    cursor: grab;
    touch-action: none;

    &:focus-visible {
      @include focus-ring;
    }
  }

  .prow__pin {
    color: var(--c-text-faint);
  }

  .prow__open {
    display: grid;
    flex: 1;
    align-self: stretch;
    align-content: center;
    min-width: 0;
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    line-height: 20px;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
      @include focus-ring;
    }
  }

  .prow__title {
    @include row(var(--space-2));
    min-width: 0;

    > span:first-of-type {
      @include ellipsis;
    }

    i {
      flex: none;
      color: var(--c-text-muted);
      font-size: var(--fs-sm);
    }
  }

  // unsaved changes in its file: the editor's dot
  .prow__dot {
    flex: none;
    width: var(--size-changed);
    height: var(--size-changed);
    border-radius: var(--radius-round);
    background: var(--c-accent);
  }

  .prow__tag {
    @include muted;
    flex: none;
    color: var(--c-text-faint);
  }

  .prow__path {
    @include ellipsis;
    color: var(--c-link);

    &.is-muted {
      @include muted;
      font-size: var(--fs-base);
    }
  }

  // "2 ›": the pages inside, a hint for the double click (not a button)
  .prow__kids {
    @include row(var(--space-1));
    @include muted;
    flex: none;
    margin-right: var(--space-2);

    i {
      font-size: var(--fs-2xs);
    }
  }

  .prow__flag {
    @include muted;
    flex: none;
    width: 24px;
    text-align: center;
  }

  // the first sub page, opened at the folder's URL (its own page off)
  .prow__at {
    flex: none;
    margin-right: var(--space-2);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    color: var(--c-accent);
    font-size: var(--fs-sm);
    line-height: 16px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-accent) 45%, transparent);
  }

  // Delete?: over the row at its size and corners, one line, 12px in all round, a red line
  .prow__ask {
    @include row(var(--space-3));
    position: absolute;
    inset: 0;
    z-index: 3;
    padding: 0 var(--space-3);
    border-radius: inherit;
    background: var(--c-surface-2);
    box-shadow: inset 0 0 0 1px var(--c-danger);
  }

  .prow__ask-q {
    @include ellipsis;
    flex: 1;
    min-width: 0;
  }

  // linked or linked to: anchored to the row's top, as wide, over the rows below, 8px in
  .prow__ask--page {
    @include stack(var(--space-3));
    bottom: auto;
    padding: var(--space-2);
    background: var(--c-card);
    box-shadow:
      inset 0 0 0 1px var(--c-danger),
      0 16px 40px -12px var(--c-scrim);

    :global(.tf) {
      margin: 0;
    }

    .hint {
      margin: 0;
    }

    .ask-btns {
      justify-self: start;
    }
  }

  .prow__q {
    @include stack(0);

    p {
      @include ellipsis;
      margin: 0;
      color: var(--c-text-strong);
      font-weight: 500;
      line-height: 20px;
    }

    span {
      @include muted;
      line-height: 20px;
    }
  }
</style>
