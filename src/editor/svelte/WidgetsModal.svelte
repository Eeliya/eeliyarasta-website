<!--
  Add widget: a modal of the widget types, a tile each (a sketch of the widget, its icon, name and
  one line, all from the registry). A search filters them; the pointer or the arrow keys pick
  one (a 2px accent ring: nothing moves), Enter or a click adds it, Esc or the backdrop closes.
  Opened by a section's dashed Add widget button (SectionsList.svelte), which appends the widget
  to that section and opens it.
    types   [{ value, label, icon, line, sketch }] the widget types on offer (the registry's)
    onpick  (type, at) => …   at: the section index open() was given
-->
<script module>
  const COLS = 5;
</script>

<script>
  import { closeOnBackdrop } from '../lib/dialog.js';
  import { flushSync, tick } from 'svelte';
  import Button from './Button.svelte';
  import ExplorerHead from './ExplorerHead.svelte';

  let { types, onpick } = $props();

  let dialog = $state();
  let query = $state('');
  let active = $state(0);
  let at = $state(0); // the section the widget goes to

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return types;
    return types.filter((t) => `${t.label} ${t.line || ''}`.toLowerCase().includes(q));
  });

  /** Open it for section `section` (its index). */
  export function open(section) {
    at = section;
    query = '';
    active = 0;
    flushSync();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.as-search')?.focus();
  }

  function pick(t) {
    dialog.close();
    onpick(t.value, at);
  }

  async function focusTile() {
    await tick();
    dialog.querySelectorAll('.as-tile')[active]?.focus();
  }

  function onkeydown(e) {
    const n = shown.length;
    if (!n) return;
    const inSearch = e.target.classList?.contains('as-search');
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (step) {
      if (inSearch && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // the caret
      e.preventDefault();
      if (inSearch && e.key === 'ArrowUp') return;
      const next = inSearch ? active : active + step;
      if (next < 0 || next >= n) {
        if (e.key === 'ArrowUp') dialog.querySelector('.as-search')?.focus();
        return;
      }
      active = next;
      focusTile();
    } else if (e.key === 'Enter' && inSearch) {
      e.preventDefault();
      pick(shown[Math.min(active, n - 1)]);
    }
  }
</script>

<!-- a widget's sketch: grey shapes, 2:1 -->
{#snippet sketch(type)}
  <span class="as-sk as-sk--{type}" aria-hidden="true">
    {#if type === 'text'}<b class="w40 h4"></b><b class="w70 h12"></b><b class="w90 h4"></b><b
        class="w60 h4"
      ></b>
    {:else if type === 'photo'}<b class="img"></b><b class="w40 h4"></b>
    {:else if type === 'button'}<b class="pill"></b>
    {:else if type === 'form'}<b class="w90 h8 box"></b><b class="w90 h8 box"></b><b
        class="w90 h16 box"
      ></b>
    {:else if type === 'hero'}<b class="sc s1"></b><b class="sc s2"></b><b class="sc s3"></b><b
        class="w70 h12 mid"
      ></b>
    {:else if type === 'grid'}<span class="g g3"
        >{#each Array(6) as _, i (i)}<b></b>{/each}</span
      >
    {:else if type === 'albums'}<span class="g g3"
        >{#each Array(3) as _, i (i)}<b></b>{/each}</span
      >
    {:else if type === 'panels'}<span class="g g2"
        >{#each Array(2) as _, i (i)}<b></b>{/each}</span
      >
    {:else if type === 'projects'}{#each Array(4) as _, i (i)}<b class="w90 h8"></b>{/each}
    {:else if type === 'about'}<span class="bio"
        ><b class="img"></b><span
          ><b class="w90 h8"></b><b class="w80 h4"></b><b class="w60 h4"></b></span
        ></span
      >
    {:else}<b class="w70 h8"></b><b class="w50 h4"></b>
    {/if}
  </span>
{/snippet}

<dialog
  class="modal__box as-modal"
  aria-label="Add widget to section {at + 1}"
  bind:this={dialog}
  {@attach closeOnBackdrop}
  {onkeydown}
>
  <ExplorerHead
    title="Add widget to Section {at + 1}"
    icon="fa-plus"
    crumbs={[{ label: 'after its last widget' }]}
    onclose={() => dialog.close()}
  />
  <div class="as-body">
    <input
      class="tf__input as-search"
      type="search"
      placeholder="Search widgets"
      aria-label="Search widgets"
      bind:value={query}
      oninput={() => (active = 0)}
    />
    {#if shown.length}
      <ul class="as-tiles" role="listbox" aria-label="Widget types">
        {#each shown as t, i (t.value)}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              class={['as-tile', i === active && 'is-active']}
              tabindex={i === active ? 0 : -1}
              onpointerenter={() => (active = i)}
              onfocus={() => (active = i)}
              onclick={() => pick(t)}
            >
              {@render sketch(t.sketch)}
              <span class="as-tile__name"
                ><i class="fa-solid fa-{t.icon}" aria-hidden="true"></i>{t.label}</span
              >
              <span class="as-tile__line">{t.line || ''}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint">No widget matches “{query}”.</p>
    {/if}
  </div>
  <footer class="as-foot">
    <span class="hint small">Click or Enter adds it to Section {at + 1} · arrows pick</span>
    <Button size="small" onclick={() => dialog.close()}>Cancel</Button>
  </footer>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  dialog.as-modal {
    width: min(1000px, 92vw);
    height: min(760px, calc(100vh - 48px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }
  }

  .as-body {
    @include stack(var(--space-3));
    align-content: start;
    padding: var(--space-4);
    overflow: auto;
  }

  .as-search {
    height: 32px;
  }

  .as-foot {
    @include row(var(--space-3));
    justify-content: space-between;
    height: 56px;
    padding: 0 var(--space-4);
    border-top: 1px solid var(--c-line);

    .hint {
      margin: 0;
    }
  }

  .as-tiles {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // the picked one: a ring (a shadow), so nothing moves or grows
  .as-tile {
    @include stack(var(--space-1));
    width: 100%;
    padding: var(--space-2) var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--c-control);
    box-shadow: inset 0 0 0 1px var(--c-line);
    color: var(--c-text);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &.is-active {
      box-shadow: 0 0 0 2px var(--c-accent);
    }

    &:focus-visible {
      outline: none;
    }
  }

  .as-tile__name {
    @include row(var(--space-2));
    margin-top: var(--space-1);
    font-weight: 500;

    i {
      width: 16px;
      color: var(--c-accent);
      text-align: center;
    }
  }

  .as-tile__line {
    min-height: 32px;
    @include muted;
    line-height: 16px;
  }

  .as-sk {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    aspect-ratio: 2 / 1;
    padding: 8px 12px;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--c-surface);

    b {
      display: block;
      border-radius: 1px;
      background: var(--c-fill-active);
    }

    .w40 {
      width: 40%;
    }
    .w50 {
      width: 50%;
    }
    .w60 {
      width: 60%;
    }
    .w70 {
      width: 70%;
    }
    .w80 {
      width: 80%;
    }
    .w90 {
      width: 90%;
    }
    .h4 {
      height: 4px;
    }
    .h8 {
      height: 8px;
    }
    .h12 {
      height: 12px;
    }
    .h16 {
      height: 16px;
    }

    .img {
      flex: 1;
      width: 100%;
    }

    .box {
      background: none;
      box-shadow: inset 0 0 0 1px var(--c-fill-active);
    }

    .pill {
      align-self: center;
      width: 40%;
      height: 16px;
      border-radius: 999px;
    }

    .g {
      @include stack(4px);
      height: 100%;

      b {
        height: 100%;
      }
    }

    .g3 {
      grid-template-columns: repeat(3, 1fr);
    }
    .g2 {
      grid-template-columns: 1fr 1fr;
    }

    .sc {
      position: absolute;
      width: 16%;
      aspect-ratio: 3 / 4;
    }

    .s1 {
      top: 12%;
      left: 8%;
    }
    .s2 {
      top: 8%;
      right: 10%;
    }
    .s3 {
      bottom: 8%;
      left: 40%;
    }

    .mid {
      position: relative;
      align-self: center;
      background: var(--c-text-faint);
    }

    .bio {
      display: grid;
      grid-template-columns: 1fr 1.6fr;
      gap: 8px;
      height: 100%;

      span {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
      }
    }
  }

  .as-sk--grid,
  .as-sk--albums,
  .as-sk--panels {
    padding: 8px;
  }
</style>
