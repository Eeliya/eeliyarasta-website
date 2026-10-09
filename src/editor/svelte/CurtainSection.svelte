<!--
  Motion tab: the site-wide page-transition curtain. A fixed total duration, the timeline
  (CurtainTimeline), one ease for every step or per-step eases (Advanced), and every value
  as a number under Advanced. All edits go through curtain-edit.js.
-->
<script module>
  // Advanced open/closed, kept while switching tabs.
  let advanced = $state(false);
</script>

<script>
  import CurtainTimeline from './CurtainTimeline.svelte';
  import EasePicker from './EasePicker.svelte';
  import { CURTAIN, CURTAIN_ROWS, TOTAL_MAX, curtainEdits, fmtS } from './curtain-edit.js';
  import { ANIMATIONS } from '../../site/files.js';

  // gsap: the preview's, for the ease curves
  let { live, bridge, gsap } = $props();

  const edit = $derived(curtainEdits(live.store));
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
  const changed = (rel) => rel !== '/hold' && live.changed(ANIMATIONS, CURTAIN + rel);

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
    data-ptr={CURTAIN + rel}
    {title}
    placeholder={fmtS(value(rel) ?? 0)}
    {@attach show(value(rel))}
    oninput={(e) => oninput(rel, e)}
    onblur={(e) => onblur(rel, e)}
  />
{/snippet}

<section class="grp ptg">
  <h4 class="grp__title">Page transition</h4>
  <p class="hint">
    Site-wide curtain timing, in the order things happen. Drag the bar ends or type the values. The
    text itself is edited per page under Content → Page transition. Changes apply to the next page
    change in the preview.
  </p>
  <button
    type="button"
    class="btn-ed"
    title="Play the transition over this page with the values above (no navigation)"
    onclick={() => bridge.api?.replayCurtain?.()}
  >
    <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Replay
  </button>

  <div class="ptg__box">
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

    <details class="ptg__advanced" bind:open={advanced}>
      <summary>
        <i class="fa-solid fa-chevron-right ptg__caret ptg__caret--closed" aria-hidden="true"></i>
        <i class="fa-solid fa-chevron-down ptg__caret ptg__caret--open" aria-hidden="true"></i>
        Advanced
      </summary>
      <div class="ptg__advanced-body">
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
                  value={individual ? live.get(ANIMATIONS, CURTAIN + ease) || shared : shared}
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
    </details>
  </div>
</section>

<style lang="scss">
  /* Page transition: timeline (Motion tab, CurtainSection.svelte) */
  .ptg > .btn-ed {
    margin-bottom: 10px;
  }

  .tf__hint {
    display: block;
    margin: 6px 0 0;
  }

  /* One bordered curtain group: total, timeline, ease, Advanced. */
  .ptg__box {
    margin: 0 0 14px;
    padding: 12px 12px 0;
    border-radius: 10px;
    background: var(--solid-card);
    display: grid;
    gap: 12px;

    > .tf {
      margin-bottom: 0;
    }
  }

  .ptg__ease {
    margin: 0;
  }

  /* Advanced sits on the bottom edge of the curtain box (same border). */
  .ptg__advanced {
    margin: 0 -12px 0;
    padding: 0;
    border-radius: 0 0 10px 10px;
    box-shadow: inset 0 1px 0 var(--line);
    background: rgb(0 0 0 / 0.18);

    summary {
      padding: 10px 12px 12px;
      cursor: pointer;
      list-style: none;
      font-size: 11px;
      letter-spacing: 0.04em;
      color: var(--muted);
      user-select: none;

      &::-webkit-details-marker {
        display: none;
      }

      // Real FA icons in the summary markup (not CSS content — needs fontawesome.css).
      .ptg__caret {
        width: 1em;
        margin-right: 0.35em;
        color: var(--faint);
        font-size: 0.95em;
      }

      .ptg__caret--open {
        display: none;
      }
    }

    &[open] > summary {
      margin-bottom: 6px;
      color: var(--fg);

      .ptg__caret--closed {
        display: none;
      }

      .ptg__caret--open {
        display: inline-block;
      }
    }
  }

  .ptg__advanced-body {
    display: grid;
    // Same 6px rhythm as .tf__label → control and .tf__hint (title / field / help).
    gap: 6px;
    padding: 0 12px 12px;
  }
</style>
