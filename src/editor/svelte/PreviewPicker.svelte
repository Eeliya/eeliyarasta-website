<!--
  The item selector of a [param] page's Preview line (PageHead.svelte): which of its pages the
  preview, and every tab with it, shows. One step per param of its address, in order
  ([person], then [year]): each lists the values its pages have, only those under the ones
  picked before it (a nested page's [year] step: that person's years). A step with none says
  why (Nothing found, and its reason). The crumbs and Back go back a step; the last step's pick
  shows that page (onpick(path)). Remembered per page by main.js (ui.previewAt), never saved.
    live   reactive store (its routes, unbuilt ones included: live.svelte.js)
    id     the [param] page ("photography/people/[person]/[year]")
    path   the path the preview shows (its row selected)
-->
<script>
  import { closeOnBackdrop } from '../lib/dialog.js';
  import { tick } from 'svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import { plural } from '../lib/format.js';
  import { isParam, paramsOf } from '../../site/files.js';
  import { mainProblem } from '../../site/layout/source.js';

  let { live, id, path = '', onpick } = $props();

  let dialog = $state();
  let picks = $state([]); // the values picked in the steps before this one
  let query = $state('');

  const params = $derived(paramsOf(id));
  // the [param] page of each step: "people/[person]", then "people/[person]/[year]"
  const levels = $derived.by(() => {
    const parts = id.split('/');
    return parts.flatMap((s, i) => (isParam(s) ? [parts.slice(0, i + 1).join('/')] : []));
  });
  const step = $derived(Math.min(picks.length, params.length - 1));
  const param = $derived(params[step]);
  const last = $derived(step === params.length - 1);
  const shown = $derived(live.routeOf(path));

  // the pages of this step's level, under the values picked before it; one row per value
  const under = (r) => params.slice(0, step).every((p, i) => r.params?.[p] === picks[i]);
  const all = $derived(live.routes.filter((r) => r.id === levels[step] && r.params?.[param]));
  const rows = $derived.by(() => {
    const mine = all.filter(under);
    const first = mine.filter(
      (r, i) => mine.findIndex((o) => o.params[param] === r.params[param]) === i,
    );
    const q = query.trim().toLowerCase();
    return first.filter(
      (r) => !q || r.params[param].includes(q) || String(r.name).toLowerCase().includes(q),
    );
  });
  const total = $derived(new Set(all.map((r) => r.params[param])).size);
  const found = $derived(new Set(all.filter(under).map((r) => r.params[param])).size);
  // nothing in this step: why
  const why = $derived.by(() => {
    const problem = mainProblem(live.content, levels[step]);
    if (problem) return problem.message;
    if (query.trim()) return 'Nothing matches the search.';
    if (step) return `No [${param}] for ${picks.at(-1)}: no item of its source matches it.`;
    return 'Its source has no items for it yet.';
  });

  const isShown = (r) =>
    !!shown?.params && params.slice(0, step + 1).every((p) => shown.params[p] === r.params[p]);

  async function focus() {
    await tick();
    (dialog.querySelector('.xrow.is-selected') || dialog.querySelector('.pp-search'))?.focus();
  }
  /** Open on its first step. */
  export function open() {
    picks = [];
    query = '';
    if (!dialog.open) dialog.showModal();
    focus();
  }
  function back(to = step - 1) {
    picks = picks.slice(0, Math.max(0, to));
    query = '';
    focus();
  }
  function pick(r) {
    if (!last) {
      picks = [...picks, r.params[param]];
      query = '';
      return focus();
    }
    dialog.close();
    onpick(r.path);
  }
</script>

<dialog
  class="modal__box pp-modal"
  aria-label="Preview item"
  bind:this={dialog}
  {@attach closeOnBackdrop}
>
  <ExplorerHead
    title="Preview item"
    icon="fa-database"
    crumbs={[
      ...picks.slice(0, step).map((v, i) => ({
        label: `[${params[i]}] ${v}`,
        onclick: () => back(i),
      })),
      { label: `[${param}]` },
    ]}
    sep="/"
    back={step ? 'Back a step' : ''}
    onback={() => back()}
    onclose={() => dialog.close()}
  />
  <div class="pp-body">
    <input
      class="tf__input pp-search"
      type="search"
      placeholder="Search items"
      aria-label="Search"
      bind:value={query}
    />
    {#if step}
      <p class="hint small pp-hint">
        <i class="fa-solid fa-filter" aria-hidden="true"></i>
        Only under [{params[step - 1]}] {picks[step - 1]} · {found} of {total}
      </p>
    {/if}
    <div class="pp-list">
      {#each rows as r, i (r.path)}
        <ExplorerRow
          lead={String(i + 1).padStart(2, '0')}
          name={r.params[param]}
          meta={last
            ? `${r.name} · ${plural(r.count ?? 0, 'item')}${r.unbuilt ? ' · not built' : ''}`
            : plural(r.count ?? 0, 'item')}
          selected={isShown(r)}
          enter={!last}
          onclick={() => pick(r)}
        />
      {:else}
        <p class="pp-none">
          <strong>Nothing found</strong>
          <span>{why}</span>
        </p>
      {/each}
    </div>
  </div>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  dialog.pp-modal {
    width: min(420px, 92vw);
    max-height: min(560px, calc(100vh - 64px));
    padding: 0;
    overflow: hidden;

    &[open] {
      display: flex;
      flex-direction: column;
    }
  }

  .pp-body {
    @include stack(var(--space-3));
    min-height: 0;
    padding: var(--space-4) var(--space-3);
  }

  .pp-search {
    box-sizing: border-box;
    width: 100%;
    height: var(--size-control);
  }

  // filtered by the step before: the param colour
  .pp-hint {
    @include row(var(--space-1));
    margin: 0;
    color: var(--c-block-accent);

    i {
      font-size: var(--fs-2xs);
    }
  }

  .pp-list {
    @include stack(var(--space-1));
    overflow: auto;
  }

  .pp-none {
    @include stack(var(--space-1));
    @include muted;
    margin: 0;
    padding: var(--space-2);
    font-size: var(--fs-sm);

    strong {
      color: var(--c-text);
      font-weight: 500;
    }
  }
</style>
