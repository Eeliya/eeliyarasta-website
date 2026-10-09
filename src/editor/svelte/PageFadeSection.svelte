<!--
  Settings tab: the page fade (settings/animations.json transitions.page leave / enter).
  The old page fades out, the new one fades in. That is the whole page change when a
  page's curtain is Off; with a curtain it plays behind it (the old page leaves under the
  panel, the new one comes in as the panel lifts). Same fields as the curtain's Advanced.
-->
<script>
  import EasePicker from './EasePicker.svelte';
  import Section from './Section.svelte';
  import { fmtS } from './curtain-edit.js';
  import { ANIMATIONS } from '../../site/files.js';

  // live: reactive store (live.svelte.js); gsap: the preview's, for the ease curves.
  let { live, gsap } = $props();

  const ROWS = [
    ['leave', 'Fade out old page (s)'],
    ['enter', 'Fade in new page (s)'],
  ];
  const MAX = 5; // seconds

  const ptr = (step, key) => `/transitions/page/${step}/${key}`;
  const get = (step, key) => live.get(ANIMATIONS, ptr(step, key));
  const set = (step, key, value) =>
    live.store.set(ANIMATIONS, ptr(step, key), value, {
      key: `fade:${ptr(step, key)}`,
      source: 'panel',
    });
  const changed = (step) =>
    live.changed(ANIMATIONS, ptr(step, 'duration')) || live.changed(ANIMATIONS, ptr(step, 'ease'));

  // Rows with input that is not a valid duration (red outline).
  let invalid = $state({});

  /** Allowed while typing a number: "", ".", "0." */
  const partial = (raw) => /^\d*\.?$/.test(raw) && !/\d$/.test(raw);

  /** Show the value, except while the user is typing in the field. */
  const show = (v) => (el) => {
    const text = v == null ? '' : fmtS(v);
    if (document.activeElement !== el && el.value !== text) el.value = text;
  };

  function oninput(step, e) {
    const raw = e.currentTarget.value.trim();
    if (partial(raw)) return (invalid[step] = false);
    const n = Number(raw);
    invalid[step] = !(Number.isFinite(n) && n >= 0 && n <= MAX);
    if (!invalid[step]) set(step, 'duration', n);
  }

  function onblur(step, e) {
    e.currentTarget.value = fmtS(get(step, 'duration') ?? 0);
    invalid[step] = false;
  }
</script>

<Section class="ptg" key="settings:fade" title="Page transition" name="Fade">
  <p class="hint">
    The old page fades out, the new one fades in: the whole page change when a page's curtain is
    Off, behind the curtain otherwise. Duration and ease.
  </p>
  {#each ROWS as [step, label] (step)}
    <div class={['tf', changed(step) && 'is-changed']}>
      <span class="tf__label">{label}<i class="dot" title="Changed"></i></span>
      <div class="f__pair">
        <input
          class={['f__num', invalid[step] && 'is-invalid']}
          type="text"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          aria-label="{label}: duration"
          data-ptr={ptr(step, 'duration')}
          {@attach show(get(step, 'duration'))}
          oninput={(e) => oninput(step, e)}
          onblur={(e) => onblur(step, e)}
        />
        <EasePicker {gsap} value={get(step, 'ease')} compact onpick={(v) => set(step, 'ease', v)} />
      </div>
    </div>
  {/each}
</Section>
