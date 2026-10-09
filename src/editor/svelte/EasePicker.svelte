<!--
  Ease picker: the current curve and its name. A click opens a grid of every ease plus a
  free-text input for anything GSAP parses (e.g. "back.out(2.5)", "steps(6)").
  The curves are sampled with the preview's GSAP (gsap.parseEase).
-->
<script module>
  const FAMILIES = [
    'power1',
    'power2',
    'power3',
    'power4',
    'sine',
    'expo',
    'circ',
    'back',
    'elastic',
    'bounce',
  ];
  const EASES = [
    'none',
    ...FAMILIES.flatMap((f) => ['in', 'out', 'inOut'].map((v) => `${f}.${v}`)),
  ];

  /** SVG path of an ease in a w × h box; y runs -0.35..1.35 so overshoot shows. */
  function curve(gsap, name, w, h) {
    const ease = gsap.parseEase(name) || gsap.parseEase('none');
    const y = (v) => h - ((v + 0.35) / 1.7) * h;
    let d = '';
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      d += `${i ? 'L' : 'M'}${(t * w).toFixed(2)},${y(ease(t)).toFixed(2)}`;
    }
    return { d, y0: y(0), y1: y(1) };
  }
</script>

<script>
  // value: the ease name; onpick(name) on a pick. compact: the smaller version for a row.
  // empty: a label shown instead of the value (e.g. "Individual") until the user picks.
  let { gsap, value, onpick, compact = false, empty = null, title = '' } = $props();

  let open = $state(false);
  const current = $derived(value || 'none');
</script>

{#snippet svg(name, w, h, cls)}
  {@const c = curve(gsap, name, w, h)}
  <svg class={cls} viewBox="0 0 {w} {h}" width={w} height={h} aria-hidden="true">
    <line x1="0" x2={w} y1={c.y0} y2={c.y0} class="curve__guide" />
    <line x1="0" x2={w} y1={c.y1} y2={c.y1} class="curve__guide" />
    <path d={c.d} class="curve__line" />
  </svg>
{/snippet}

<div class={['ease', compact && 'ease--compact', empty && 'is-empty']} {title}>
  <button type="button" class="ease__toggle" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="ease__big"
      >{@render svg(empty ? 'none' : current, 220, 72, 'curve curve--big')}</span
    >
    <span class="ease__name">{empty || current}</span>
  </button>
  {#if open}
    <div class="ease__grid">
      {#each EASES as e (e)}
        <button
          type="button"
          class={['ease__opt', !empty && e === current && 'is-active']}
          title={e}
          data-ease={e}
          onclick={() => onpick(e)}
        >
          {@render svg(e, 52, 36, 'curve curve--small')}
          <span>{e.replace('power', 'p').replace('.inOut', '.io')}</span>
        </button>
      {/each}
      <input
        class="ease__custom"
        type="text"
        spellcheck="false"
        placeholder="custom, e.g. back.out(2)"
        onchange={(e) => e.currentTarget.value.trim() && onpick(e.currentTarget.value.trim())}
      />
    </div>
  {/if}
</div>
