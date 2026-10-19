<!--
  The page or site part being edited, over the Content and Motion tabs (the pages list takes
  its place while it is open: PagesList.svelte; its ← on the same spot):
    ← Return to navigation
    Title
    / photography/ people/          (a site part: its title only)
  Return to navigation opens the pages list (in the Content tab) where the page was opened (its
  own folder, or the one it is in), a path part at that folder. A [param] page shows the item
  the preview is on (main.js pickTarget: the one shown, else its first; a link in the preview
  goes to another).
-->
<script>
  import { ui } from './ui.svelte.js';
  import { parentId, pathOfId } from '../../site/routes.js';
  import { crumbsOf, pageIds, titleOf } from '../lib/page-tree.js';

  // live: reactive store; actions: pickTarget, setMode (main.js)
  let { live, actions } = $props();

  // the store's files, a new object per change (the store edits its own in place)
  const files = $derived((live.version, { ...live.store.current }));
  const t = $derived(ui.target);
  const id = $derived(
    t?.kind !== 'page'
      ? null
      : t.template || pageIds(files).find((p) => pathOfId(p) === t.path) || null,
  );
  // the page's path parts: its folder's, then its own (the current one)
  const crumbs = $derived.by(() => {
    if (!id) return []; // a site part: its title only
    if (id === 'home') return [{ label: '/', level: '' }];
    const own = id.slice(id.lastIndexOf('/') + 1); // a [param] page: "[person]"
    return [...crumbsOf(parentId(id)), { label: `${own}/`, level: null }];
  });
  // a [param] page: its menu entry's name ("People item"), not "[person]"
  const title = $derived(id && !t.template ? titleOf(files, id) : t?.title || '');

  // ←: the level it was opened from (its own folder or the one it is in), else the latter
  const backTo = () => {
    const at = ui.pagesWin.folder;
    if (!id || id === 'home') return id ? '' : at;
    return at === id || at === parentId(id) ? at : parentId(id);
  };
  function list(level = backTo()) {
    ui.pagesWin = { open: true, folder: level };
    if (ui.mode !== 'text') actions.setMode('text');
  }
</script>

<div class="ph">
  <button type="button" class="ph__back" onclick={() => list()}
    ><i class="fa-solid fa-arrow-left" aria-hidden="true"></i>Return to navigation</button
  >
  <h2 class="ph__title">{title}</h2>
  {#if crumbs.length}
    <nav class="ph__path" aria-label="Where it is">
      {#each crumbs as c, i (i)}
        {#if c.level === null}
          <span class="ph__crumb is-current" aria-current="page">{c.label}</span>
        {:else}
          <button type="button" class="ph__crumb" onclick={() => list(c.level)}>{c.label}</button>
        {/if}
      {/each}
    </nav>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // a column on the panel's 12px edges: the back button (its arrow on the edge), title, path
  .ph {
    @include stack(0);
    flex: none;
    padding: var(--space-3) var(--space-3) 0;
  }

  // text-style: no fill, no inline padding, muted until hovered; 32px tall (the list's ←)
  .ph__back {
    @include row(var(--space-2));
    align-self: start;
    height: var(--size-control);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
    font: inherit;
    font-size: var(--fs-sm);
    font-weight: 500;
    letter-spacing: 0.06em; // a button's label
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .ph__title {
    @include ellipsis;
    margin: 0;
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    line-height: 20px;
  }

  // one line: the parts shrink (ellipsis), the page's own last
  .ph__path {
    @include row(0);
    overflow: hidden;
    font-size: var(--fs-base);
    line-height: 20px;
  }

  // the page accent (the pages list's paths); a part's text on its left edge
  .ph__crumb {
    @include ellipsis;
    flex: 0 1 auto;
    min-width: 2ch;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-page-accent);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      @include focus-ring;
    }

    // the root "/": its own width (2ch would leave a gap after it), never shrunk
    &:first-child {
      flex: none;
      min-width: 0;
    }

    &.is-current {
      flex: none;
      color: var(--c-text-muted);
      cursor: default;
      text-decoration: none;
    }
  }
</style>
