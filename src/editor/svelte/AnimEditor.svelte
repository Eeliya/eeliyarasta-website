<!--
  Motion tab, one animated element (ui.anim, picked in the preview or in the list): replay
  and scroll it, pick where edits go (this element, every element of its target, or the
  preset), its preset and the fields of the preset's type (motion.js).
  MotionPanel creates a new one for every pick.
-->
<script>
  import MotionField from './MotionField.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import {
    GENERIC_TYPES,
    GROUPS,
    PROPS,
    TIMING,
    animModel,
    dig,
    keepFor,
    layerPtr,
    missingProps,
    propFields,
    sourceOf,
  } from './motion.js';
  import { compile } from '../lib/pointer.js';
  import { ANIMATIONS } from '../../site/files.js';

  // cfg: animations.json as edited; items: the page's animated elements; gsap: the preview's
  let { live, bridge, cfg, items, gsap } = $props();

  const sel = ui.anim; // { el, id, key, scope }
  const m = $derived(animModel(cfg, sel));
  const sameTarget = $derived(items.filter((x) => x.id === sel.id).length);
  const usage = $derived(
    Object.values(cfg.targets).filter((t) => t.preset === m.presetName).length,
  );
  const scopes = $derived([
    ['element', 'This element', `Only this element on ${sel.key.split('|')[0]}`],
    [
      'target',
      `All “${sel.id}”`,
      `Every data-anim="${sel.id}" element on the site (${sameTarget} on this page)`,
    ],
    [
      'preset',
      `Preset “${m.presetName}”`,
      `The preset itself: used by ${usage} target${usage === 1 ? '' : 's'}`,
    ],
  ]);
  const presets = $derived(
    Object.entries(cfg.presets).filter(
      ([name, p]) => GENERIC_TYPES.has(p.type) || name === m.presetName,
    ),
  );
  // [title, fields, 'from' | 'to' | null]; from/to groups can also add properties.
  const groups = $derived(
    (GROUPS[m.type] || [TIMING])
      .map((g) => {
        if (g === 'from' || g === 'to')
          return m.spec[g]
            ? [g === 'from' ? 'From (start state)' : 'To (end state)', propFields(g, m.spec[g]), g]
            : null;
        const [title, defs] = g;
        return [title, defs.filter((d) => !d.when || d.when(m.spec)), null];
      })
      .filter((g) => g && (g[1].length || g[2])),
  );
  const hasOverrides = $derived(Object.keys(m.own).length > 0);

  // Scroll position of the element in the preview, 0-100 (read once, when it is picked).
  const scrolled = () => Math.round(bridge.scrubProgress(sel.el) * 100);
  let progress = $state(scrolled());

  const ptr = () => layerPtr(m, sel, sel.scope);
  function setValue(path, value) {
    live.store.set(ANIMATIONS, ptr() + compile(path), value, {
      key: `anim:${sel.scope}:${sel.key}:${path.join('.')}`,
      keep: keepFor(sel.scope),
      source: 'motion',
    });
  }
  const resetValue = (path) =>
    live.store.remove(ANIMATIONS, ptr() + compile(path), {
      keep: keepFor(sel.scope),
      source: 'motion',
    });
  const metaOf = (path) => ({
    source: sourceOf(m, path),
    canReset: dig(m.layers[sel.scope], path) !== undefined,
  });

  // A pair field (duration + ease) has two paths.
  const valueFor = (def) =>
    def.paths ? def.paths.map((p) => dig(m.spec, p)) : dig(m.spec, def.path);
  const metaFor = (def) => (def.paths ? def.paths.map(metaOf) : metaOf(def.path));
  function reset(def) {
    if (!def.paths) return resetValue(def.path);
    live.store.batch(() => def.paths.forEach(resetValue), { source: 'motion' });
  }

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

  /** Add a property to from / to; the other side gets its matching value, or GSAP would only set it. */
  function addProp(which, prop) {
    const other = which === 'from' ? 'to' : 'from';
    const { init, neutral } = PROPS[prop];
    live.store.batch(
      () => {
        setValue([which, prop], which === 'from' ? init : neutral);
        if (dig(m.spec, [other, prop]) === undefined)
          setValue([other, prop], which === 'from' ? neutral : init);
      },
      { source: 'motion-structure' },
    );
  }
</script>

<div class="msel__head">
  <button type="button" class="link" onclick={() => bridge.select(null)}>
    <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> All animations
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
        onclick={() => (sel.scope = s)}>{label}</button
      >
    {/each}
  </div>
  <p class="hint">Edits apply to: {scopes.find((s) => s[0] === sel.scope)[2]}.</p>
</div>

{#if sel.scope === 'preset'}
  <p class="hint">
    Type: {m.type}. Changing values here affects every target that uses “{m.presetName}”.
  </p>
{:else}
  <div class="f">
    <div class="f__top">
      <span class="f__label">Preset</span>
      <span class="f__src" data-src={m.own.preset ? 'element' : 'target'}
        >{m.own.preset ? 'element' : 'target'}</span
      >
      {#if sel.scope === 'element' && m.own.preset}
        <button type="button" class="f__reset" title="Use the target preset" onclick={removePreset}>
          <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
    <select
      class="f__select"
      aria-label="Preset"
      value={m.presetName}
      onchange={(e) => setPreset(e.currentTarget.value)}
    >
      {#each presets as [name, p] (name)}
        <option value={name}>{name} ({p.type})</option>
      {/each}
    </select>
  </div>
{/if}

{#each groups as [title, defs, props] (title)}
  <Section key="motion:{title}" {title}>
    {#each defs as def (def.label)}
      <MotionField
        {def}
        {gsap}
        value={valueFor(def)}
        meta={metaFor(def)}
        onvalue={setValue}
        onreset={() => reset(def)}
      />
    {/each}
    {#if props}
      <select
        class="f__add"
        aria-label="Add a property"
        onchange={(e) => {
          const prop = e.currentTarget.value;
          e.currentTarget.value = '';
          if (prop) addProp(props, prop);
        }}
      >
        <option value="">+ add property</option>
        {#each missingProps(m.spec[props]) as k (k)}
          <option value={k}>{PROPS[k].label}</option>
        {/each}
      </select>
    {/if}
  </Section>
{/each}

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
    margin: 6px 0 0;
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
    margin-bottom: 14px;
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
    width: 34px;
    text-align: right;
    color: var(--fg);
  }

  .scope {
    margin-bottom: 14px;

    .seg {
      margin-bottom: 8px;
    }

    .hint {
      font-size: 11px;
      margin: 0;
    }
  }
</style>
