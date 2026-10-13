/**
 * Animation types. Each receives (el, spec, { reduce, onCleanup, targets, trigger }).
 * `spec` is the fully merged config for that element or block (see engine.js). For a block,
 * `targets` are what it moves and `trigger` what scroll positions are measured on; for a
 * data-anim element they are the element (or its `children`) and the element itself.
 * Add a new effect by adding a function here and a preset in settings/animations.json.
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
 * A scroll position in the footer, kept where the page can scroll to (ScrollTrigger's clamp()):
 * the footer is the end of every page, so "top 85%" of its blocks may lie past the last scroll
 * position, and their reveal would never play (or a scrubbed one stay hidden).
 */
const reach = (pos, trigger) =>
  typeof pos === 'string' && !pos.startsWith('clamp(') && trigger?.closest?.('[data-footer]')
    ? `clamp(${pos})`
    : pos;

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
    return {
      scrollTrigger: {
        trigger,
        start: reach(spec.start, trigger),
        end: reach(spec.end || 'top 40%', trigger),
        scrub,
      },
    };
  }
  const start = reach(spec.start, trigger);
  return {
    scrollTrigger: flags.preview
      ? { trigger, start, toggleActions: 'play none none reset' }
      : { trigger, start, once: true },
  };
};

/** What a type moves: a block's targets, else the element's `children`, else the element. */
const targetsOf = (el, spec, ctx) =>
  ctx.targets || (spec.children ? [...el.querySelectorAll(spec.children)] : [el]);

/** from → to tween, optionally on children, played on load or when scrolled into view. */
function reveal(el, spec, ctx) {
  const targets = targetsOf(el, spec, ctx);
  if (!targets.length) return;
  if (ctx.reduce) return gsap.set(targets, { ...spec.to, clearProps: 'clipPath,transform' });
  gsap.fromTo(
    targets,
    spec.from,
    tweenVars(spec, {
      ...spec.to,
      ...scrollVars(spec, ctx.trigger || (ctx.targets ? targets[0] : el)),
    }),
  );
}

/**
 * Scroll-linked: from → to as the page scrolls from `start` to `end` (always scrubbed; `scrub`
 * a number smooths it). With reduced motion the content stays as it is.
 */
function scroll(el, spec, ctx) {
  const targets = targetsOf(el, spec, ctx);
  if (ctx.reduce || !targets.length) return;
  const scrub = typeof spec.scrub === 'number' && spec.scrub > 0 ? spec.scrub : true;
  gsap.fromTo(targets, spec.from || {}, {
    ...spec.to,
    ease: spec.ease || 'none',
    stagger: spec.stagger || 0,
    scrollTrigger: {
      trigger: ctx.trigger || el,
      start: reach(spec.start || 'top bottom', ctx.trigger || el),
      end: reach(spec.end || 'bottom top', ctx.trigger || el),
      scrub,
      invalidateOnRefresh: true,
    },
  });
}

// Classes let CSS pad masked lines/words so descenders (g, j, y) aren't clipped.
const splitClasses = {
  linesClass: 'split-line',
  wordsClass: 'split-word',
  charsClass: 'split-char',
};

/**
 * Spans, not divs (text sits in <p> and headings), and an aria-label only where one is allowed:
 * headings get the text as their label; a <p> keeps its words readable as they are.
 */
const splitOpts = (el) => ({
  ...splitClasses,
  tag: 'span',
  aria: /^H[1-6]$/.test(el.tagName) ? 'auto' : 'none',
});

/**
 * SplitText into chars / words / lines (masked) and reveal them. Re-splits on resize. Each
 * target is split on its own (a block's paragraphs each play as they scroll in).
 */
function split(el, spec, ctx) {
  if (ctx.reduce) return;
  const type = spec.split === 'chars' ? 'chars,words' : spec.split === 'lines' ? 'lines' : 'words';
  for (const t of targetsOf(el, spec, ctx)) {
    const s = SplitText.create(t, {
      type,
      mask: spec.mask,
      ...splitOpts(t),
      autoSplit: spec.split === 'lines',
      onSplit: (self) =>
        gsap.fromTo(
          self[spec.split],
          spec.from,
          tweenVars(spec, { ...spec.to, ...scrollVars(spec, ctx.trigger || t) }),
        ),
    });
    ctx.onCleanup(() => s.revert());
  }
}

/** Words go from dim to bright as the paragraph scrolls through the viewport. */
function scrubWords(el, spec, ctx) {
  if (ctx.reduce) return;
  for (const t of targetsOf(el, spec, ctx)) {
    const s = SplitText.create(t, {
      type: 'words',
      ...splitOpts(t),
      autoSplit: true,
      onSplit: (self) =>
        gsap.fromTo(
          self.words,
          { opacity: spec.fromOpacity },
          {
            opacity: 1,
            ease: 'none',
            stagger: 0.1,
            scrollTrigger: {
              trigger: ctx.trigger || t,
              start: reach(spec.start, ctx.trigger || t),
              end: reach(spec.end, ctx.trigger || t),
              scrub: spec.scrub === undefined || spec.scrub === false ? true : spec.scrub,
            },
          },
        ),
    });
    ctx.onCleanup(() => s.revert());
  }
}

/** Scroll-scrubbed vertical parallax of an image inside an overflow:hidden box. */
function parallax(el, spec, ctx) {
  if (ctx.reduce) return;
  const speed = Number(spec.speedPct) || 10;
  for (const t of targetsOf(el, spec, ctx)) {
    gsap.set(t, { scale: 1 + (speed * 2.2) / 100 });
    gsap.fromTo(
      t,
      { yPercent: -speed },
      {
        yPercent: speed,
        ease: 'none',
        scrollTrigger: {
          trigger: ctx.trigger || t.parentElement,
          start: reach(spec.start || 'top bottom', ctx.trigger || t.parentElement),
          end: reach(spec.end || 'bottom top', ctx.trigger || t.parentElement),
          scrub: spec.scrub === true ? true : Number(spec.scrub) || true,
        },
      },
    );
  }
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
      scale: intro.fromScale,
      rotation: rnd(-10, 10),
      autoAlpha: 0,
      duration: intro.duration,
      ease: intro.ease,
      delay: intro.delay + i * intro.stagger,
    });
    // 2. endless drift
    gsap.to(item.querySelector('.scatter__drift'), {
      x: rnd(-drift.amplitudePx, drift.amplitudePx),
      y: rnd(-drift.amplitudePx, drift.amplitudePx),
      rotation: rnd(-drift.rotationDeg, drift.rotationDeg),
      duration: rnd(drift.minDurationSec, drift.maxDurationSec),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: intro.delay + intro.duration * 0.6,
    });
    // 3. scroll parallax by depth
    gsap.to(item, {
      y: () => -window.innerHeight * (scroll.distanceVh / 100) * depth,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  });
}

/** Big hero name: masked chars rise in; on scroll it shrinks and fades. */
function heroTitle(el, spec, { reduce, onCleanup }) {
  if (reduce) return;
  const s = SplitText.create(el, { type: 'chars,words', mask: 'words', ...splitOpts(el) });
  onCleanup(() => s.revert());
  gsap.fromTo(s.chars, spec.from, tweenVars(spec, spec.to));
  const hero = el.closest('[data-hero]') || el;
  const fromScroll = Object.fromEntries(
    Object.keys(spec.scroll).map((k) => [
      k,
      k === 'autoAlpha' || k === 'opacity' || k === 'scale' ? 1 : 0,
    ]),
  );
  gsap.fromTo(el, fromScroll, {
    ...spec.scroll,
    ease: 'none',
    immediateRender: false,
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
}

/**
 * Image preview for a project list. It does not follow the pointer: it sits at a
 * fixed horizontal position over the list (`xPct`, % of the list width) and glides
 * vertically to the row being hovered (`glideSec` seconds).
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
  const glide = reduce ? 0 : Number(spec.glideSec) || 0;
  const yTo = gsap.quickTo(el, 'y', { duration: glide, ease: 'power3' });
  const rows = [...list.querySelectorAll('[data-prow]')];
  let active = -1,
    visible = false;

  /** Anchor point for a row: fixed x over the list, vertical centre of the row's head. */
  const anchor = (i) => {
    const lb = list.getBoundingClientRect();
    const hb = rows[i].querySelector('.prow__head').getBoundingClientRect();
    return { x: lb.left + lb.width * ((Number(spec.xPct) || 72) / 100), y: hb.top + hb.height / 2 };
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
    if (!visible)
      gsap.to(el, {
        autoAlpha: 1,
        scale: 1,
        duration: reduce ? 0 : 0.5,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    visible = true;
  };
  const hide = () => {
    visible = false;
    gsap.to(el, {
      autoAlpha: 0,
      scale: 0.85,
      duration: reduce ? 0 : 0.35,
      ease: 'power2.in',
      overwrite: 'auto',
    });
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
  let px = 0,
    py = 0;
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
  scroll,
  split,
  'scrub-words': scrubWords,
  parallax,
  scatter,
  'hero-title': heroTitle,
  'hover-preview': hoverPreview,
};

export { ScrollTrigger };
