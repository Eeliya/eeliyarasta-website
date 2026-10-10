<!--
  The field groups of one animation (Timing, Trigger, From / To, ...: GROUPS in motion.js),
  each a Section of MotionFields, written to one layer of animations.json.
  Animations sub-tab (AnimLibrary.svelte, scope 'preset'): every value of the animation is
  editable; From / To can add and remove properties.
  Element view (AnimEditor.svelte, scope 'element' or 'target'): what the animation does is
  read-only; timing fields (TIMING_KEYS in motion.js) each have a Custom switch. Off ("inherit"
  before it): the field's control shows the inherited value, dimmed and inert, and nothing is
  stored. On: the value is stored at the scope (switching on copies the inherited value there,
  off removes it again).
    m      the model: animModel() or presetModel() (motion.js)
    scope  the layer edits go to: 'element' | 'target' | 'preset'
    ptr    that layer's pointer in animations.json (layerPtr)
    key    prefix of the sections' open/closed keys, e.g. 'motion' or 'library'
-->
<script>
  import MotionField from './MotionField.svelte';
  import Section from './Section.svelte';
  import Select from './Select.svelte';
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

  // ---- library: add / remove properties
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

  // ---- element view: the Custom switch (off = inherit)
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
          onvalue={setValue}
        >
          {#snippet actions()}
            {#if !custom}<span class="f__inherit">inherit</span>{/if}
            <input
              type="checkbox"
              role="switch"
              class="switch"
              aria-label="Custom {def.label}"
              title={custom ? 'Own value (off: inherit)' : 'Inherited (on: own value)'}
              checked={custom}
              onchange={(e) => setCustom(def, e.currentTarget.checked)}
            />
          {/snippet}
        </MotionField>
      {:else}
        <MotionField {def} view="read" value={each(def, (p) => dig(m.spec, p))} />
      {/if}
    {/each}
    {#if props && library}
      <Select
        aria-label="Add a property"
        value=""
        placeholder="+ add property"
        options={missingProps(m.spec[props]).map((k) => ({ value: k, label: PROPS[k].label }))}
        onchange={(k) => addProp(props, k)}
      />
    {/if}
  </Section>
{/each}
