<!--
  Pages (the Content tab, while ui.pagesWin.open): the site's pages one folder at a time
  (src/editor/lib/page-tree.js), its rows on the pages' card colour (--c-page-card). Another
  level slides in (lib/slide.js): a deeper one from the right, a higher one from the left.
    header      one 32px row: ← (up one level, Esc; where the page head's back arrow is) | the
                path, each part goes there ("/" at the top) | + (Add page; off where only a
                [param] page could go and it has one)
    menu list   one list in the menu's order (nav.json): at the top home and the other pages;
                in a folder its root row first (locked: its own page, the Own page switch
                when it has a normal sub page; off: quieter, its first sub page "As /"), then
                its pages, its [param] page pinned last (a lock)
    Not linked  every page not in the menu (All), or the ones under this folder (This folder;
                no filter at the top: every page is under /), in the site's order
    Site        at the top: the Header and Footer (no grip, no delete)
  The grips drag: in the menu list to another place (the menu's order); from it into Not
  linked (out of the menu); from Not linked into it (into the menu there). The row in hand
  leaves its place, a dashed placeholder card shows where it lands (red with why: refused). A page of another
  folder dropped there moves here (its address changes, links follow, no redirect), unless
  its name is taken here. 404 and [param] pages don't move. A click selects a row and shows
  it in the preview; a double click (or Enter) goes into a page's level (any page, a plain one
  too: its root row and "No sub pages yet"; a [param] page's: it can hold another), and on a
  level's root row, on Home, 404, Header or Footer opens it (its Sections, Transitions, SEO:
  PageHead.svelte goes back). Each row's edit button (pen) opens it the same way, one click
  (no select, no drag). Delete asks over the row: one line when nothing links to it,
  else with where its address and links go (a redirect). Adding, moving and deleting go to
  disk at once (actions.pagesOp in main.js).
-->
<script>
  import { tick, untrack } from 'svelte';
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
    entryFor,
    goesInside,
    hasInside,
    levelOf,
    linkAt,
    linksTo,
    pageIds,
    movePage,
    parentPath,
    shownPath,
    sortedAt,
    tagOf,
    unlinkPage,
  } from '../lib/page-tree.js';
  import { plural } from '../lib/format.js';
  import { swapView } from '../lib/slide.js';

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
  // another level slides in (lib/slide.js): a deeper one from the right, a higher one (←, a
  // path part, Esc) from the left; a still copy of the one before slides out
  let shown = untrack(() => ui.pagesWin.folder);
  const depth = (id) => (id ? id.split('/').length : 0);
  $effect.pre(() => {
    const next = level;
    untrack(() => {
      if (next === shown || !root) return void (shown = next);
      const dir = depth(next) > depth(shown) ? 1 : -1;
      shown = next;
      const play = swapView(root, [...root.children]);
      tick().then(() => root && play([...root.children], dir));
    });
  });
  // the store's files (live.svelte.js: one shared copy per change)
  const files = $derived(live.files);
  // the top has no This folder (every page is under /)
  const L = $derived(levelOf(files, level, level ? filter : 'all', live.routes));
  const movable = $derived(L.sub.filter((r) => r.movable));
  const nlMovable = $derived(L.notLinked.filter((r) => r.movable));

  function go(next) {
    ui.pagesWin.folder = next;
    sel = '';
    asking = '';
    tick().then(() => root?.querySelector('.prow__open')?.focus());
  }
  // a [param] page without pages opens too (its main block can be fixed there: main.js)
  function show(row) {
    const entry = entryFor(ui.pages, row);
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
  // a double click, or Enter / Space (a click without a pointer): into the page's level (its
  // root row first, its sub pages, or "No sub pages yet"), its root row: open it (page-tree.js)
  const inside = (row) => !row.part && goesInside(row);
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
      if (busy) return; // a move runs: one op at a time
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
  // the row in hand floats over the list from where it was (.pl's coordinates)
  const grab = (e, j, at) =>
    !busy &&
    ld.grab(e, {
      j,
      at,
      top:
        e.currentTarget.closest('.prow').getBoundingClientRect().top -
        root.getBoundingClientRect().top,
    });
  /** A Not linked page dropped on the menu list: linked there, moved here first, or refused. */
  async function link(row, plan) {
    if (plan.kind === 'refuse') return void toast(plan.why, { kind: 'error' });
    // the level and its page now: the op may end after another level is shown
    const parent = level;
    const parentPid = level ? pidOf(level) : null;
    if (plan.kind === 'link')
      return setNav(
        linkAt(live.current(NAV) || {}, row.pid, row.title, parentPid, plan.place),
        row.title,
      );
    // moved here and linked in one op on disk (nav.json follows the files)
    busy = true;
    const res = await actions.pagesOp({
      op: 'move',
      id: row.id,
      parent,
      link: { parentPid, place: plan.place },
    });
    busy = false;
    if (res)
      toast(`${row.title} is at ${shownPath(res.id)} now (no redirect from ${shownPath(row.id)})`, {
        kind: 'ok',
      });
  }
  const drag = $derived(ld.drag);
  // where a drag would land, for the lines and the list it lights up
  const over = $derived(drag?.moving ? drag.over : null);
  const dragged = $derived(drag ? (drag.at === 0 ? movable : nlMovable)[drag.j] : null);
  /**
   * Where the drag's placeholder (a dashed card) is: { at: list (0 the menu list, 1 Not
   * linked), before: the row it sits before (null: the list's end), why: refused }. The row in
   * hand leaves its place; over its own list the placeholder opens where it lands (that list
   * keeps its height); over the other list its place stays open as an empty gap (nothing above
   * moves); over neither, the placeholder waits in its place. Into Not linked it sits at the
   * page's place in the site's order (Not linked has none of its own).
   */
  const slots = $derived.by(() => {
    if (!drag?.moving || !dragged) return [];
    const rows = drag.at === 0 ? L.sub : L.notLinked;
    const home = { at: drag.at, before: rows[rows.indexOf(dragged) + 1]?.id ?? null };
    const o = over && !(over.at === 1 && drag.at === 1) ? over : null;
    if (!o) return [home];
    let to;
    if (o.at === 1) to = { at: 1, before: L.notLinked[sortedAt(L.notLinked, dragged.id)]?.id };
    else if (drag.at === 0) to = { at: 0, before: movable.filter((r) => r !== dragged)[o.to]?.id };
    else {
      const plan = dropOf(files, L, dragged, o.to);
      to = { at: 0, before: movable[o.to]?.id, why: plan.kind === 'refuse' ? plan.why : '' };
    }
    to.before ??= null;
    return o.at === drag.at ? [to] : [{ ...home, gap: true }, to];
  });
  // the slots before row id of list at (id null: at its end)
  const slotsAt = (at, id) => slots.filter((p) => p.at === at && p.before === id);
  // the menu list's end: after its last movable row (a [param] row stays pinned after it)
  const lastMovable = $derived(movable.at(-1)?.id);

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
    // no redirect: its menu item goes with it, on disk (pagesOp: nav.json follows the files)
    await actions.pagesOp({ op: 'delete', id: row.id, redirect });
    busy = false;
    asking = '';
  }
  const askKey = (e) => e.key === 'Escape' && (e.stopPropagation(), (asking = ''));

  function onkeydown(e) {
    if (e.key !== 'Escape' || !level || asking || e.target.closest('[role="alertdialog"]')) return;
    e.stopPropagation();
    go(parentId(level));
  }
</script>

<!-- a row: [lead | title / path (tag) | As / | edit | trash | ›] (a level's root row: edit,
     Own page), its delete confirm over it
     (j, at: its grip's index in the menu list (0) or Not linked (1)) -->
{#snippet row(r, { j = -1, at = 0 } = {})}
  {@const lifted = j >= 0 && drag?.moving && drag.at === at && drag.j === j}
  {@const tag = tagOf(r)}
  <li
    class={['prow', sel === r.id && 'is-sel', lifted && 'is-lifted', r.off && 'is-off']}
    style:top={lifted ? `${drag.top}px` : null}
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
        onpointerdown={(e) => grab(e, j, at)}
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
        {#if tag}
          <span
            class={['prow__tag', tag.warn && 'is-warn']}
            title={r.template
              ? `${plural(r.count ?? 0, 'page')}: one per item its main block matches`
              : null}>{tag.text}</span
          >
        {/if}
        {#if !r.part && live.changed(pageFile(r.id), '')}
          <i class="prow__dot" role="img" title="Unsaved changes" aria-label="Unsaved changes"></i>
        {/if}
      </span>
      <span class={['prow__path', r.part && 'is-muted']}>{r.part ? r.sub : r.seg}</span>
    </button>
    {#if r.asRoot}
      <span class="prow__at" title="{L.path} opens it (its own page is off)">As /</span>
    {/if}
    {#if r.noindex}
      <i
        class="fa-solid fa-eye-slash prow__flag"
        role="img"
        title="Hidden from search engines (SEO: noindex)"
        aria-label="Hidden from search engines"
      ></i>
    {/if}
    <!-- [ edit | trash | › ]: 24px slots each (empty ones kept), so the columns line up; a
         level's root row: edit, then its Own page switch -->
    <Button
      size="small"
      icon="pen-to-square"
      iconOnly
      label="Edit {r.title}"
      title="Edit: its sections"
      onclick={() => open(r)}
    />
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
    {:else if !r.self}
      <span class="prow__slot" aria-hidden="true"></span>
    {/if}
    {#if r.self && !L.canOwn}
      <!-- no switch: its place (two slots), so edit stays in the column -->
      <span class="prow__slot" aria-hidden="true"></span>
      <span class="prow__slot" aria-hidden="true"></span>
    {/if}
    {#if !r.self}
      <span class="prow__slot" aria-hidden="true"
        >{#if hasInside(r)}<i class="fa-solid fa-chevron-right" title="Double click: go inside"
          ></i>{/if}</span
      >
    {/if}
    {#if asking === r.id}
      {@const heavy = heavyOf(r)}
      {@const links = heavy ? others(r) : 0}
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
                links && `${plural(links, 'link')} to it`,
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

<!-- the drop placeholder: a page card's size and corners, dashed, in the page accent (6%);
     refused: red, why; gap: the dragged row's place kept open, empty -->
{#snippet slot(p)}
  <li class={['pl-slot', p.why && 'is-refused', p.gap && 'is-gap']} aria-hidden="true">
    {#if p.why}<i class="fa-solid fa-ban"></i><span>{p.why}</span>{/if}
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
      <button
        type="button"
        class="pl-top__back"
        aria-label="Up one level (Esc)"
        title="Up one level (Esc)"
        onclick={() => go(parentId(level))}
        ><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button
      >
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

  <ul class="pl-rows" bind:this={subList}>
    {#if L.own}{@render row(L.own)}{/if}
    {#if !lastMovable}{#each slotsAt(0, null) as p, i (i)}{@render slot(p)}{/each}{/if}
    {#each L.sub as r (r.id)}
      {#each slotsAt(0, r.id) as p, i (i)}{@render slot(p)}{/each}
      {@render row(r, { j: movable.indexOf(r) })}
      {#if r.id === lastMovable}
        {#each slotsAt(0, null) as p, i (i)}{@render slot(p)}{/each}
      {/if}
    {/each}
  </ul>
  {#if level && !L.sub.length}<p class="hint small">No sub pages yet: + adds one.</p>{/if}

  <div class="pl-zone" bind:this={nlZone}>
    {@render head('Not linked', L.notLinked.length, !!level)}
    <ul class="pl-rows">
      {#each L.notLinked as r (r.id)}
        {#each slotsAt(1, r.id) as p, i (i)}{@render slot(p)}{/each}
        {@render row(r, { j: nlMovable.indexOf(r), at: 1 })}
      {/each}
      {#each slotsAt(1, null) as p, i (i)}{@render slot(p)}{/each}
    </ul>
    {#if !L.notLinked.length && !slotsAt(1, null).length}
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

  // positioned: a dragged row floats over it, a level sliding out lies over it
  .pl {
    @include stack(var(--space-2));
    position: relative;
    align-content: start;
  }

  // [ ← | path | + ]: one 32px row; its ← on the 12px edge where the page head's back arrow is
  // (PageHead.svelte: switching between them, the arrow stays put)
  .pl-top {
    @include row(var(--space-2));
    min-height: var(--size-control);
    margin-bottom: var(--space-1);
  }

  // text-style: just the arrow, no padding, muted until hovered
  .pl-top__back {
    display: grid;
    flex: none;
    place-items: center;
    height: var(--size-control);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  // one line, never wrapping (the header stays 32px): the parts above shrink first, cut with
  // "…", the current one stays whole
  .pl-top__path {
    @include row(0);
    flex: 1;
    min-width: 0;
    font-size: var(--fs-base);
    line-height: 20px;
    white-space: nowrap;
  }

  .pl-top__crumb {
    @include ellipsis;
    flex: 0 1 auto;
    min-width: 1ch;
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
      flex: none;
      max-width: 100%;
      color: var(--c-text-muted);
      cursor: default;
      text-decoration: none;
    }
  }

  .pl-top__add {
    display: flex;
    flex: none;
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

  // dragging: the row lifts out of its list and follows the pointer, over the list
  .prow.is-lifted {
    position: absolute;
    inset-inline: 0;
    z-index: 2;
    background: var(--c-card-peek);
    box-shadow:
      inset 0 0 0 1px var(--c-line-peek),
      0 18px 40px -12px var(--c-scrim);
  }

  // where it lands: a page card's size and corners, dashed in the page accent, 6% of it
  .pl-slot {
    @include row(var(--space-2));
    min-height: 48px;
    padding: 0 var(--space-3);
    border: 1px dashed var(--c-page-accent);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--c-page-accent) 6%, transparent);
    box-sizing: border-box;

    // refused: red, the ban and why
    &.is-refused {
      border-color: var(--c-error);
      background: color-mix(in srgb, var(--c-error) 6%, transparent);
      color: var(--c-error);
      font-size: var(--fs-sm);

      span {
        @include ellipsis;
        min-width: 0;
      }
    }

    // the dragged row's place, kept while it is over the other list
    &.is-gap {
      border-color: transparent;
      background: none;
    }
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
    @include changed-dot;
  }

  .prow__tag {
    flex: none;
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
  }

  .prow__path {
    @include ellipsis;
    color: var(--c-page-accent);

    &.is-muted {
      @include muted;
      font-size: var(--fs-base);
    }
  }

  // a [param] page with no pages (its source has no items)
  .prow__tag.is-warn {
    color: var(--c-warning);
  }

  // an action's 24px place when it has none, or the › (pages inside: a double click goes in)
  .prow__slot {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    color: var(--c-text-muted);
    font-size: var(--fs-2xs);
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
