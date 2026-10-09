<!--
  The field groups of one animation (Timing, Trigger, From / To, ...: GROUPS in motion.js),
  each a Section of MotionFields, written to one layer of animations.json. Used by the
  element view (AnimEditor.svelte: this element, or all "<name>") and the Animations library
  (AnimationsModal.svelte: the animation itself).
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
    keepFor,
    missingProps,
    propFields,
    sourceOf,
  } from './motion.js';
  import { compile } from '../lib/pointer.js';
  import { ANIMATIONS } from '../../site/files.js';

  // live: reactive store (live.svelte.js); gsap: the preview's (for the ease curves)
  let { live, gsap, m, scope, ptr, key = 'motion' } = $props();

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

  function setValue(path, value) {
    live.store.set(ANIMATIONS, ptr + compile(path), value, {
      key: `anim:${ptr}:${path.join('.')}`, // one undo step while dragging
      keep: keepFor(scope),
      source: 'motion',
    });
  }
  const resetValue = (path) =>
    live.store.remove(ANIMATIONS, ptr + compile(path), { keep: keepFor(scope), source: 'motion' });
  const metaOf = (path) => ({
    source: sourceOf(m, path),
    canReset: dig(m.layers[scope], path) !== undefined,
  });

  // A pair field (duration + ease) has two paths.
  const valueFor = (def) =>
    def.paths ? def.paths.map((p) => dig(m.spec, p)) : dig(m.spec, def.path);
  const metaFor = (def) => (def.paths ? def.paths.map(metaOf) : metaOf(def.path));
  function reset(def) {
    if (!def.paths) return resetValue(def.path);
    live.store.batch(() => def.paths.forEach(resetValue), { source: 'motion' });
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

{#each groups as [title, defs, props] (title)}
  <Section key="{key}:{title}" {title}>
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
