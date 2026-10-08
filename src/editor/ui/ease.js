/** Ease picker with visual curves (sampled with gsap.parseEase from the preview's GSAP). */
import { h } from './dom.js';

const FAMILIES = ['power1', 'power2', 'power3', 'power4', 'sine', 'expo', 'circ', 'back', 'elastic', 'bounce'];
const VARIANTS = ['in', 'out', 'inOut'];
export const EASES = ['none', ...FAMILIES.flatMap((f) => VARIANTS.map((v) => `${f}.${v}`))];

/** SVG path of an ease in a w-h box; y range -0.35..1.35 so overshoot is visible. */
export function curvePath(gsap, name, w, hgt) {
  const ease = gsap.parseEase(name) || gsap.parseEase('none');
  const y = (v) => hgt - ((v + 0.35) / 1.7) * hgt;
  let d = '';
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    d += `${i ? 'L' : 'M'}${(t * w).toFixed(2)},${y(ease(t)).toFixed(2)}`;
  }
  return { d, y0: y(0), y1: y(1) };
}

export function curveSvg(gsap, name, w = 120, hgt = 64, cls = 'curve') {
  const { d, y0, y1 } = curvePath(gsap, name, w, hgt);
  return h('svg', { class: cls, viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, 'aria-hidden': 'true' },
    h('line', { x1: 0, x2: w, y1: y0, y2: y0, class: 'curve__guide' }),
    h('line', { x1: 0, x2: w, y1: y1, y2: y1, class: 'curve__guide' }),
    h('path', { d, class: 'curve__line' }),
  );
}

/**
 * <ease field>: current curve + name; click opens a grid of all eases plus a
 * free-text input (e.g. "back.out(2.5)", "steps(6)").
 * emptyLabel (e.g. "Individual") shows an inactive shared-field state until the user picks.
 */
export function easeField({ gsap, value, onChange, compact = false, mixed = false, emptyLabel = null }) {
  let current = value || 'none';
  let isMixed = !!mixed;
  let empty = emptyLabel || null;
  let open = false;
  const big = h('div', { class: 'ease__big' });
  const name = h('span', { class: 'ease__name' });
  const grid = h('div', { class: 'ease__grid', hidden: true });
  const custom = h('input', {
    class: 'ease__custom', type: 'text', spellcheck: false, placeholder: 'custom, e.g. back.out(2)',
    onchange: () => custom.value.trim() && pick(custom.value.trim()),
  });
  const toggle = h('button', { type: 'button', class: 'ease__toggle', 'aria-expanded': 'false', onclick: () => setOpen(!open) }, big, name);

  function draw() {
    const showEmpty = !!empty;
    big.replaceChildren(curveSvg(gsap, showEmpty || isMixed ? 'none' : current, 220, 72, 'curve curve--big'));
    name.textContent = showEmpty ? empty : (isMixed ? 'Mixed' : current);
    el.classList.toggle('is-mixed', isMixed && !showEmpty);
    el.classList.toggle('is-empty', showEmpty);
    grid.querySelectorAll('[data-ease]').forEach((b) => b.classList.toggle('is-active', !showEmpty && !isMixed && b.dataset.ease === current));
  }
  function setOpen(v) {
    open = v;
    grid.hidden = !v;
    toggle.setAttribute('aria-expanded', String(v));
    if (v && !grid.childElementCount) {
      grid.append(
        ...EASES.map((e) => h('button', { type: 'button', class: 'ease__opt', title: e, dataset: { ease: e }, onclick: () => pick(e) },
          curveSvg(gsap, e, 52, 36, 'curve curve--small'), h('span', {}, e.replace('power', 'p').replace('.inOut', '.io'))),
        ),
        custom,
      );
      draw();
    }
  }
  function pick(e) {
    current = e;
    isMixed = false;
    empty = null;
    draw();
    onChange(e);
  }
  const el = h('div', { class: ['ease', compact && 'ease--compact', isMixed && 'is-mixed', empty && 'is-empty'] }, toggle, grid);
  draw();
  return {
    el,
    update(v, opts = false) {
      const o = opts && typeof opts === 'object' ? opts : { mixed: !!opts };
      const mix = !!o.mixed;
      const nextEmpty = o.emptyLabel || null;
      if (mix !== isMixed || nextEmpty !== empty || (!mix && !nextEmpty && v !== current)) {
        if (!mix && !nextEmpty) current = v || 'none';
        else if (v) current = v;
        isMixed = mix;
        empty = nextEmpty;
        draw();
      }
    },
  };
}
