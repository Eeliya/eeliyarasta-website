<!--
  Motion tab, Animations: the animations in content/settings/animations.json ("presets"
  there), inline in the panel so the preview stays in view while editing. It starts on the
  list of animations, each with its type and how many elements use it; click one to edit its
  own values, Back returns to the list. The only place that defines what an animation does
  (its properties, added and removed here); an element or its data-anim name can only set its
  own timing (TIMING_KEYS). Edits show in the preview at once; Replay plays them again.
  The animation shown is ui.library.name ('' = the list), kept by persist.js.
-->
<script>
  import { tick } from 'svelte';
  import MotionGroups from './MotionGroups.svelte';
  import { ui } from './ui.svelte.js';
  import { animationOf, layerPtr, presetModel } from './motion.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // cfg: animations.json as edited; items: the page's animated elements; gsap: the preview's
  let { live, bridge, cfg, items, gsap } = $props();

  let root = $state();
  const names = $derived(Object.keys(cfg.presets));
  // an unknown name (renamed, or from an old URL): the list
  const name = $derived(names.includes(ui.library.name) ? ui.library.name : '');
  const m = $derived(name && presetModel(cfg, name));

  // Who uses an animation: elements on this page, and data-anim names anywhere on the site
  // (targets in animations.json; how many elements each has on other pages isn't known here).
  const onPage = (n) => items.filter((it) => animationOf(cfg, it) === n);
  const targets = (n) => Object.keys(cfg.targets).filter((t) => cfg.targets[t].preset === n);
  const count = (n, what) => `${n} ${what}${n === 1 ? '' : 's'}`;
  const uses = $derived(name ? onPage(name) : []);

  /** Enter an animation ('' = back to the list); back on the list, focus the one left. */
  async function goTo(next) {
    const from = name;
    ui.library.name = next;
    await tick();
    const back = from && root.querySelector(`[data-name="${CSS.escape(from)}"]`);
    (back || root.querySelector('.lib__btn, .lib__item'))?.focus();
  }

  /** Play the page's animations again, with the first element using this one in view. */
  const replay = () => bridge.replay(uses[0]?.el);
</script>

<div class="lib" bind:this={root}>
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
    <h3 class="lib__title">{name || 'Animations'}</h3>
    <span class="lib__path">content/settings/animations.json</span>
  </header>

  {#if !name}
    <ul class="list" aria-label="Animations">
      {#each names as n (n)}
        <li>
          <button type="button" class="lib__item" data-name={n} onclick={() => goTo(n)}>
            <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
            <span>{n}</span>
            <span class="lib__meta">
              {cfg.presets[n].type} &middot; {count(onPage(n).length, 'element')} on this page &middot;
              {count(targets(n).length, 'data-anim name')}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="lib__info">
      <p class="hint">
        Type {m.type}. Used by {count(uses.length, 'element')} on this page and by
        {targets(name).join(', ') || 'no data-anim name'} on the site. Elements and names can set their
        own timing only.
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
  {/if}
</div>

<style lang="scss">
  // Back | name | file
  .lib__head {
    display: grid;
    align-items: center;
    grid-template-columns: min-content 1fr;
    grid-template-areas:
      'button title'
      '. path';
    gap: 4px 8px;
    margin-bottom: 12px;
  }

  .lib__title {
    grid-area: title;
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  .lib__path {
    grid-area: path;
    color: var(--muted);
    font-size: 10.5px;
  }

  .lib__btn {
    grid-area: button;
    width: 24px;
    height: 24px;
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
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }
  }

  // icon | name / type and usage
  .lib__item {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 4px 12px;
    padding: 8px 12px;
    line-height: 16px; // name + two meta lines: 68px
    border: 0;
    border-radius: 12px;
    background: rgb(255 255 255 / 0.03);
    box-shadow: inset 0 0 0 1px var(--line);
    text-align: left;
    cursor: pointer;
    color: var(--fg);

    i {
      grid-row: 1 / 3;
      color: var(--muted);
    }

    &:hover {
      background: rgb(255 255 255 / 0.08);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--ed-accent);
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
