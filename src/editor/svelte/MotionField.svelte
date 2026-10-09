<!--
  One field of the Motion tab's element view: the label, a badge with the layer the value
  comes from, a reset button, and the control. The badge names the layer for people:
    element  this element only        all     every element with this data-anim name
    default  the animation's value    global  animations.json defaults
  Fields:
    number   range + number + unit
    pair     duration number + ease, one row (one badge and reset for both)
    text     text input with suggestions
    segment  a row of buttons
    ease     ease picker
  def: a field from motion.js. value / meta: its value and { source, canReset }, an array
  of two for a pair. onvalue(path, value) on an edit, onreset() on reset.
-->
<script module>
  // layer (motion.js) -> badge text; data-src keeps the layer name (colors in editor.scss)
  const SOURCE = { element: 'element', target: 'all', preset: 'default', defaults: 'global' };
  const name = (source) => (source ? SOURCE[source] : 'unset');
  let lists = 0;
</script>

<script>
  import EasePicker from './EasePicker.svelte';

  let { def, value, meta, gsap, onvalue, onreset } = $props();

  const list = `dl-motion-${++lists}`;
  const badge = $derived.by(() => {
    if (def.kind !== 'pair') return { src: meta.source || 'none', text: name(meta.source) };
    const [d, e] = meta;
    if (d.source === e.source) return { src: d.source || 'none', text: name(d.source) };
    return { src: 'mixed', text: `${name(d.source)} / ${name(e.source)}` };
  });
  const canReset = $derived(
    def.kind === 'pair' ? meta[0].canReset || meta[1].canReset : meta.canReset,
  );

  /** Show the stored value, except in the input the user is typing in or dragging. */
  const show = (v) => (el) => {
    const text = String(v ?? '');
    if (document.activeElement !== el && el.value !== text) el.value = text;
  };
  /** A number input: store valid numbers only. */
  const number = (path) => (e) => {
    const raw = e.currentTarget.value;
    if (raw !== '' && Number.isFinite(Number(raw))) onvalue(path, Number(raw));
  };
</script>

<div class="f">
  <div class="f__top">
    <span class="f__label" title={def.hint || ''}>{def.label}</span>
    <span class="f__src" data-src={badge.src}>{badge.text}</span>
    {#if canReset}
      <button type="button" class="f__reset" title="Reset to inherited value" onclick={onreset}>
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  {#if def.kind === 'number'}
    <div class="f__row">
      <input
        type="range"
        class="f__range"
        min={def.min ?? 0}
        max={def.max}
        step={def.step}
        aria-label={def.label}
        {@attach show(value)}
        oninput={number(def.path)}
      />
      <input
        type="number"
        class="f__num"
        step={def.step}
        aria-label={def.label}
        {@attach show(value)}
        oninput={number(def.path)}
      />
      {#if def.unit}<span class="f__unit">{def.unit}</span>{/if}
    </div>
  {:else if def.kind === 'pair'}
    <div class="f__pair">
      <span class="f__numwrap">
        <input
          type="number"
          class="f__num"
          step={def.step}
          min={def.min ?? 0}
          max={def.max}
          title="Duration"
          {@attach show(value[0])}
          oninput={number(def.paths[0])}
        />
        {#if def.unit}<span class="f__unit">{def.unit}</span>{/if}
      </span>
      <EasePicker
        {gsap}
        value={value[1] ?? 'none'}
        compact
        onpick={(v) => onvalue(def.paths[1], v)}
      />
    </div>
  {:else if def.kind === 'text'}
    <input
      type="text"
      class="f__text"
      spellcheck="false"
      aria-label={def.label}
      list={def.suggestions?.length ? list : null}
      {@attach show(value)}
      onchange={(e) => onvalue(def.path, e.currentTarget.value.trim())}
    />
    {#if def.suggestions?.length}
      <datalist id={list}>
        {#each def.suggestions as s (s)}<option value={s}></option>{/each}
      </datalist>
    {/if}
  {:else if def.kind === 'segment'}
    <div class="seg seg--small">
      {#each def.options as [v, text] (text)}
        <button
          type="button"
          class={[
            'seg__btn',
            JSON.stringify(v) === JSON.stringify(value ?? def.options[0][0]) && 'is-active',
          ]}
          onclick={() => onvalue(def.path, v)}>{text}</button
        >
      {/each}
    </div>
  {:else if def.kind === 'ease'}
    <EasePicker {gsap} value={value ?? 'none'} onpick={(v) => onvalue(def.path, v)} />
  {/if}
</div>
