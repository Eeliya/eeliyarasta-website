<!--
  A page-transition curtain: a fixed total duration, the timeline (CurtainTimeline), one ease
  for every step or per-step eases (Advanced), and every value as a number under Advanced.
  All edits go through curtain-edit.js.
    Settings tab  no `page`: the global curtain (settings/animations.json).
    Motion tab    `page` = where the page's "transition" is stored ({ file, ptr }): Global /
                  Custom / Off on top; Custom edits the page's own curtain.
-->
<script>
  import CurtainTimeline from './CurtainTimeline.svelte';
  import EasePicker from './EasePicker.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import {
    CURTAIN,
    CURTAIN_ROWS,
    TOTAL_MAX,
    curtainEdits,
    fmtS,
    setCurtainMode,
  } from './curtain-edit.js';
  import { CURTAIN_MODES, curtainMode } from '../../client/anim/curtain.js';
  import { ANIMATIONS } from '../../site/files.js';

  // gsap: the preview's, for the ease curves. page: see above. onsettings: open Settings.
  let { live, bridge, gsap, page = null, onsettings } = $props();

  const MODE_LABELS = { global: 'Global', custom: 'Custom', off: 'Off' };
  const mode = $derived.by(() => {
    live.version;
    return page ? curtainMode(live.get(page.file, page.ptr)) : 'custom';
  });
  // The curtain shown: the page's own (Custom) or the global one.
  const edit = $derived(
    page && mode === 'custom'
      ? curtainEdits(live.store, page.file, page.ptr)
      : curtainEdits(live.store, ANIMATIONS, CURTAIN),
  );
  // Re-read after every store change.
  const plan = $derived.by(() => {
    live.version;
    return edit.plan();
  });
  const individual = $derived.by(() => {
    live.version;
    return edit.easeMode() === 'individual';
  });
  const shared = $derived.by(() => {
    live.version;
    return edit.sharedEase();
  });
  const value = (rel) => {
    live.version;
    return edit.shown(rel);
  };
  // "stay" is not stored (it is the gap before textOutStart): never marked changed.
  const changed = (rel) => rel !== '/stay' && live.changed(edit.file, edit.base + rel);
  const modeChanged = $derived.by(() => {
    live.version;
    return !!page && live.changed(page.file, page.ptr);
  });

  // Advanced open/closed: kept while switching tabs and across a refresh, like the sections.
  const advanced = $derived(ui.sections['curtain:advanced'] ?? false);
  const advancedId = $props.id();

  // Fields with input that is not a number (red outline), by rel.
  let invalid = $state({});

  /** Allowed while typing a number: "", "-", ".", "-.", "3." */
  const partial = (raw) => /^-?\d*\.?$/.test(raw.trim()) && !/\d$/.test(raw.trim());

  /** Show the value, except while the user is typing in the field. */
  const show = (v) => (el) => {
    const text = v == null ? '' : fmtS(v);
    if (document.activeElement !== el && el.value !== text) el.value = text;
  };

  function oninput(rel, e) {
    const raw = e.currentTarget.value.trim();
    if (partial(raw)) return (invalid[rel] = false);
    const n = Number(raw);
    invalid[rel] = !(Number.isFinite(n) && n >= 0 && n <= TOTAL_MAX);
    if (!invalid[rel]) edit.setField(rel.slice(1), n);
  }

  function onblur(rel, e) {
    const raw = e.currentTarget.value.trim();
    const n = Number(raw);
    if (!partial(raw) && !Number.isFinite(n)) return (invalid[rel] = true);
    if (!partial(raw)) edit.setField(rel.slice(1), n);
    // Show what was stored (it may be clamped).
    e.currentTarget.value = fmtS(value(rel) ?? 0);
    invalid[rel] = false;
  }
</script>

{#snippet number(rel, cls, title)}
  <input
    class={[cls, invalid[rel] && 'is-invalid']}
    type="text"
    inputmode="decimal"
    autocomplete="off"
    spellcheck="false"
    data-ptr={edit.base + rel}
    {title}
    placeholder={fmtS(value(rel) ?? 0)}
    {@attach show(value(rel))}
    oninput={(e) => oninput(rel, e)}
    onblur={(e) => onblur(rel, e)}
  />
{/snippet}

<Section
  class="ptg"
  key={page ? 'motion:curtain' : 'settings:curtain'}
  title="Page transition"
  name="Curtain"
>
  <p class="hint">
    {page
      ? 'The curtain that plays when you navigate to this page. Its text is edited under Content → Page transition.'
      : 'The curtain every page uses unless Motion sets it to Custom or Off for that page. Drag the bar ends or type the values.'}
    Changes apply to the next page change in the preview.
  </p>

  <div class="ptg__box">
    <!-- drawn at the right of the row after it, like a grid's Source edit button -->
    <button
      type="button"
      class="icon-btn icon-btn--small ptg__replay"
      title="Replay: play the transition over this page with these values (no navigation)"
      aria-label="Replay"
      disabled={mode === 'off'}
      onclick={() => bridge.api?.replayCurtain?.(undefined, edit.get(edit.base) ?? true)}
    >
      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
      Replay
    </button>
    {#if page}
      <div class={['tf', modeChanged && 'is-changed']}>
        <span class="tf__label">Curtain for this page<i class="dot" title="Changed"></i></span>
        <div class="seg" role="group" aria-label="Curtain for this page">
          {#each CURTAIN_MODES as m (m)}
            <button
              type="button"
              class={['seg__btn', mode === m && 'is-active']}
              aria-pressed={mode === m}
              onclick={() => setCurtainMode(live.store, page, m)}>{MODE_LABELS[m]}</button
            >
          {/each}
        </div>
      </div>
    {/if}

    {#if mode === 'off'}
      <p class="hint small">
        No curtain when you navigate to this page: it fades in instead (<button
          type="button"
          class="link"
          onclick={onsettings}>Page fade in Settings</button
        >). Leaving it plays the curtain of the page you go to.
      </p>
    {:else if mode === 'global'}
      <p class="hint small">
        Uses the global curtain.
        <button type="button" class="link" onclick={onsettings}>Edit it in Settings</button>
      </p>
    {:else}
      <label class={['tf', changed('/total') && 'is-changed']}>
        <span class="tf__label">Total duration (s)<i class="dot" title="Changed"></i></span>
        {@render number('/total', 'tf__input')}
        <span class="hint small tf__hint">
          Fixed length of the timeline. The curtain-out bar is pinned to the end. Dragging bars will
          not grow this.
        </span>
      </label>

      <CurtainTimeline {plan} {edit} />

      <div class={['tf ptg__ease', individual && 'is-individual']}>
        <EasePicker
          {gsap}
          value={shared}
          compact
          empty={individual ? 'Individual' : null}
          onpick={edit.setSharedEase}
        />
        <p class="hint small tf__hint">
          {individual
            ? 'Per-step eases in Advanced. Pick an ease here to use one for all.'
            : 'One ease for every step. Set a step ease in Advanced to use separate eases.'}
        </p>
      </div>

      <div class="ptg__advanced">
        <button
          type="button"
          class="ptg__toggle"
          aria-expanded={advanced}
          aria-controls="{advancedId}-advanced"
          onclick={() => (ui.sections['curtain:advanced'] = !advanced)}
        >
          <i class="fa-solid fa-chevron-right ptg__caret" aria-hidden="true"></i>
          Advanced
        </button>
        <div class="ptg__advanced-body" id="{advancedId}-advanced" hidden={!advanced}>
          {#each CURTAIN_ROWS as row (row.label)}
            {#if row.pair}
              {@const ease = row.pair + '/ease'}
              <div
                class={[
                  'tf',
                  (changed(row.pair + '/duration') || changed(ease)) && 'is-changed',
                  !individual && 'is-ease-inactive',
                ]}
              >
                <span class="tf__label">{row.label}<i class="dot" title="Changed"></i></span>
                <div class="f__pair">
                  {@render number(row.pair + '/duration', 'f__num', row.label)}
                  <EasePicker
                    {gsap}
                    value={individual ? edit.get(edit.base + ease) || shared : shared}
                    compact
                    title={individual
                      ? ''
                      : 'Not in effect — shared ease is active. Pick an ease to switch to per-step.'}
                    onpick={(v) => edit.setStepEase(ease, v)}
                  />
                </div>
              </div>
            {:else}
              <label class={['tf', changed(row.rel) && 'is-changed']}>
                <span class="tf__label">{row.label}<i class="dot" title="Changed"></i></span>
                {@render number(row.rel, 'tf__input')}
                {#if row.hint}<span class="hint small tf__hint">{row.hint}</span>{/if}
              </label>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </div>
</Section>

<style lang="scss">
  /* Page transition: timeline (Motion tab, CurtainSection.svelte) */
  .tf__hint {
    display: block;
    margin: 8px 0 0;
  }

  /* One bordered curtain group: total, timeline, ease, Advanced. */
  .ptg__box {
    position: relative;
    margin: 0 0 16px;
    padding: 8px 8px 0;
    border-radius: 12px;
    background: var(--solid-card);
    display: grid;
    gap: 12px;

    > .tf {
      margin-bottom: 0;
    }

    // the first row ("Curtain for this page", or "Total duration") leaves room for Replay
    > .ptg__replay + * > .tf__label {
      min-height: 24px;
      padding-right: 28px;
    }
  }

  .ptg__replay {
    position: absolute;
    top: 12px;
    right: 8px;
    height: 24px;
    margin: 0;
  }

  .ptg__ease {
    margin: 0;
  }

  /* Advanced sits on the bottom edge of the curtain box (same border). */
  .ptg__advanced {
    margin: 0 -12px;
    padding: 0;
    border-radius: 0 0 12px 12px;
    box-shadow: inset 0 1px 0 var(--line);
    background: rgb(0 0 0 / 0.18);
  }

  // caret + "Advanced", 40px tall; the caret turns down when open
  .ptg__toggle {
    display: block;
    width: 100%;
    padding: 12px;
    border: 0;
    border-radius: 0 0 12px 12px;
    background: none;
    font: inherit;
    font-size: 11px;
    line-height: 16px;
    letter-spacing: 0.04em;
    text-align: left;
    color: var(--muted);
    cursor: pointer;
    user-select: none;

    &[aria-expanded='true'] {
      margin-bottom: 8px;
      color: var(--fg);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }
  }

  .ptg__caret {
    width: 1em;
    margin-right: 4px;
    color: var(--faint);
    font-size: 0.95em;
    transition: rotate 0.15s;

    [aria-expanded='true'] > & {
      rotate: 90deg;
    }
  }

  .ptg__advanced-body {
    display: grid;
    // Same 6px rhythm as .tf__label → control and .tf__hint (title / field / help).
    gap: 8px;
    padding: 0 12px 12px;
  }
</style>
