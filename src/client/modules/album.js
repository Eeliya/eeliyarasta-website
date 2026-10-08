/**
 * Album slider (Faint Film style): big current image, numbered thumbs, counter,
 * keyboard ← →, mouse wheel, drag / swipe, and a Slider ⇄ Grid toggle.
 * Timings come from animations.json → transitions.album / interactions.album.
 */
import { gsap, reducedMotion, $ } from '../lib/env.js';
import { transitions, interactions } from '../anim/engine.js';
import { scrollToTop, refresh } from '../smooth.js';

const pad = (n) => String(n).padStart(2, '0');

export function album(view) {
  const root = view.querySelector('[data-album]');
  if (!root) return null;
  const reduce = reducedMotion();
  const T = transitions.album;
  const I = interactions.album || {};
  const slides = [...root.querySelectorAll('[data-slide]')];
  const thumbs = [...root.querySelectorAll('.thumb')];
  const thumbList = root.querySelector('[data-album-thumbs]');
  const stage = root.querySelector('[data-album-stage]');
  const bar = root.querySelector('.album__bar');
  const grid = root.querySelector('[data-album-grid]');
  const counter = root.querySelector('[data-album-current]');
  const credit = root.querySelector('[data-album-credit]');
  const toggle = $(view, '.viewtoggle');
  const pill = toggle?.querySelector('.viewtoggle__pill');
  const n = slides.length;
  let index = 0;
  let mode = 'slider';
  let tl = null;
  const off = [];
  const on = (el, ev, fn, opts) => {
    el.addEventListener(ev, fn, opts);
    off.push(() => el.removeEventListener(ev, fn, opts));
  };

  function updateUI(i) {
    counter.textContent = pad(i + 1);
    if (!reduce) gsap.fromTo(counter, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'expo.out' });
    thumbs.forEach((t, k) => t.classList.toggle('is-active', k === i));
    slides.forEach((s, k) => (k === i ? s.removeAttribute('aria-hidden') : s.setAttribute('aria-hidden', 'true')));
    const s = slides[i];
    credit.textContent = s.dataset.credit || '';
    credit.href = s.dataset.creditUrl || '#';
    const t = thumbs[i];
    if (t && thumbList) {
      const left = t.parentElement.offsetLeft - thumbList.clientWidth / 2 + t.offsetWidth / 2;
      thumbList.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
    }
    // warm up neighbours
    [i + 1, i - 1].forEach((k) => {
      const im = slides[(k + n) % n].querySelector('img');
      if (im) im.loading = 'eager';
    });
    history.replaceState(history.state, '', i === 0 ? location.pathname : `#${i + 1}`);
  }

  function go(target, { dir, instant = false } = {}) {
    const i = ((target % n) + n) % n;
    if (i === index && !instant) return;
    const from = slides[index];
    const to = slides[i];
    const d = dir ?? (i > index ? 1 : -1);
    index = i;
    updateUI(i);
    if (tl) tl.progress(1);
    if (instant || reduce || from === to) {
      slides.forEach((s) => s.classList.toggle('is-active', s === to));
      return;
    }
    const fromImg = from.querySelector('img');
    const toImg = to.querySelector('img');
    to.classList.add('is-active');
    gsap.set(to, { zIndex: 2 });
    gsap.set(from, { zIndex: 1 });
    tl = gsap.timeline({
      defaults: { duration: T.slide.duration, ease: T.slide.ease },
      onComplete: () => {
        from.classList.remove('is-active');
        gsap.set([from, to], { clearProps: 'zIndex,clipPath,opacity,visibility' });
        gsap.set([fromImg, toImg], { clearProps: 'transform' });
        tl = null;
      },
    });
    tl.fromTo(to, { clipPath: d > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }, 0)
      .fromTo(toImg, { scale: 1.25, xPercent: d * 12 }, { scale: 1, xPercent: 0, x: 0 }, 0)
      .to(fromImg, { xPercent: -d * 14, scale: 0.94 }, 0)
      .to(from, { autoAlpha: 0, duration: T.slide.duration * 0.6, ease: 'power2.in' }, T.slide.duration * 0.3);
  }

  const next = () => go(index + 1, { dir: 1 });
  const prev = () => go(index - 1, { dir: -1 });

  function setMode(m, { instant = false } = {}) {
    if (m === mode) return;
    mode = m;
    const btns = toggle ? [...toggle.querySelectorAll('[data-view-btn]')] : [];
    btns.forEach((b) => {
      const active = b.dataset.viewBtn === m;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    movePill(instant);
    const outEls = m === 'grid' ? [stage, bar] : [grid];
    const swap = () => {
      root.dataset.view = m;
      grid.hidden = m !== 'grid';
      scrollToTop(true);
      refresh();
      if (reduce || instant) return gsap.set([stage, bar, grid], { clearProps: 'all' });
      gsap.set(outEls, { clearProps: 'all' });
      if (m === 'grid') {
        gsap.fromTo(grid.querySelectorAll('.gcell, .album__nextlink'), { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: T.view.duration, ease: T.view.ease, stagger: 0.04 });
      } else {
        gsap.fromTo(stage, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: T.view.duration, ease: T.view.ease });
        gsap.fromTo(bar, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: T.view.duration, ease: T.view.ease, delay: 0.1 });
      }
    };
    if (reduce || instant) return swap();
    gsap.to(outEls, { autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in', onComplete: swap });
  }

  function movePill(instant) {
    if (!pill || !toggle) return;
    const btn = toggle.querySelector(`[data-view-btn="${mode}"]`);
    gsap.to(pill, { x: btn.offsetLeft, width: btn.offsetWidth, duration: instant || reduce ? 0 : 0.6, ease: 'expo.out' });
  }

  // initial state (deep link: /people/x/#3)
  const fromHash = parseInt(location.hash.slice(1), 10);
  if (fromHash >= 1 && fromHash <= n) go(fromHash - 1, { instant: true });
  else updateUI(0);
  requestAnimationFrame(() => movePill(true));
  setTimeout(() => slides.forEach((s) => (s.querySelector('img').loading = 'eager')), 2500);

  // controls
  on(root.querySelector('[data-album-next]'), 'click', next);
  on(root.querySelector('[data-album-prev]'), 'click', prev);
  root.querySelectorAll('.thumb').forEach((t) => on(t, 'click', () => go(+t.dataset.goto)));
  grid.querySelectorAll('.gcell').forEach((c) =>
    on(c, 'click', () => {
      go(+c.dataset.goto, { instant: true });
      setMode('slider');
    })
  );
  toggle?.querySelectorAll('[data-view-btn]').forEach((b) => on(b, 'click', () => setMode(b.dataset.viewBtn)));
  on(window, 'resize', () => movePill(true));

  on(document, 'keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey) return;
    if (mode === 'slider' && e.key === 'ArrowRight') next();
    else if (mode === 'slider' && e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 'g') setMode(mode === 'grid' ? 'slider' : 'grid');
  });

  // wheel / trackpad: one step per gesture
  let acc = 0;
  let locked = false;
  on(stage, 'wheel', (e) => {
    if (mode !== 'slider') return;
    e.preventDefault();
    if (locked) return;
    acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(acc) > (I.wheelThreshold || 40)) {
      acc > 0 ? next() : prev();
      acc = 0;
      locked = true;
      setTimeout(() => (locked = false), (I.wheelLock || 0.9) * 1000);
    }
  }, { passive: false });

  // drag / swipe
  let startX = null;
  let dx = 0;
  on(stage, 'pointerdown', (e) => {
    if (mode !== 'slider' || e.button !== 0 || e.target.closest('button')) return;
    startX = e.clientX;
    dx = 0;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });
  on(stage, 'pointermove', (e) => {
    if (startX === null) return;
    dx = e.clientX - startX;
    if (!reduce) gsap.set(slides[index].querySelector('img'), { x: dx * 0.3 });
  });
  const end = () => {
    if (startX === null) return;
    startX = null;
    stage.classList.remove('is-dragging');
    const img = slides[index].querySelector('img');
    if (Math.abs(dx) > (I.dragThreshold || 50)) dx < 0 ? next() : prev();
    else gsap.to(img, { x: 0, duration: 0.6, ease: 'expo.out' });
  };
  on(stage, 'pointerup', end);
  on(stage, 'pointercancel', end);

  const onHash = () => {
    const h = parseInt(location.hash.slice(1), 10);
    if (h >= 1 && h <= n) {
      setMode('slider');
      go(h - 1);
    }
  };
  on(window, 'router:hash', onHash);

  return () => {
    tl?.kill();
    off.forEach((f) => f());
  };
}
