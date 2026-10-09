<!--
  One field of an animation: the label, actions at the end of its top row (given by
  MotionGroups.svelte: badge, reset, Inherit / Custom, remove) and the control, or the value
  as text where it can't be edited.
  Fields:
    number   range + number + unit
    pair     duration number + ease, one row
    text     text input with suggestions
    segment  a row of buttons
    ease     ease picker
    def      a field from motion.js
    value    its value, an array of two for a pair
    view     'edit' the control; 'read' the value as text in the top row (element view: what the
             animation does); 'inherit' the same control showing the inherited value, dimmed and
             out of reach (inert: no clicks, no focus), for a timing value the scope doesn't set
    onvalue  (path, value) on an edit
    actions  snippet for the end of the top row
-->
<script module>
  let lists = 0;
</script>

<script>
  import EasePicker from './EasePicker.svelte';
  import { formatValue } from './motion.js';

  let { def, value, gsap, view = 'edit', onvalue, actions } = $props();

  const list = `dl-motion-${++lists}`;

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
    {#if view === 'read'}
      <span class="f__value">{formatValue(def, value)}</span>
    {/if}
    {@render actions?.()}
  </div>

  {#if view !== 'read'}
    <div class={['f__ctrl', view === 'inherit' && 'is-inherited']} inert={view === 'inherit'}>
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
  {/if}
</div>
