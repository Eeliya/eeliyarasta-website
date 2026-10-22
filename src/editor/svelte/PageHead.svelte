<!--
  The page or site part being edited, over the Content and Motion tabs (the pages list takes
  its place while it is open: PagesList.svelte; its ← on the same spot):
    ← Return to navigation
    Title
    / photography/ people/          (a site part: its title only)
    Preview noor-vermeer / 2018 ▾   (a [param] page: the page of it the preview shows)
    ⚠ No pages are built: …        (only when its main widget can't decide its pages)
  Return to navigation opens the pages list (in the Content tab) where the page was opened (its
  own folder, or the one it is in), a path part at that folder. The path's [param]/ parts and
  the Preview line's values are in the widget accent (a param and its value read as a pair).
  A [param] page previews the page of it shown last (ui.previewAt, main.js pickTarget), else its
  first; the Preview line opens the item selector (PreviewPicker.svelte) to pick another, every
  tab shows it. The warning line jumps to the main widget, on the param row that is wrong.
-->
<script>
  import { ui } from './ui.svelte.js';
  import PreviewPicker from './PreviewPicker.svelte';
  import { parentId, pathOfId } from '../../site/routes.js';
  import { crumbsOf, pageIds, titleOf } from '../lib/page-tree.js';
  import { isParam, pageFile, paramsOf } from '../../site/files.js';
  import { mainProblem } from '../../site/layout/source.js';

  // live: reactive store; actions: pickTarget, setMode (main.js)
  let { live, actions } = $props();

  // the store's files (live.svelte.js: one shared copy per change)
  const files = $derived(live.files);
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

  // ---- a [param] page: the page of it shown, and why it builds none
  const template = $derived(!!t?.template);
  const isParamCrumb = (c) => isParam(c.label.replace(/\/$/, ''));
  const route = $derived(template ? live.routeOf(ui.path) : null);
  const values = $derived(template ? paramsOf(id).map((p) => route?.params?.[p] ?? `[${p}]`) : []);
  const problem = $derived(template ? mainProblem(live.content, id) : null);
  let picker = $state();
  const entry = () => ui.pages.find((e) => e.template === id);
  /** The warning: the main widget open on its Content tab, its wrong param row focused. */
  function toMain() {
    const main = live.get(pageFile(id), '/main');
    if (ui.mode !== 'text') actions.setMode('text');
    ui.pagesWin = { ...ui.pagesWin, open: false };
    ui.section = null;
    const has = problem?.kind !== 'none';
    ui.widget = has ? main : null;
    ui.widgetTab = 'content';
    ui.focusParam = has ? { widget: main, param: problem?.param ?? '' } : null;
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
          <span
            class={['ph__crumb', 'is-current', isParamCrumb(c) && 'is-param']}
            aria-current="page">{c.label}</span
          >
        {:else}
          <button
            type="button"
            class={['ph__crumb', isParamCrumb(c) && 'is-param']}
            onclick={() => list(c.level)}>{c.label}</button
          >
        {/if}
      {/each}
    </nav>
  {/if}
  {#if template}
    <button
      type="button"
      class="ph__preview"
      title="The page every tab and the preview show: pick another"
      aria-haspopup="dialog"
      onclick={() => picker.open()}
    >
      <span class="ph__label">Preview</span>
      {#each values as v, i (i)}{#if i}<span class="ph__sep">/</span>{/if}<span class="ph__val"
          >{v}</span
        >{/each}
      <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
    </button>
    <PreviewPicker
      bind:this={picker}
      {live}
      {id}
      path={ui.path}
      onpick={(path) => actions.pickTarget(entry(), path)}
    />
  {/if}
  <!-- only in that state: the head grows by this line then (nothing is reserved for it) -->
  {#if problem}
    <p class="ph__warn" role="status">
      <button
        type="button"
        title={problem.kind === 'none' ? 'Show the sections' : 'Open the main widget'}
        onclick={toMain}
        ><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span
          >{problem.message}</span
        ></button
      >
    </p>
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

    // a [param]/ part, its slash too: the widget accent
    &.is-param {
      color: var(--c-widget-accent);
    }
  }

  // [ PREVIEW  noor-vermeer / 2018 ▾ ]: text-style, 24px, on the 12px edge
  .ph__preview {
    @include row(var(--space-2));
    align-self: start;
    max-width: 100%;
    height: 24px;
    margin-top: var(--space-1);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    cursor: pointer;

    &:hover .ph__val {
      text-decoration: underline;
    }

    &:focus-visible {
      @include focus-ring;
    }

    i {
      flex: none;
      color: var(--c-text-muted);
      font-size: var(--fs-2xs);
    }
  }

  .ph__label {
    @include muted;
    flex: none;
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ph__val {
    @include ellipsis;
    color: var(--c-widget-accent);
  }

  .ph__sep {
    color: var(--c-text-faint);
  }

  // the main widget's error: one 20px line in the warning colour; a click opens the widget
  .ph__warn {
    margin: var(--space-1) 0 0;

    button {
      @include row(var(--space-2));
      max-width: 100%;
      padding: 0;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--c-notice);
      font: inherit;
      font-size: var(--fs-sm);
      line-height: 20px;
      text-align: left;
      cursor: pointer;

      &:hover span {
        text-decoration: underline;
      }

      &:focus-visible {
        @include focus-ring;
      }
    }

    i {
      flex: none;
      font-size: var(--fs-2xs);
    }

    span {
      @include ellipsis;
    }
  }
</style>
