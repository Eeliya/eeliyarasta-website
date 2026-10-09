<!--
  Animations library: the animations in content/settings/animations.json ("presets" there),
  like the Source Explorer for content/sources/. It starts on the list of animations, each
  with its type and how many elements use it; click one to edit its own values, Back returns
  to the list. The only place that defines what an animation does (its properties, added and
  removed here); an element or its data-anim name can only set its own timing (TIMING_KEYS). MotionPanel.svelte calls open() from its Animations button (the list)
  and from an element's Animation edit button (straight into that animation).
  Where it is lives in ui.library, so persist.js can bring it back after a refresh.
-->
<script>
  import { tick, flushSync } from 'svelte';
  import MotionGroups from './MotionGroups.svelte';
  import { ui } from './ui.svelte.js';
  import { animationOf, layerPtr, presetModel } from './motion.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // cfg: animations.json as edited; items: the page's animated elements; gsap: the preview's
  let { live, bridge, cfg, items, gsap } = $props();

  let dialog = $state();
  const name = $derived(ui.library.name); // '' = the list of animations
  const names = $derived(Object.keys(cfg.presets));
  const m = $derived(name && presetModel(cfg, name));

  // Who uses an animation: elements on this page, and data-anim names anywhere on the site
  // (targets in animations.json; how many elements each has on other pages isn't known here).
  const onPage = (n) => items.filter((it) => animationOf(cfg, it) === n);
  const targets = (n) => Object.keys(cfg.targets).filter((t) => cfg.targets[t].preset === n);
  const count = (n, what) => `${n} ${what}${n === 1 ? '' : 's'}`;
  const uses = $derived(name ? onPage(name) : []);

  /** Enter an animation ('' = back to the list), keeping the keyboard focus in the modal. */
  async function goTo(next) {
    const from = name;
    ui.library.name = next;
    await tick();
    const back = from && dialog.querySelector(`[data-name="${CSS.escape(from)}"]`);
    (back || dialog.querySelector('.lib__item'))?.focus();
  }

  /** Open on the list of animations, or straight into animation `next`. */
  export function open(next = '') {
    ui.library.name = names.includes(next) ? next : '';
    flushSync(); // render now, so the focus below finds its element
    if (!dialog.open) dialog.showModal();
    ui.library.open = true;
    if (!ui.library.name) dialog.querySelector('.lib__item')?.focus();
  }

  /** Play the page's animations again, with the first element using this one in view. */
  const replay = () => bridge.replay(uses[0]?.el);

  // Open again after a refresh (persist.js).
  $effect(() => {
    const { open: wanted, name: at } = ui.library;
    // (after a tick: open() renders at once, which an effect may not do)
    if (wanted && !dialog.open) tick().then(() => open(at));
  });
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="modal__box lib"
  aria-label="Animations"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && dialog.close()}
  onclose={() => (ui.library.open = false)}
>
  <header class="lib__head">
    {#if name}
      <button
        type="button"
        class="lib__btn"
        title="Back to the animations"
        aria-label="Back to the animations"
        onclick={() => goTo('')}
      >
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
      </button>
    {/if}
    <h3 class="modal__title">{name || 'Animations'}</h3>
    <span class="lib__path">
      <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
      content/settings/animations.json
    </span>
    <button
      type="button"
      class="lib__btn"
      title="Close (Esc)"
      aria-label="Close"
      onclick={() => dialog.close()}
    >
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  </header>

  {#if !name}
    <ul class="list lib__list" aria-label="Animations">
      {#each names as n (n)}
        <li>
          <button type="button" class="lib__item" data-name={n} onclick={() => goTo(n)}>
            <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
            <span class="lib__name">{n}</span>
            <span class="lib__meta">
              {cfg.presets[n].type} &middot; {count(onPage(n).length, 'element')} on this page &middot;
              {count(targets(n).length, 'data-anim name')}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <section class="lib__body">
      <div class="lib__info">
        <p class="hint">
          Type {m.type}. Used by {count(uses.length, 'element')} on this page and by
          {targets(name).join(', ') || 'no data-anim name'} on the site. Elements and names can set their
          own timing only; badges: <b>default</b> = this animation, <b>global</b> = every animation.
        </p>
        <button
          type="button"
          class="btn-ed"
          title="Play the page's animations again"
          disabled={!uses.length}
          onclick={replay}
        >
          <i class="fa-solid fa-play" aria-hidden="true"></i> Replay
        </button>
      </div>
      {#key name}
        <MotionGroups
          {live}
          {gsap}
          {m}
          scope="preset"
          ptr={layerPtr(m, null, 'preset')}
          key="library"
        />
      {/key}
    </section>
  {/if}
</dialog>

<style lang="scss">
  // a <dialog> like the Source Explorer: header, then the list or one animation's fields
  dialog.lib {
    width: min(720px, 92vw);
    height: calc(100vh - 64px);
    max-height: 900px;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }
  }

  .lib__head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--line);

    .modal__title {
      margin: 0;
    }
  }

  .lib__path {
    margin-right: auto;
    color: var(--muted);
    font-size: 10.5px;
  }

  // Back and Close
  .lib__btn {
    align-self: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 14px;
    cursor: pointer;

    &:hover {
      color: var(--fg);
      background: rgb(255 255 255 / 0.06);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--hi);
    }
  }

  .lib__list,
  .lib__body {
    overflow: auto;
    padding: 16px 24px 24px;
  }

  .lib__list {
    align-content: start;
    gap: 4px;
    padding-inline: 12px;
  }

  // icon | name / type and usage
  .lib__item {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 4px 12px;
    padding: 8px 12px;
    border: 0;
    border-radius: 12px;
    background: none;
    text-align: left;
    cursor: pointer;
    color: var(--fg);

    i {
      grid-row: 1 / 3;
      color: var(--muted);
    }

    &:hover {
      background: rgb(255 255 255 / 0.05);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--hi);
    }
  }

  .lib__meta {
    color: var(--muted);
    font-size: 10.5px;
  }

  .lib__info {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 8px;

    .hint {
      flex: 1;
      margin: 0;
    }
  }
</style>
