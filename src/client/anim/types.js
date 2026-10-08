/**
 * Animation types. Each receives (el, spec, { reduce, onCleanup }).
 * `spec` is the fully merged config for that element (see engine.js).
 * Add a new effect by adding a function here and a preset in animations.json.
 */
import { gsap, ScrollTrigger, SplitText, finePointer } from '../lib/env.js';
import { flags } from './flags.js';

const tweenVars = (spec, extra = {}) => ({
  duration: spec.duration,
  ease: spec.ease,
  delay: spec.delay,
  stagger: spec.stagger,
  ...extra,
});

/**
 * trigger "load": play immediately. trigger "scroll": play once when `start` is reached,
 * or, with `scrub` (true or seconds of lag), tie progress to scrolling from `start` to `end`.
 * In the editor preview, one-shot reveals reset when scrolled back above `start` so they
 * can be watched again.
 */
const scrollVars = (spec, trigger) => {
  if (spec.trigger !== 'scroll') return {};
  if (spec.scrub) {
    const scrub = spec.scrub === true ? true : Number(spec.scrub) || true;
    return { scrollTrigger: { trigger, start: spec.start, end: spec.end || 'top 40%', scrub } };
  }
  return {
    scrollTrigger: flags.preview
      ? { trigger, start: spec.start, toggleActions: 'play none none reset' }
      : { trigger, start: spec.start, once: true },
  };
};

/** from → to tween, optionally on children, played on load or when scrolled into view. */
function reveal(el, spec, { reduce }) {
  const targets = spec.children ? [...el.querySelectorAll(spec.children)] : [el];
  if (!targets.length) return;
  if (reduce) return gsap.set(targets, { ...spec.to, clearProps: 'clipPath,transform' });
  gsap.fromTo(targets, spec.from, tweenVars(spec, { ...spec.to, ...scrollVars(spec, el) }));
}

// Classes let CSS pad masked lines/words so descenders (g, j, y) aren't clipped.
const splitClasses = { linesClass: 'split-line', wordsClass: 'split-word', charsClass: 'split-char' };

/** SplitText into chars / words / lines (masked) and reveal them. Re-splits on resize. */
function split(el, spec, { reduce, onCleanup }) {
  if (reduce) return;
  const type = spec.split === 'chars' ? 'chars,words' : spec.split === 'lines' ? 'lines' : 'words';
  const s = SplitText.create(el, {
    type,
    mask: spec.mask,
    ...splitClasses,
    autoSplit: spec.split === 'lines',
    onSplit: (self) => gsap.fromTo(self[spec.split], spec.from, tweenVars(spec, { ...spec.to, ...scrollVars(spec, el) })),
  });
  onCleanup(() => s.revert());
}

/** Words go from dim to bright as the paragraph scrolls through the viewport. */
function scrubWords(el, spec, { reduce, onCleanup }) {
  if (reduce) return;
  const s = SplitText.create(el, {
    type: 'words',
    autoSplit: true,
    onSplit: (self) =>
      gsap.fromTo(self.words, { opacity: spec.fromOpacity }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: el, start: spec.start, end: spec.end, scrub: true },
      }),
  });
  onCleanup(() => s.revert());
}

/** Scroll-scrubbed vertical parallax of an image inside an overflow:hidden box. */
function parallax(el, spec, { reduce }) {
  if (reduce) return;
  const speed = Number(spec.speed) || 10;
  const box = el.parentElement;
  gsap.set(el, { scale: 1 + (speed * 2.2) / 100 });
  gsap.fromTo(el, { yPercent: -speed }, {
    yPercent: speed, ease: 'none',
    scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: spec.scrub === true ? true : Number(spec.scrub) || true },
  });
}

/**
 * Home hero: photos burst out from the centre, then drift forever and fly off
 * at different speeds (by depth) while scrolling. They never follow the pointer.
 * Markup: .scatter[data-depth] > .scatter__drift > .scatter__frame > img
 */
function scatter(el, spec, { reduce }) {
  const items = [...el.querySelectorAll('[data-depth]')].filter((i) => i.offsetParent !== null);
  if (reduce || !items.length) return;
  const hero = el.closest('[data-hero]') || el;
  const hb = hero.getBoundingClientRect();
  const cx = hb.left + hb.width / 2;
  const cy = hb.top + hb.height / 2;
  const { intro, drift, scroll } = spec;
  const rnd = gsap.utils.random;

  items.forEach((item, i) => {
    const depth = parseFloat(item.dataset.depth) || 0.5;
    const b = item.getBoundingClientRect();
    const frame = item.querySelector('.scatter__frame');
    // 1. intro burst
    gsap.from(frame, {
      x: (cx - (b.left + b.width / 2)) * 0.75,
      y: (cy - (b.top + b.height / 2)) * 0.75,
      scale: intro.fromScale, rotation: rnd(-10, 10), autoAlpha: 0,
      duration: intro.duration, ease: intro.ease, delay: intro.delay + i * intro.stagger,
    });
    // 2. endless drift
    gsap.to(item.querySelector('.scatter__drift'), {
      x: rnd(-drift.amplitude, drift.amplitude), y: rnd(-drift.amplitude, drift.amplitude),
      rotation: rnd(-drift.rotation, drift.rotation),
      duration: rnd(drift.minDuration, drift.maxDuration), ease: 'sine.inOut', yoyo: true, repeat: -1,
      delay: intro.delay + intro.duration * 0.6,
    });
    // 3. scroll parallax by depth
    gsap.to(item, {
      y: () => -window.innerHeight * (scroll.distance / 100) * depth, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  });
}

/** Big hero name: masked chars rise in; on scroll it shrinks and fades. */
function heroTitle(el, spec, { reduce, onCleanup }) {
  if (reduce) return;
  const s = SplitText.create(el, { type: 'chars,words', mask: 'words', ...splitClasses });
  onCleanup(() => s.revert());
  gsap.fromTo(s.chars, spec.from, tweenVars(spec, spec.to));
  const hero = el.closest('[data-hero]') || el;
  const fromScroll = Object.fromEntries(Object.keys(spec.scroll).map((k) => [k, k === 'autoAlpha' || k === 'opacity' || k === 'scale' ? 1 : 0]));
  gsap.fromTo(el, fromScroll, {
    ...spec.scroll, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
}

/**
 * Image preview for a project list. It does not follow the pointer: it sits at a
 * fixed horizontal position over the list (`x`, % of the list width) and glides
 * vertically to the row being hovered (`glide` seconds).
 */
function hoverPreview(el, spec, { reduce, onCleanup }) {
  const list = document.querySelector(`[data-project-list="${el.dataset.previewFor}"]`);
  if (!list || !finePointer()) {
    el.style.display = 'none';
    return;
  }
  const imgs = [...el.querySelectorAll('img')];
  gsap.set(el, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.85 });
  gsap.set(imgs, { autoAlpha: 0 });
  const glide = reduce ? 0 : Number(spec.glide) || 0;
  const yTo = gsap.quickTo(el, 'y', { duration: glide, ease: 'power3' });
  const rows = [...list.querySelectorAll('[data-prow]')];
  let active = -1, visible = false;

  /** Anchor point for a row: fixed x over the list, vertical centre of the row's head. */
  const anchor = (i) => {
    const lb = list.getBoundingClientRect();
    const hb = rows[i].querySelector('.prow__head').getBoundingClientRect();
    return { x: lb.left + lb.width * ((Number(spec.x) || 72) / 100), y: hb.top + hb.height / 2 };
  };
  const place = (i, instant) => {
    const { x, y } = anchor(i);
    gsap.set(el, { x });
    if (instant) gsap.set(el, { y });
    else yTo(y);
  };
  const show = (i) => {
    if (i !== active) {
      if (imgs[active]) gsap.to(imgs[active], { autoAlpha: 0, duration: 0.3 });
      gsap.to(imgs[i], { autoAlpha: 1, duration: 0.3 });
      active = i;
    }
    place(i, !visible);
    if (!visible) gsap.to(el, { autoAlpha: 1, scale: 1, duration: reduce ? 0 : 0.5, ease: 'expo.out', overwrite: 'auto' });
    visible = true;
  };
  const hide = () => {
    visible = false;
    gsap.to(el, { autoAlpha: 0, scale: 0.85, duration: reduce ? 0 : 0.35, ease: 'power2.in', overwrite: 'auto' });
  };
  const enters = rows.map((row) => {
    const head = row.querySelector('.prow__head');
    const fn = () => (row.classList.contains('is-open') ? hide() : show(+row.dataset.previewIndex));
    head.addEventListener('pointerenter', fn);
    head.addEventListener('pointerleave', hide);
    head.addEventListener('click', hide);
    return () => {
      head.removeEventListener('pointerenter', fn);
      head.removeEventListener('pointerleave', hide);
      head.removeEventListener('click', hide);
    };
  });
  // Smooth scrolling moves rows under a still pointer without reliable enter/leave
  // events, so while visible, check each frame which row is under the pointer and
  // keep the preview anchored to it as the list scrolls.
  let px = 0, py = 0;
  const track = (e) => ((px = e.clientX), (py = e.clientY));
  const verify = () => {
    if (!visible) return;
    const head = document.elementFromPoint(px, py)?.closest('.prow__head');
    const row = head && list.contains(head) ? head.closest('[data-prow]') : null;
    if (!row || row.classList.contains('is-open')) hide();
    else if (+row.dataset.previewIndex !== active) show(+row.dataset.previewIndex);
    else place(active, false);
  };
  gsap.ticker.add(verify);
  window.addEventListener('pointermove', track, { passive: true });
  onCleanup(() => {
    gsap.ticker.remove(verify);
    window.removeEventListener('pointermove', track);
    enters.forEach((f) => f());
  });
}

export const types = {
  reveal,
  split,
  'scrub-words': scrubWords,
  parallax,
  scatter,
  'hero-title': heroTitle,
  'hover-preview': hoverPreview,
};

export { ScrollTrigger };
