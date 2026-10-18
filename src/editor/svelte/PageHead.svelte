<!--
  The page or site part being edited, over the Content and Motion tabs (the pages list's own
  header takes its place while it is open: PagesList.svelte, at the same height):
    [ ← ]  Title                         [ item ▾ ]
           / photography/ people/
  ← opens the pages list (in the Content tab) where the page was opened (its own folder, or
  the one it is in), a path part at that folder. A [param] page picks which of its item pages the preview shows on the right.
-->
<script>
  import Button from './Button.svelte';
  import Select from './Select.svelte';
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
    if (!id) return [{ label: 'Site', level: null }];
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
  <Button size="small" icon="arrow-left" iconOnly label="Pages" onclick={() => list()} />
  <div class="ph__main">
    <h2 class="ph__title">{title}</h2>
    <nav class="ph__path" aria-label="Where it is">
      {#each crumbs as c, i (i)}
        {#if c.level === null}
          <span class="ph__crumb is-current" aria-current="page">{c.label}</span>
        {:else}
          <button type="button" class="ph__crumb" onclick={() => list(c.level)}>{c.label}</button>
        {/if}
      {/each}
    </nav>
  </div>
  {#if t?.items?.length}
    <div class="ph__item">
      <Select
        aria-label="Item"
        value={ui.path}
        options={t.items.map((i) => ({ value: i.path, label: i.title }))}
        onchange={(path) => actions.pickTarget(t, path)}
      />
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the pages list's header, the same box: 16px edges, 48px tall
  .ph {
    @include row(var(--space-2));
    flex: none;
    min-height: 48px;
    padding: var(--space-4) var(--space-4) 0;
    box-sizing: content-box;
  }

  .ph__main {
    @include stack(0);
    flex: 1;
    min-width: 0;
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

  .ph__crumb {
    @include ellipsis;
    flex: 0 1 auto;
    min-width: 2ch;
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
      flex: none;
      color: var(--c-text-muted);
      cursor: default;
      text-decoration: none;
    }
  }

  .ph__item {
    flex: 0 1 45%;
    min-width: 0;
  }
</style>
