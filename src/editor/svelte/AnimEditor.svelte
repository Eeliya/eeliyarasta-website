<!--
  Motion tab, one animated element (ui.anim, picked in the preview or in the Elements list):
  replay and scroll it, pick where edits go (this element, or every element with its
  data-anim name), its animation, and its timing (a Custom switch per field, MotionGroups).
  What the animation does is shown read-only: it is edited in the Animations sub-tab
  (AnimLibrary.svelte). Older overrides of those values get a notice: move them into the
  animation, or drop them.
  (In code and animations.json an animation is a "preset".)
  MotionPanel creates a new one for every pick.
-->
<script>
  import MotionGroups from './MotionGroups.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { GENERIC_TYPES, animModel, keepFor, layerPtr, legacyOverrides } from './motion.js';
  import { compile } from '../lib/pointer.js';
  import { ANIMATIONS } from '../../site/files.js';

  // cfg: animations.json as edited; items: the page's animated elements; gsap: the preview's;
  // onlibrary(name): open the Animations sub-tab at that animation
  let { live, bridge, cfg, items, gsap, onlibrary } = $props();

  const sel = ui.anim; // { el, id, key, scope }
  const m = $derived(animModel(cfg, sel));
  const sameTarget = $derived(items.filter((x) => x.id === sel.id).length);
  const scopes = $derived([
    ['element', 'This element', `Only this element on ${sel.key.split('|')[0]}`],
    [
      'target',
      'All',
      `Every data-anim="${sel.id}" element on the site (${sameTarget} on this page)`,
    ],
  ]);
  const presets = $derived(
    Object.entries(cfg.presets).filter(
      ([name, p]) => GENERIC_TYPES.has(p.type) || name === m.presetName,
    ),
  );
  const hasOverrides = $derived(Object.keys(m.own).length > 0);
  const legacy = $derived(legacyOverrides(m));

  // Scroll position of the element in the preview, 0-100 (read once, when it is picked).
  const scrolled = () => Math.round(bridge.scrubProgress(sel.el) * 100);
  let progress = $state(scrolled());

  const ptr = () => layerPtr(m, sel, sel.scope);
  const removePreset = () =>
    live.store.remove(ANIMATIONS, `${ptr()}/preset`, { keep: 1, source: 'motion-structure' });
  function setPreset(name) {
    if (sel.scope === 'element' && name === m.target.preset) removePreset();
    else
      live.store.set(ANIMATIONS, `${ptr()}/preset`, name, {
        keep: keepFor(sel.scope),
        source: 'motion-structure',
      });
  }

  /** Remove the older non-timing overrides; with move, copy them into the animation first. */
  function settleLegacy(move) {
    const list = legacy;
    live.store.batch(
      () => {
        for (const o of list) {
          const path = compile(o.path);
          if (move)
            live.store.set(ANIMATIONS, layerPtr(m, sel, 'preset') + path, o.value, { keep: 2 });
          live.store.remove(ANIMATIONS, layerPtr(m, sel, o.scope) + path, {
            keep: keepFor(o.scope),
          });
        }
      },
      { source: 'motion-structure' },
    );
  }
</script>

<div class="msel__head">
  <button type="button" class="link" onclick={() => bridge.select(null)}>
    <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Elements
  </button>
  <h3 class="msel__title">{sel.id}</h3>
  <code class="msel__key" title="Stable element key used for element overrides">{sel.key}</code>
</div>

<div class="msel__actions">
  <button type="button" class="btn-ed" onclick={() => bridge.replay(sel.el)}>
    <i class="fa-solid fa-play" aria-hidden="true"></i> Replay
  </button>
  <label
    class="scrub"
    title="Scroll the page through this element (0% = entering at the bottom, 100% = leaving at the top)"
  >
    <span class="scrub__label">Scroll</span>
    <input
      type="range"
      min="0"
      max="100"
      step="0.5"
      class="scrub__range"
      bind:value={progress}
      oninput={() => bridge.scrubTo(sel.el, progress / 100)}
    />
    <span class="scrub__val">{Math.round(progress)}%</span>
  </label>
</div>

<div class="scope">
  <div class="seg">
    {#each scopes as [s, label, title] (s)}
      <button
        type="button"
        class={['seg__btn', s === sel.scope && 'is-active']}
        {title}
        onclick={() => (sel.scope = s)}
        >{label}
        {#if s === 'target'}<span class="scope__id">“{sel.id}”</span>{/if}</button
      >
    {/each}
  </div>
  <p class="hint">Edits apply to: {scopes.find((s) => s[0] === sel.scope)[2]}.</p>
</div>

<div class="f">
  <div class="f__top">
    <span class="f__label">Animation</span>
    <span class="f__src" data-src={m.own.preset ? 'element' : 'target'}
      >{m.own.preset ? 'element' : 'all'}</span
    >
    {#if sel.scope === 'element' && m.own.preset}
      <button
        type="button"
        class="f__reset"
        title="Use the animation of all &quot;{sel.id}&quot;"
        onclick={removePreset}
      >
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
    {/if}
    <!-- like a grid's Source edit button: the animation's own values, in the library -->
    <button
      type="button"
      class="btn-sm btn-sm--compact"
      title="Edit {m.presetName} in Animations"
      aria-label="Edit {m.presetName} in Animations"
      onclick={() => onlibrary(m.presetName)}
    >
      <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
    </button>
  </div>
  <Select
    aria-label="Animation"
    value={m.presetName}
    options={presets.map(([name, p]) => ({ value: name, label: name, hint: p.type }))}
    onchange={setPreset}
  />
</div>
{#if legacy.length}
  <div class="legacy">
    <p class="hint">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      Older overrides of what the animation does, which only the animation sets now:
    </p>
    <ul class="legacy__list">
      {#each legacy as o (o.scope + o.path.join('.'))}
        <li>
          <code>{o.path.join('.')}: {JSON.stringify(o.value)}</code>
          <span class="legacy__scope"
            >{o.scope === 'element' ? 'this element' : `all "${sel.id}"`}</span
          >
        </li>
      {/each}
    </ul>
    <p class="hint">
      Move to animation copies them into {m.presetName}: every element using it changes.
    </p>
    <div class="legacy__actions">
      <button type="button" class="btn-sm" onclick={() => settleLegacy(true)}>
        <i class="fa-solid fa-arrow-up" aria-hidden="true"></i> Move to animation
      </button>
      <button type="button" class="btn-sm btn-sm--danger" onclick={() => settleLegacy(false)}>
        <i class="fa-solid fa-trash" aria-hidden="true"></i> Drop
      </button>
    </div>
  </div>
{/if}
<MotionGroups {live} {gsap} {m} scope={sel.scope} ptr={ptr()} />
{#if hasOverrides}
  <button
    type="button"
    class="link link--danger"
    onclick={() =>
      live.store.remove(ANIMATIONS, `/elements${compile([sel.key])}`, {
        keep: 1,
        source: 'motion-structure',
      })}>Remove all overrides of this element</button
  >
{/if}

<style lang="scss">
  .msel__head {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    justify-items: start;
  }

  .msel__title {
    margin: 8px 0 0;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: 26px;
    line-height: 1;
  }

  .msel__key {
    color: var(--faint);
    font-size: 10.5px;
    word-break: break-all;
  }

  .msel__actions {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .scrub {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }

  .scrub__label {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .scrub__val {
    width: 36px;
    text-align: right;
    color: var(--fg);
  }

  // older non-timing overrides: what they are, Move to animation / Drop
  .legacy {
    margin-bottom: 16px;
    padding: 12px;
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--line);

    .hint {
      font-size: 11px;
      margin: 0 0 8px;
    }
  }

  .legacy__list {
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .legacy__scope {
    color: var(--muted);
    font-size: 10.5px;
  }

  .legacy__actions {
    display: flex;
    gap: 8px;
  }

  .scope {
    margin-bottom: 16px;

    // the data-anim name as written in the HTML (the tab's other text is uppercase)
    &__id {
      text-transform: none;
    }

    .seg {
      margin-bottom: 8px;
    }

    .hint {
      font-size: 11px;
      margin: 0;
    }
  }
</style>
