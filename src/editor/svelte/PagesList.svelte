<!--
  Pages (the Content tab, while ui.pagesWin.open): the site's pages one folder at a time
  (src/editor/lib/page-tree.js), its rows on the pages' card colour (--c-page-card).
    header      ← (up one level, Esc) | the path, each part goes there ("/" at the top) | +
                (Add page; off where only a [param] page could go and it has one)
    menu list   one list in the menu's order (nav.json): at the top home and the other pages;
                in a folder its root row first (locked: its own page, the Own page switch
                when it has a normal sub page; off: quieter, its first sub page "As /"), then
                its pages, its [param] page pinned last (a lock)
    Not linked  every page not in the menu (All), or the ones under this folder (This folder;
                no filter at the top: every page is under /), in the site's order
    Site        at the top: the Header and Footer (no grip, no delete)
  The grips drag: in the menu list to another place (the menu's order); from it into Not
  linked (out of the menu); from Not linked into it (into the menu there). A page of another
  folder dropped there moves here (its address changes, links follow, no redirect), unless
  its name is taken here. 404 and [param] pages don't move. A click selects a row and shows
  it in the preview; a double click (or Enter) goes into a folder (a [param] page's too: it
  can hold another, "[item]/[year]/"), or opens a page (its Sections, Transitions, SEO:
  PageHead.svelte goes back). Delete asks over the row: one line when nothing links to it,
  else with where its address and links go (a redirect). Adding, moving and deleting go to
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
  import { NAV, isTemplate, pageFile } from '../../site/files.js';
  import { parentId, pathOfId } from '../../site/routes.js';
  import {
    crumbsOf,
    dropOf,
    levelOf,
    linkAt,
    linksTo,
    pageIds,
    movePage,
    parentPath,
    shownPath,
    sortedAt,
    unlinkPage,
  } from '../lib/page-tree.js';
  import { plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); actions: pickTarget, pagesOp (main.js)
  let { live, actions } = $props();

  const GONE = '(gone)';
  const FULL = 'Only one [param] page per folder: it has one';
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
  let nlZone = $state();
  let addModal = $state();

  const level = $derived(ui.pagesWin.folder);
  // a folder that is gone (deleted, undone, a stale URL): the top (once the pages are there:
  // a ?pages=/folder/ URL opens before the content is loaded)
  $effect(() => {
    const ids = pageIds(files);
    if (level && ids.length && !ids.includes(level)) ui.pagesWin.folder = '';
  });
  // the store's files, a new object per change (the store edits its own in place)
  const files = $derived((live.version, { ...live.store.current }));
  // the top has no This folder (every page is under /)
  const L = $derived(levelOf(files, level, level ? filter : 'all', live.routes));
  const movable = $derived(L.sub.filter((r) => r.movable));
  const nlMovable = $derived(L.notLinked.filter((r) => r.movable));

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
  // a double click, or Enter / Space (a click without a pointer): into a folder (a [param]
  // page's always: another [param] page can go in it), else open
  const inside = (row) => (row.kids || row.template) && !row.self && !row.part;
  const into = (row) => (inside(row) ? go(row.id) : open(row));
  const onclick = (e, row) => (e.detail === 0 ? into(row) : pick(row));

  function setNav(next, what) {
    if (!next)
      return void toast(`Can't move ${what} there: dropdowns go one level deep`, { kind: 'error' });
    live.store.set(NAV, '/header', next.header, { source: 'panel', structure: true });
  }
  const pidOf = (id) => files[pageFile(id)]?.id;
  function setOwn(on) {
    live.store.set(pageFile(level), '/ownPage', on ? undefined : false, {
      source: 'panel',
      structure: true,
    });
  }

  // ---- drag: in the menu list (its order), between it and Not linked (in or out of the menu)
  const ld = listDrag({
    lists: () => [rowsOf(subList, '[data-prow]', 0), rowsOf(nlZone, '.pl-rows > [data-prow]', 1)],
    shape: () => `${movable.map((r) => r.id)}|${nlMovable.map((r) => r.id)}`,
    ondrop: (d) => {
      const nav = live.current(NAV) || {};
      const from = (d.at === 0 ? movable : nlMovable)[d.j];
      if (d.over.at === 1) {
        // into Not linked: out of the menu (Not linked has no order: where it lands is its place)
        if (d.at === 0) setNav(unlinkPage(nav, from.pid));
        return;
      }
      if (d.at === 0) {
        const rest = movable.filter((_, i) => i !== d.j);
        const to = d.over.to;
        const place = to < rest.length ? { before: rest[to].pid } : { after: rest.at(-1).pid };
        return setNav(movePage(nav, from.pid, place), from.title);
      }
      link(from, dropOf(files, L, from, d.over.to));
    },
    scroller: () => subList,
    grabbing: true,
    edgeScroll: true,
    swallowClick: true,
  });
  const parentPid = () => (level ? pidOf(level) : null);
  /** A Not linked page dropped on the menu list: linked there, moved here first, or refused. */
  async function link(row, plan) {
    if (plan.kind === 'refuse') return void toast(plan.why, { kind: 'error' });
    if (plan.kind === 'move') {
      busy = true;
      const res = await actions.pagesOp({ op: 'move', id: row.id, parent: level });
      busy = false;
      if (!res) return;
      toast(`${row.title} is at ${shownPath(res.id)} now (no redirect from ${shownPath(row.id)})`, {
        kind: 'ok',
      });
    }
    setNav(linkAt(live.current(NAV) || {}, row.pid, row.title, parentPid(), plan.place), row.title);
  }
  const drag = $derived(ld.drag);
  // where a drag would land, for the lines and the list it lights up
  const over = $derived(drag?.moving ? drag.over : null);
  const dragged = $derived(drag ? (drag.at === 0 ? movable : nlMovable)[drag.j] : null);
  // into Not linked: the line where it will sit (the site's order), not where the pointer is
  const nlAt = $derived(
    over?.at === 1 && drag.at === 0 && dragged ? sortedAt(L.notLinked, dragged.id) : -1,
  );
  const nlLine = (i) =>
    nlAt < 0
      ? ''
      : i === nlAt
        ? 'is-drop-before'
        : nlAt === L.notLinked.length && i === nlAt - 1
          ? 'is-drop-after'
          : '';

  // ---- delete
  // a [param] page always asks: its item pages have addresses visitors may come to
  const heavyOf = (row) => row.template || linksTo(files, row.pid, pageFile(row.id)) > 0;
  // its links outside the menu (the menu's own items are "In the menu")
  const others = (row) =>
    linksTo(files, row.pid, pageFile(row.id)) - linksTo({ [NAV]: files[NAV] }, row.pid);
  async function ask(row) {
    asking = row.id;
    redirectTo = parentPath(row.id);
    await tick();
    root?.querySelector('.prow__ask .ask-btns > :last-child')?.focus();
  }
  // a [param] page in one: the same outer item, one level up ("/people/:person/"), or none
  const redirectOptions = (row) =>
    row.nested
      ? [
          {
            value: pathOfId(parentId(row.id)),
            label: `Same ${row.nested}, one level up`,
            hint: `${row.nested}/`,
          },
          { value: GONE, label: 'No redirect (its pages are gone)' },
        ]
      : pageOptions(row);
  const pageOptions = (row) => [
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

<!-- a row: [lead | title / path | As / | N › | trash or Own page], its delete confirm over it
     (j, at: its grip's index in the menu list (0) or Not linked (1); line: a drop line) -->
{#snippet row(r, { j = -1, at = 0, line = '' } = {})}
  {@const lifted = j >= 0 && drag?.moving && drag.at === at && drag.j === j}
  <li
    class={[
      'prow',
      sel === r.id && 'is-sel',
      lifted && 'is-lifted',
      r.off && 'is-off',
      line || (at === 0 && j >= 0 && ld.dropAt(j, 0)),
    ]}
    style:translate={lifted ? `0 ${drag.dy}px` : null}
    data-prow={j >= 0 ? j : undefined}
  >
    {#if j >= 0}
      <button
        type="button"
        class="prow__lead prow__grip"
        aria-label={at === 0
          ? `Move ${r.title} (drag: its place in the menu, or into Not linked)`
          : `Move ${r.title} (drag into the list above: into the menu)`}
        title={at === 0 ? 'Drag to reorder, or into Not linked' : 'Drag into the menu list'}
        onpointerdown={(e) => ld.grab(e, { j, at })}
        ><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></button
      >
    {:else if r.self || r.template}
      <span
        class="prow__lead prow__pin"
        title={r.self ? 'Always first: the folder’s own page' : 'Always last: one page per item'}
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
        : `content/${pageFile(r.id)} · double click: ${inside(r) ? 'go inside' : 'open'}`}
      onclick={(e) => onclick(e, r)}
      ondblclick={() => into(r)}
    >
      <span class="prow__title">
        {#if r.template}<i class="fa-solid fa-layer-group" aria-hidden="true"></i>{/if}
        <span>{r.title}</span>
        {#if r.self}
          <span class="prow__tag">root</span>
        {:else if r.template}
          <span class="prow__tag">{r.nested ? `per ${r.nested}` : 'per item'}</span>
        {/if}
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
      <span class="prow__kids" title="{plural(r.items ?? 0, 'item')} in its source"
        >{plural(r.count ?? 0, 'page')}{#if !r.self}<i
            class="fa-solid fa-chevron-right"
            aria-hidden="true"
          ></i>{/if}</span
      >
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
    {#if r.self && L.canOwn}
      <label
        class="prow__own"
        title={r.off
          ? `${L.path} opens its first sub page (302). On: this page`
          : `${L.path} is this page. Off: it opens its first sub page`}
      >
        <input
          type="checkbox"
          class="switch"
          role="switch"
          aria-label="Own page"
          checked={!r.off}
          onchange={(e) => setOwn(e.currentTarget.checked)}
        />
      </label>
    {:else if !r.self && !r.part && !r.fixed}
      <Button
        size="small"
        icon="trash"
        iconOnly
        label="Delete {r.title}"
        disabled={busy}
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
                r.template && `Its item pages${r.nested ? `, per ${r.nested}` : ''}`,
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
              ? r.template
                ? 'No redirect: its addresses show the 404 page; links to them stay.'
                : 'No redirect: its address shows the 404 page; its menu item goes, links to it stay.'
              : r.nested
                ? `Each ${r.title} page goes to its own ${r.nested} page; links follow.`
                : `A redirect (Settings › Redirects) sends ${shownPath(r.id)} there; links to it are updated.`}
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

{#snippet head(title, n, withFilter = false)}
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
          title="Only the pages under {L.path}"
          onclick={() => (filter = 'here')}>This folder</button
        >
      </span>
    {/if}
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pl" bind:this={root} {onkeydown}>
  <!-- [ ← ] / photography/                    [ + ]   (the top: just / and +) -->
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
    <nav class="pl-top__path" aria-label="Where you are">
      {#each crumbsOf(level) as c, i (c.level)}
        {#if i === crumbsOf(level).length - 1}
          <span class="pl-top__crumb is-current" aria-current="location">{c.label}</span>
        {:else}
          <button type="button" class="pl-top__crumb" onclick={() => go(c.level)}>{c.label}</button>
        {/if}
      {/each}
    </nav>
    <!-- off: a [param] folder takes only a [param] page, and it has one (the title says so:
         a disabled button shows none of its own) -->
    <span class="pl-top__add" title={L.full ? FULL : null}>
      <Button
        size="small"
        icon="plus"
        iconOnly
        label="Add page"
        title={L.full ? FULL : undefined}
        disabled={level === '404' || L.full}
        onclick={() => addModal.open({ level, linked: !isTemplate(level) })}
      />
    </span>
  </div>

  <ul class={['pl-rows', over?.at === 0 && drag.at === 1 && 'is-target']} bind:this={subList}>
    {#if L.own}
      {@render row(L.own, { line: over?.at === 0 && !movable.length ? 'is-drop-after' : '' })}
    {/if}
    {#each L.sub as r (r.id)}
      {@render row(r, { j: movable.indexOf(r) })}
    {/each}
  </ul>
  {#if level && !L.sub.length}<p class="hint small">No sub pages yet: + adds one.</p>{/if}

  <div class={['pl-zone', over?.at === 1 && drag.at === 0 && 'is-target']} bind:this={nlZone}>
    {@render head('Not linked', L.notLinked.length, !!level)}
    <ul class="pl-rows">
      {#each L.notLinked as r, i (r.id)}
        {@render row(r, { j: nlMovable.indexOf(r), at: 1, line: nlLine(i) })}
      {/each}
    </ul>
    {#if !L.notLinked.length}
      <p class="hint small">
        {filter === 'here' && level ? `None under ${L.path}` : 'Every page is in the menu'}
      </p>
    {/if}
  </div>

  {#if !level}
    {@render head('Site')}
    <ul class="pl-rows">
      {#each SITE_PARTS as p (p.id)}{@render row({ ...p, part: true })}{/each}
    </ul>
  {/if}
</div>

<AddPageModal bind:this={addModal} {live} {actions} />

<style lang="scss">
  @use '../styles/mixins' as *;

  .pl {
    @include stack(var(--space-2));
    align-content: start;
  }

  // [ ← | path | + ]: 48px, the path on the rows' text edge (at the top: "/" and +)
  .pl-top {
    @include row(var(--space-2));
    min-height: 48px;
    margin-bottom: var(--space-1);
  }

  .pl-top__path {
    @include row(0);
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
    font-size: var(--fs-base);
    line-height: 20px;
  }

  .pl-top__crumb {
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-page-accent);
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

  .pl-top__add {
    display: flex;
    flex: none;
  }

  // a drag's target list: lit (an outline: nothing moves)
  .pl-rows.is-target,
  .pl-zone.is-target {
    border-radius: var(--radius-lg);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--c-accent) 45%, transparent);
  }

  .pl-zone {
    @include stack(var(--space-2));
  }

  // a group's label: SUB ITEMS 2 …… [All | This folder] +
  .pl-head {
    @include row(var(--space-2));
    height: 24px;
    margin-top: var(--space-2);
    padding-right: var(--space-1);
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
    background: var(--c-page-card);
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
    background: var(--c-card-peek);
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
    color: var(--c-page-accent);

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
    color: var(--c-page-accent);
    font-size: var(--fs-sm);
    line-height: 16px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-page-accent) 45%, transparent);
  }

  // a folder's root row, its own page off: still there, quieter
  .prow.is-off {
    .prow__title,
    .prow__path,
    .prow__pin {
      @include muted;
    }
  }

  // the root row's Own page switch, at its end where the buttons are
  .prow__own {
    @include row(0);
    flex: none;
    align-self: stretch;
    padding: 0 var(--space-2);
    cursor: pointer;
  }

  // Delete?: over the row at its size and corners, one line, 12px in all round, a red line
  .prow__ask {
    @include row(var(--space-3));
    position: absolute;
    inset: 0;
    z-index: 3;
    padding: 0 var(--space-3);
    border-radius: inherit;
    background: var(--c-page-card);
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
