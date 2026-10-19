<!--
  A page-transition curtain: a fixed total duration, the timeline (CurtainTimeline), one ease
  for every step or per-step eases (Advanced), and every value as a number under Advanced.
  All edits go through curtain-edit.js. The Settings tab's: the one curtain every page uses
  (settings/animations.json); a page only turns it off (Content > Transitions, PageCurtain.svelte).
-->
<script>
  import { showValue } from '../lib/show-value.js';
  import Button from './Button.svelte';
  import CurtainTimeline from './CurtainTimeline.svelte';
  import EasePicker from './EasePicker.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { CURTAIN, CURTAIN_ROWS, TOTAL_MAX, curtainEdits, fmtS } from './curtain-edit.js';
  import { ANIMATIONS } from '../../site/files.js';

  // gsap: the preview's, for the ease curves
  let { live, bridge, gsap } = $props();

  const edit = $derived(curtainEdits(live.store, ANIMATIONS, CURTAIN));
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

  // Advanced open/closed: kept while switching tabs and across a refresh, like the sections.
  const advanced = $derived(ui.sections['curtain:advanced'] ?? false);
  const advancedId = $props.id();

  // Fields with input that is not a number (red outline), by rel.
  let invalid = $state({});

  /** Allowed while typing a number: "", "-", ".", "-.", "3." */
  const partial = (raw) => /^-?\d*\.?$/.test(raw.trim()) && !/\d$/.test(raw.trim());

  /** Show the value, except while the user is typing in the field. */
  const show = (v) => showValue(v == null ? '' : fmtS(v));

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

<Section class="ptg" key="settings:curtain" title="Curtain">
  <p class="hint">
    The curtain every page uses, unless a page turns it off (Content → Transitions). Drag the bar
    ends or type the values. Changes apply to the next page change in the preview.
  </p>

  <div class="ptg__box">
    <!-- drawn at the right of the row after it, like a grid's Source edit button -->
    <Button
      size="small"
      icon="rotate-right"
      iconOnly
      label="Replay"
      title="Replay: play the transition over this page with these values (no navigation)"
      onclick={() => bridge.api?.replayCurtain?.(undefined, edit.get(edit.base) ?? true)}
    />
    <label class={['tf', changed('/total') && 'is-changed']}>
      <span class="tf__label">Total duration (s)</span>
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
              <span class="tf__label">{row.label}</span>
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
              <span class="tf__label">{row.label}</span>
              {@render number(row.rel, 'tf__input')}
              {#if row.hint}<span class="hint small tf__hint">{row.hint}</span>{/if}
            </label>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</Section>

<style lang="scss">
  @use '../styles/mixins' as *;

  /* Page transition: timeline (Motion tab, CurtainSection.svelte) */
  .tf__hint {
    display: block;
    margin: var(--space-2) 0 0;
  }

  /* One bordered curtain group: total, timeline, ease, Advanced (edge to edge: the box has no
     side padding, its other parts 8px each). */
  .ptg__box {
    position: relative;
    margin: 0 0 var(--space-4);
    padding: var(--space-2) 0 0;
    border-radius: var(--radius-lg);
    background: var(--c-card);
    @include stack(var(--space-3));

    > :global(:not(.ptg__advanced, .btn)) {
      padding-inline: var(--space-2);
    }

    // the first row ("Curtain for this page", or "Total duration") leaves room for Replay
    > :nth-child(2) > .tf__label {
      min-height: 24px;
      padding-right: 28px;
    }
  }

  .ptg__box > :global(.btn) {
    position: absolute;
    top: 12px;
    right: 8px;
  }

  .ptg__ease {
    margin: 0;
  }

  /* Advanced sits on the bottom edge of the curtain box (same border). */
  .ptg__advanced {
    margin: 0;
    padding: 0;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    box-shadow: inset 0 1px 0 var(--c-line);
    background: var(--black-a18);
  }

  // caret + "Advanced", 40px tall; the caret turns down when open
  .ptg__toggle {
    display: block;
    width: 100%;
    padding: var(--space-3);
    border: 0;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background: none;
    font: inherit;
    @include muted;
    line-height: 16px;
    letter-spacing: 0.04em;
    text-align: left;
    cursor: pointer;
    user-select: none;

    &[aria-expanded='true'] {
      margin-bottom: var(--space-2);
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .ptg__caret {
    width: 1em;
    margin-right: var(--space-1);
    color: var(--c-text-faint);
    font-size: 0.95em;
    transition: rotate 0.15s;

    [aria-expanded='true'] > & {
      rotate: 90deg;
    }
  }

  .ptg__advanced-body {
    @include stack(var(--space-2));
    // Same 6px rhythm as .tf__label → control and .tf__hint (title / field / help).
    padding: 0 var(--space-3) var(--space-3);
  }
</style>
