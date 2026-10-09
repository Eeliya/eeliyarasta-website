<!--
  The curtain timeline: two rows over the fixed total.
    Curtain  enter bar pinned at 0, leave bar pinned to total; drag their inner ends.
             The gap between them is how long the curtain stays shut.
    Text     enter and leave bars: drag a bar to move it, an end to resize it (the left
             end pins the right one and the other way round). The gap is how long the
             text stays.
  Arrow keys nudge a focused bar or end by 0.01s; hold Shift for 0.1s (drags snap the same).
  plan: curtainPlan(); edit: curtainEdits() (curtain-edit.js), which also clamps every value.
-->
<script module>
  import { clampTo, fmtS } from './curtain-edit.js';

  /** Bar ends you can drag, in time order per row. at(plan) = where the end sits. */
  const ENDS = [
    // Curtain: the inner ends; value(x) = the field's new value at time x.
    {
      row: 'c',
      field: 'in/duration',
      label: 'Curtain in',
      at: (p) => p.curtainIn[1],
      value: (x) => x,
    },
    {
      row: 'c',
      field: 'outStart',
      label: 'Curtain out starts',
      at: (p) => p.curtainOut[0],
      value: (x) => x,
    },
    // Text, left ends: resize with the right end pinned (start and duration change together).
    {
      row: 't',
      label: 'Text in',
      start: 'textDelay',
      duration: 'labelIn/duration',
      at: (p) => p.textIn[0],
      span: (p) => p.textIn,
      min: () => 0,
    },
    {
      row: 't',
      field: 'labelIn/duration',
      label: 'Text in',
      at: (p) => p.textIn[1],
      value: (x, p) => x - p.textIn[0],
    },
    {
      row: 't',
      label: 'Text out',
      start: 'textOutStart',
      duration: 'labelOut/duration',
      at: (p) => p.textOut[0],
      span: (p) => p.textOut,
      min: (p) => p.textIn[1],
    },
    {
      row: 't',
      field: 'labelOut/duration',
      label: 'Text out',
      at: (p) => p.textOut[1],
      value: (x, p) => x - p.textOut[0],
    },
  ];

  /** Text bars move as a whole: their start field. */
  const MOVES = [
    { field: 'textDelay', label: 'Text in', span: (p) => p.textIn },
    { field: 'textOutStart', label: 'Text out', span: (p) => p.textOut },
  ];

  const snap = (x, step) => Math.round(x / step) * step;

  /** Set an end to time x (already snapped), from the plan at drag start. */
  function moveEnd(edit, end, x, p0) {
    if (end.span) {
      const stop = end.span(p0)[1];
      const start = Number(Math.min(stop, Math.max(end.min(p0), x)).toFixed(2));
      edit.setResize(end.start, start, end.duration, Number((stop - start).toFixed(2)));
    } else edit.setField(end.field, clampTo(end.field, end.value(x, p0), p0));
  }
</script>

<script>
  let { plan, edit } = $props();

  let width = $state(0); // track width in px, for hiding labels that don't fit
  // The drag in progress: { kind: 'end' | 'move', id, x0, p0, ends | end | bar } or null.
  let drag = $state.raw(null);

  const total = $derived(Math.max(0.01, plan.total));
  const pct = (v) => (v / total) * 100 + '%';
  // Each row: its two bars (text bars also move) and the gap between them.
  const rows = $derived([
    {
      id: 'c',
      name: 'Curtain',
      bars: [
        { ...place(plan.curtainIn), title: `Comes in: 0 to ${fmtS(plan.curtainIn[1])}s` },
        {
          ...place(plan.curtainOut),
          title: `Leaves: ${fmtS(plan.curtainOut[0])} to ${fmtS(plan.curtainOut[1])}s`,
        },
      ],
      gap: { ...place([plan.curtainIn[1], plan.curtainOut[0]]), title: 'Closed' },
    },
    {
      id: 't',
      name: 'Text',
      bars: [
        { ...place(plan.textIn), title: `Text in @ ${fmtS(plan.textIn[0])}s`, move: MOVES[0] },
        { ...place(plan.textOut), title: `Text out @ ${fmtS(plan.textOut[0])}s`, move: MOVES[1] },
      ],
      gap: { ...place([plan.textIn[1], plan.textOut[0]]), title: 'Stays' },
    },
  ]);
  const marks = $derived.by(() => {
    const every = total <= 3 ? 0.5 : total <= 6 ? 1 : 2;
    const out = [];
    for (let t = 0; t <= total + 1e-6; t += every) out.push(t);
    return out;
  });

  /** Left and width of a span, and its length label (hidden when it doesn't fit). */
  function place([a, b]) {
    const from = Math.max(0, a);
    const len = Math.max(0, b - from);
    const fits = len > 0 && !(width > 0 && (len / total) * width < 28);
    return {
      from,
      left: pct(from),
      width: pct(len),
      len: fmtS(Number(len.toFixed(2))) + 's',
      fits,
    };
  }

  /** Ends of a row within 8px (16 for touch) of the pointer; the closest (ties: all). */
  function endsNear(row, e) {
    const r = e.currentTarget.getBoundingClientRect();
    const tol = e.pointerType === 'touch' ? 16 : 8;
    const hits = ENDS.filter((end) => end.row === row)
      .map((end) => [end, Math.abs((end.at(plan) / total) * r.width - (e.clientX - r.left))])
      .filter(([, d]) => d <= tol);
    const best = Math.min(...hits.map(([, d]) => d));
    return hits.filter(([, d]) => d - best < 2).map(([end]) => end);
  }
  /** The text bar under the pointer. */
  function barAt(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * total;
    return MOVES.find((m) => {
      const [a, b] = m.span(plan);
      return b - a > 1e-6 && x >= a - 1e-6 && x <= b + 1e-6;
    });
  }

  function down(row, e) {
    if (e.button !== 0) return;
    const ends = endsNear(row, e);
    const bar = ends.length || row !== 't' ? null : barAt(e);
    if (!ends.length && !bar) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag = ends.length
      ? // Two ends on the same spot: the first 3px of movement pick one.
        {
          kind: 'end',
          id: e.pointerId,
          x0: e.clientX,
          p0: plan,
          ends,
          end: ends.length === 1 ? ends[0] : null,
        }
      : { kind: 'move', id: e.pointerId, x0: e.clientX, p0: plan, bar, start0: bar.span(plan)[0] };
  }

  function move(row, e) {
    const track = e.currentTarget;
    if (!drag) {
      track.style.cursor = endsNear(row, e).length
        ? 'ew-resize'
        : row === 't' && barAt(e)
          ? 'grab'
          : '';
      return;
    }
    if (e.pointerId !== drag.id) return;
    const r = track.getBoundingClientRect();
    const step = e.shiftKey ? 0.1 : 0.01;
    if (drag.kind === 'move') {
      const x = drag.start0 + ((e.clientX - drag.x0) / r.width) * total;
      edit.setField(drag.bar.field, clampTo(drag.bar.field, snap(x, step), drag.p0));
      return;
    }
    if (!drag.end) {
      const dx = e.clientX - drag.x0;
      if (Math.abs(dx) < 3) return;
      drag = { ...drag, end: dx > 0 ? drag.ends.at(-1) : drag.ends[0] };
    }
    moveEnd(edit, drag.end, snap(((e.clientX - r.left) / r.width) * total, step), drag.p0);
  }

  function up(e) {
    if (drag && e.pointerId === drag.id) drag = null;
  }

  const arrow = (e) => (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);

  function nudgeBar(bar, e) {
    const dir = arrow(e);
    if (!dir) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.1 : 0.01;
    edit.setField(bar.field, clampTo(bar.field, snap(bar.span(plan)[0] + dir * step, step), plan));
  }

  function nudgeEnd(end, e) {
    const dir = arrow(e);
    if (!dir) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.1 : 0.01;
    if (end.span) return moveEnd(edit, end, snap(end.at(plan) + dir * step, step), plan);
    // The field's own value (a duration for the right ends), one step on.
    const now = end.value(end.at(plan), plan);
    edit.setField(end.field, clampTo(end.field, snap(now + dir * step, step), plan));
  }
</script>

<div
  class={['ptl', drag && 'is-dragging', drag?.kind === 'move' && 'is-moving']}
  style:--tick={pct(0.5)}
>
  {#each rows as row (row.id)}
    <div class="ptl__row">
      <span class="ptl__name">{row.name}</span>
      <div
        class="ptl__track"
        role="group"
        aria-label={row.name}
        bind:clientWidth={width}
        onpointerdown={(e) => down(row.id, e)}
        onpointermove={(e) => move(row.id, e)}
        onpointerup={up}
        onpointercancel={up}
        onlostpointercapture={up}
      >
        <div class="ptl__bars">
          {#each row.bars as b, i (i)}
            {#if b.move}
              <i
                class="ptl__bar is-move is-text"
                style:left={b.left}
                style:width={b.width}
                title={b.title}
                tabindex="0"
                role="slider"
                aria-label="Move {b.move.label}"
                aria-valuenow={b.from}
                aria-valuemin="0"
                aria-valuemax={plan.total}
                onkeydown={(e) => nudgeBar(b.move, e)}
              >
                <span class="ptl__len" aria-hidden="true" hidden={!b.fits}>{b.len}</span>
              </i>
            {:else}
              <i class="ptl__bar is-move" style:left={b.left} style:width={b.width} title={b.title}>
                <span class="ptl__len" aria-hidden="true" hidden={!b.fits}>{b.len}</span>
              </i>
            {/if}
          {/each}
          <span
            class="ptl__gap"
            style:left={row.gap.left}
            style:width={row.gap.width}
            title="{row.gap.title} {row.gap.len}"
            aria-hidden="true"
          >
            <span class="ptl__len" hidden={!row.gap.fits}>{row.gap.len}</span>
          </span>
        </div>
        {#each ENDS.filter((end) => end.row === row.id) as end, i (i)}
          <button
            type="button"
            class={['ptl__handle', drag?.end === end && 'is-active']}
            style:left={pct(Math.min(total, Math.max(0, end.at(plan))))}
            title="{end.label} (drag, or arrow keys)"
            aria-label={end.label}
            onkeydown={(e) => nudgeEnd(end, e)}
          ></button>
        {/each}
      </div>
    </div>
  {/each}
  <div class="ptl__axis">
    {#each marks as t (t)}<span style:left={pct(t)}>{fmtS(t)}s</span>{/each}
  </div>
</div>

<style lang="scss">
  .ptl {
    display: grid;
    gap: 12px;
    padding: 0;
    background: none;
    box-shadow: none;
  }

  .ptl.is-dragging {
    user-select: none;
    cursor: ew-resize;
  }

  /* Label above bar so the track can use the full width. */
  .ptl__row {
    display: grid;
    gap: 4px;
  }

  .ptl__name {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .ptl__track {
    position: relative;
    height: 28px;
    touch-action: none;
  }

  .ptl__bars {
    position: absolute;
    inset: 0;
    border-radius: 4px;
    pointer-events: none;
    overflow: hidden;
    background: rgb(255 255 255 / 0.04);

    // Tick lines every 0.5s (--tick), over the bars.
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        to right,
        rgb(255 255 255 / 0.08) 0 1px,
        transparent 1px var(--tick, 25%)
      );
    }
  }

  .ptl__bar {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-sizing: border-box;
  }

  .ptl__len {
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    color: #2b2b2b; // was rgb(0 0 0 / 0.72) on move bar
    pointer-events: none;
    white-space: nowrap;
    user-select: none;
    // DM Mono digits sit high in the em box — nudge ink to optical center.
    transform: translateY(1px);
  }

  .ptl__bar.is-text.is-move .ptl__len {
    color: #283540; // was rgb(0 0 0 / 0.75) on var(--hi)
  }

  // Stay length centered in the empty gap between text-in and text-out.
  .ptl__gap {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    pointer-events: none;
    box-sizing: border-box;

    .ptl__len {
      color: #c1c1c1; // was rgb(255 255 255 / 0.72) on #212121
    }
  }

  .ptl__bar.is-move {
    background: rgb(255 255 255 / 0.55);
  }

  .ptl__bar.is-text.is-move {
    background: var(--hi);
  }

  .ptl__bar.is-text {
    pointer-events: auto;
    cursor: grab;
    outline: none;

    &:focus-visible {
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }
  }

  .ptl.is-moving .ptl__bar.is-text {
    cursor: grabbing;
  }

  .ptl__handle {
    position: absolute;
    z-index: 2;
    top: -4px;
    bottom: -4px;
    width: 16px;
    margin-left: -8px;
    padding: 0;
    border: 0;
    background: none;
    cursor: ew-resize;
    outline: none;

    &::before {
      content: '';
      position: absolute;
      left: 4px;
      top: 0;
      bottom: 0;
      width: 4px;
      border-radius: 4px;
      background: var(--solid-faint);
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.7);
      opacity: 1;
      transition:
        background 0.15s,
        box-shadow 0.15s;
    }

    .ptl:hover &::before {
      background: var(--fg);
    }

    &:hover::before,
    &:focus-visible::before,
    &.is-active::before {
      opacity: 1;
      background: var(--ed-accent);
      box-shadow:
        0 0 0 1px rgb(0 0 0 / 0.6),
        0 0 0 4px color-mix(in srgb, var(--ed-accent) 18%, transparent);
    }
  }

  .ptl__axis {
    position: relative;
    height: 12px;
    font-size: 10px;
    color: var(--faint);

    span {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      white-space: nowrap;
    }

    span:first-child {
      transform: none;
    }
  }
</style>
