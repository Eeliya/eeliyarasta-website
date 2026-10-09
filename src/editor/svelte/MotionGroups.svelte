<!--
  The field groups of one animation (Timing, Trigger, From / To, ...: GROUPS in motion.js),
  each a Section of MotionFields, written to one layer of animations.json.
  Animations library (AnimationsModal.svelte, scope 'preset'): every value of the animation is
  editable, with a badge (default = this animation, global = defaults) and a reset; From / To
  can add and remove properties.
  Element view (AnimEditor.svelte, scope 'element' or 'target'): what the animation does is
  read-only; timing fields (TIMING_KEYS in motion.js) each have an Inherit / Custom switch.
  Inherit shows the inherited value muted and stores nothing; Custom stores the value at the
  scope (switching copies the inherited value there, Inherit removes it again).
    m      the model: animModel() or presetModel() (motion.js)
    scope  the layer edits go to: 'element' | 'target' | 'preset'
    ptr    that layer's pointer in animations.json (layerPtr)
    key    prefix of the sections' open/closed keys, e.g. 'motion' or 'library'
-->
<script>
  import MotionField from './MotionField.svelte';
  import Section from './Section.svelte';
  import {
    GROUPS,
    PROPS,
    TIMING,
    dig,
    inherited,
    isTiming,
    keepFor,
    missingProps,
    propFields,
    sourceOf,
  } from './motion.js';
  import { compile } from '../lib/pointer.js';
  import { ANIMATIONS } from '../../site/files.js';

  // live: reactive store (live.svelte.js); gsap: the preview's (for the ease curves)
  let { live, gsap, m, scope, ptr, key = 'motion' } = $props();

  const library = $derived(scope === 'preset');

  // [title, fields, 'from' | 'to' | null]; from/to groups can also add properties (library).
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
      .filter((g) => g && (g[1].length || (g[2] && library))),
  );

  const pathsOf = (def) => def.paths || [def.path];
  // A pair field (duration + ease) has two paths: values are arrays then.
  const each = (def, fn) => (def.paths ? def.paths.map(fn) : fn(def.path));

  function setValue(path, value) {
    live.store.set(ANIMATIONS, ptr + compile(path), value, {
      key: `anim:${ptr}:${path.join('.')}`, // one undo step while dragging
      keep: keepFor(scope),
      source: 'motion',
    });
  }
  const resetValue = (path) =>
    live.store.remove(ANIMATIONS, ptr + compile(path), { keep: keepFor(scope), source: 'motion' });
  const resetAll = (def, source = 'motion') =>
    live.store.batch(() => pathsOf(def).forEach(resetValue), { source });

  // ---- library: badges, reset, add / remove properties
  const SOURCE = { element: 'element', target: 'all', preset: 'default', defaults: 'global' };
  const name = (source) => (source ? SOURCE[source] : 'unset');
  function badge(def) {
    const [a, b = a] = pathsOf(def).map((p) => sourceOf(m, p));
    if (a === b) return { src: a || 'none', text: name(a) };
    return { src: 'mixed', text: `${name(a)} / ${name(b)}` };
  }
  const own = (def) => pathsOf(def).some((p) => dig(m.layers[scope], p) !== undefined);

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
  /** Remove a property from both from and to. */
  const removeProp = (prop) =>
    live.store.batch(
      () =>
        ['from', 'to'].forEach(
          (w) => dig(m.layers[scope], [w, prop]) !== undefined && resetValue([w, prop]),
        ),
      { source: 'motion-structure' },
    );

  // ---- element view: Inherit / Custom
  const FROM = { target: 'all', defaults: 'global' };
  /** "from fade-up", "from all / global": where the inherited value comes from. */
  function from(def) {
    const layers = [...new Set(pathsOf(def).map((p) => inherited(m, scope, p)[1]))];
    const names = layers.filter(Boolean).map((l) => FROM[l] || m.presetName);
    return names.length ? `from ${names.join(' / ')}` : '';
  }
  const inheritedValue = (def) => each(def, (p) => inherited(m, scope, p)[0]);
  const customValue = (def) =>
    each(def, (p) => dig(m.layers[scope], p) ?? inherited(m, scope, p)[0]);
  // a value for Custom when nothing is inherited (e.g. scrub)
  const blank = (def) =>
    def.kind === 'segment' ? def.options[0][0] : def.kind === 'text' ? '' : 0;

  /** Custom copies the inherited value into the scope, Inherit removes it: one undo step. */
  function setCustom(def, custom) {
    if (!custom) return resetAll(def);
    live.store.batch(
      () =>
        pathsOf(def).forEach((p) => {
          if (dig(m.layers[scope], p) !== undefined) return;
          live.store.set(ANIMATIONS, ptr + compile(p), inherited(m, scope, p)[0] ?? blank(def), {
            keep: keepFor(scope),
          });
        }),
      { source: 'motion' },
    );
  }
</script>

{#each groups as [title, defs, props] (title)}
  <Section key="{key}:{title}" {title}>
    {#each defs as def (def.label)}
      {#if library}
        <MotionField {def} {gsap} value={each(def, (p) => dig(m.spec, p))} onvalue={setValue}>
          {#snippet actions()}
            {#if props}
              <button
                type="button"
                class="f__reset"
                title="Remove {def.label} from this animation"
                aria-label="Remove {def.label}"
                onclick={() => removeProp(def.path[1])}
              >
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            {:else}
              {@const b = badge(def)}
              <span class="f__src" data-src={b.src}>{b.text}</span>
              {#if own(def)}
                <button
                  type="button"
                  class="f__reset"
                  title="Reset to the global value"
                  onclick={() => resetAll(def)}
                >
                  <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
                </button>
              {/if}
            {/if}
          {/snippet}
        </MotionField>
      {:else if isTiming(def)}
        {@const custom = own(def)}
        <MotionField
          {def}
          {gsap}
          view={custom ? 'edit' : 'inherit'}
          value={custom ? customValue(def) : inheritedValue(def)}
          note={from(def)}
          onvalue={setValue}
        >
          {#snippet actions()}
            <div class="seg seg--small f__mode" role="group" aria-label="{def.label} value">
              <button
                type="button"
                class={['seg__btn', !custom && 'is-active']}
                title="Use the inherited value ({from(def) || 'unset'})"
                onclick={() => custom && setCustom(def, false)}>Inherit</button
              >
              <button
                type="button"
                class={['seg__btn', custom && 'is-active']}
                title="Set an own value here"
                onclick={() => !custom && setCustom(def, true)}>Custom</button
              >
            </div>
          {/snippet}
        </MotionField>
      {:else}
        <MotionField {def} view="read" value={each(def, (p) => dig(m.spec, p))} />
      {/if}
    {/each}
    {#if props && library}
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
