/**
 * Tiny SPA router on top of prerendered pages.
 * Internal link clicks fetch the target's static HTML, swap <main data-router-view>
 * with a GSAP page transition, update title/meta/history and re-mount animations.
 * Without JS (or on any error) links are plain links to real HTML files.
 */
import { gsap, reducedMotion } from './lib/env.js';
import { transitions } from './anim/engine.js';
import { closeMenus } from './ui/menu.js';
import { scrollToTop } from './smooth.js';

const cache = new Map();
let busy = false;
let queued = null;
let hooks = { mount: () => {}, unmount: () => {} };

const normalize = (pathname) => (pathname.endsWith('/') || pathname.endsWith('.html') ? pathname : pathname + '/');

/** Curtain timings from content/animations.json transitions.page.curtain (with defaults). */
function curtainCfg() {
  const raw = transitions.page?.curtain;
  if (!raw) return null;
  const c = raw === true ? {} : raw;
  return {
    label: c.label !== false,
    hold: c.hold ?? 0.12,
    in: { duration: 0.7, ease: 'expo.inOut', ...(c.in || {}) },
    labelIn: { duration: 0.45, ease: 'expo.out', ...(c.labelIn || {}) },
    labelOut: { duration: 0.35, ease: 'power2.in', ...(c.labelOut || {}) },
    out: { duration: 0.8, ease: 'expo.inOut', ...(c.out || {}) },
  };
}

/** Label for the curtain: data-curtain on the incoming view, else document title. Empty string = no text. */
function curtainLabel(incoming, doc) {
  if (incoming && incoming.hasAttribute('data-curtain')) return incoming.getAttribute('data-curtain') ?? '';
  return doc.title.split('|')[0].trim();
}

function getPage(pathname) {
  const key = normalize(pathname);
  if (!cache.has(key)) {
    const p = fetch(key, { headers: { Accept: 'text/html' } }).then((r) => {
      if (!r.ok && r.status !== 404) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}

function isRoutable(a, e) {
  if (!a || (e && (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey))) return null;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-router')) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  if (/\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith('.html')) return null;
  return url;
}

const curtain = () => document.querySelector('.curtain');

async function leave(view) {
  const t = transitions.page;
  const cc = curtainCfg();
  if (reducedMotion()) return gsap.to(view, { autoAlpha: 0, duration: 0.2 });
  const tl = gsap.timeline();
  tl.to(view, { ...t.leave.to, duration: t.leave.duration, ease: t.leave.ease }, 0);
  if (cc) {
    const c = curtain();
    gsap.set(c.querySelector('.curtain__label'), { autoAlpha: 0 });
    tl.fromTo(c, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: cc.in.duration, ease: cc.in.ease }, 0);
  }
  return tl;
}

function enter(view, label) {
  const t = transitions.page;
  const cc = curtainCfg();
  if (reducedMotion()) return gsap.fromTo(view, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 });
  const tl = gsap.timeline();
  if (cc) {
    const c = curtain();
    const l = c.querySelector('.curtain__label');
    const text = cc.label === false ? '' : (label ?? '');
    l.textContent = text;
    if (text) {
      tl.fromTo(l, { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: cc.labelIn.duration, ease: cc.labelIn.ease })
        .to(l, { autoAlpha: 0, yPercent: -40, duration: cc.labelOut.duration, ease: cc.labelOut.ease }, `+=${cc.hold}`)
        .to(c, { scaleY: 0, transformOrigin: '50% 0%', duration: cc.out.duration, ease: cc.out.ease }, '-=0.25');
    } else {
      // No label: briefly hold the solid curtain, then lift.
      tl.to(c, { scaleY: 0, transformOrigin: '50% 0%', duration: cc.out.duration, ease: cc.out.ease }, `+=${cc.hold}`);
    }
  }
  tl.fromTo(view, t.enter.from, { autoAlpha: 1, y: 0, duration: t.enter.duration, ease: t.enter.ease, clearProps: 'transform,opacity,visibility' }, cc ? '-=0.6' : 0);
  return tl;
}

export async function navigate(href, { push = true } = {}) {
  const url = new URL(href, location.href);
  if (busy) {
    queued = { href, push };
    return;
  }
  busy = true;
  closeMenus();
  const oldView = document.querySelector('[data-router-view]');
  try {
    const [text] = await Promise.all([getPage(url.pathname), leave(oldView)]);
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const incoming = doc.querySelector('[data-router-view]');
    if (!incoming) throw new Error('No [data-router-view] in response');

    hooks.unmount(oldView);
    document.documentElement.classList.add('anim-pending');
    const view = document.importNode(incoming, true);
    oldView.replaceWith(view);
    hooks.prepare?.(view);
    if (push) history.pushState({}, '', url.pathname + url.search + url.hash);
    document.title = doc.title;
    for (const sel of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:title"]', 'meta[property="og:url"]']) {
      const next = doc.head.querySelector(sel);
      const cur = document.head.querySelector(sel);
      if (next && cur) cur.replaceWith(next.cloneNode(true));
    }
    scrollToTop(true);
    const label = curtainLabel(incoming, doc);
    gsap.set(view, transitions.page.enter.from);
    const tl = enter(view, label);
    // Mount animations while the curtain lifts.
    await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 450));
    hooks.mount(view);
    document.documentElement.classList.remove('anim-pending');
    await tl;
  } catch (err) {
    console.warn('[router] falling back to full page load', err);
    location.href = url.href;
    return;
  } finally {
    busy = false;
  }
  if (queued) {
    const q = queued;
    queued = null;
    navigate(q.href, { push: q.push });
  }
}

export function initRouter(h) {
  hooks = h;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    const url = isRoutable(a, e);
    if (!url) return;
    e.preventDefault();
    if (normalize(url.pathname) === normalize(location.pathname)) {
      closeMenus();
      if (url.hash) {
        history.pushState({}, '', url.hash);
        window.dispatchEvent(new Event('router:hash'));
      } else scrollToTop(false);
      return;
    }
    navigate(url.href);
  });

  // Prefetch on hover / touch start.
  const prefetch = (e) => {
    const url = isRoutable(e.target.closest?.('a[href]'));
    if (url && normalize(url.pathname) !== normalize(location.pathname)) getPage(url.pathname).catch(() => {});
  };
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('touchstart', prefetch, { passive: true });

  let lastPath = location.pathname;
  window.addEventListener('popstate', () => {
    if (normalize(location.pathname) === normalize(lastPath)) {
      window.dispatchEvent(new Event('router:hash'));
    } else navigate(location.href, { push: false });
    lastPath = location.pathname;
  });
  window.addEventListener('router:navigated', () => (lastPath = location.pathname));

  cache.set(normalize(location.pathname), Promise.resolve(document.documentElement.outerHTML));
}
