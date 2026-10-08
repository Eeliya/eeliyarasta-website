/**
 * Tiny SPA router on top of prerendered pages.
 * Internal link clicks fetch the target's static HTML, swap <main data-router-view>
 * with a GSAP page transition, update title/meta/history and re-mount animations.
 * Without JS (or on any error) links are plain links to real HTML files.
 */
import { gsap, reducedMotion } from './lib/env.js';
import { transitions } from './anim/engine.js';
import { normalizeCurtain, curtainPlan } from './anim/curtain.js';
import { closeMenus } from './ui/menu.js';
import { scrollToTop } from './smooth.js';

const cache = new Map();
let busy = false;
let queued = null;
let hooks = { mount: () => {}, unmount: () => {} };

const normalize = (pathname) => (pathname.endsWith('/') || pathname.endsWith('.html') ? pathname : pathname + '/');

/**
 * Curtain timings from content/animations.json transitions.page.curtain (see anim/curtain.js).
 * Read on every navigation, so edits pushed by the editor apply to the next transition.
 */
const curtainCfg = () => normalizeCurtain(transitions.page?.curtain);

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

/** Resolves once timeline `tl` reaches `pos` (immediately if it already has). */
const until = (tl, pos) => (pos <= tl.time() + 1e-3 ? Promise.resolve() : new Promise((r) => tl.call(r, null, pos)));

/**
 * The curtain sequence, on one explicit timeline (times from anim/curtain.js curtainPlan):
 *   0                curtain starts coming in (and the old view leaves)
 *   textDelay        text starts coming in
 *   + labelIn + hold text starts leaving
 *   + labelOut       text is gone
 *   + afterText      curtain starts leaving (never before it is fully closed)
 *
 * `ready` resolves to { label, swap } once the next page is loaded. swap() runs as soon as
 * the curtain is fully closed and returns the new view. If the page arrives after the text
 * should have started, the text and everything after it wait for it instead of skipping.
 */
async function runCurtain(cc, { leaveView = null, ready, onMount }) {
  const t = transitions.page;
  const c = document.querySelector('.curtain');
  const panel = c.querySelector('.curtain__panel') || c;
  const l = c.querySelector('.curtain__label');
  const t0 = gsap.ticker.time;
  gsap.killTweensOf([panel, l]);
  gsap.set(l, { autoAlpha: 0 });
  const cover = gsap.timeline();
  if (leaveView) cover.to(leaveView, { ...t.leave.to, duration: t.leave.duration, ease: t.leave.ease }, 0);
  cover.fromTo(panel, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: cc.in.duration, ease: cc.in.ease }, 0);

  const page = await ready;
  const text = cc.label ? String(page.label ?? '') : '';
  const p = curtainPlan(cc, !!text);
  const now = gsap.ticker.time - t0;
  const late = Math.max(0, now - (text ? p.textIn : p.closed));
  const at = (abs) => Math.max(0, abs + late - now);
  const swapAt = Math.max(0, p.closed - now);
  const outAt = Math.max(at(p.outAt), swapAt);

  const tl = gsap.timeline();
  l.textContent = text;
  if (text) {
    tl.fromTo(l, { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: cc.labelIn.duration, ease: cc.labelIn.ease }, at(p.textIn))
      .to(l, { autoAlpha: 0, yPercent: -40, duration: cc.labelOut.duration, ease: cc.labelOut.ease }, at(p.textOut));
  }
  tl.to(panel, { scaleY: 0, transformOrigin: '50% 0%', duration: cc.out.duration, ease: cc.out.ease }, outAt);

  await until(tl, swapAt);
  const view = page.swap?.() || null;
  if (view) {
    gsap.set(view, t.enter.from);
    tl.fromTo(view, t.enter.from, { autoAlpha: 1, y: 0, duration: t.enter.duration, ease: t.enter.ease, clearProps: 'transform,opacity,visibility' },
      Math.max(tl.time(), outAt + cc.out.duration - 0.6));
  }
  // Mount the page's animations just before the curtain starts leaving.
  await until(tl, Math.max(swapAt, outAt - 0.2));
  onMount?.(view);
  await tl;
}

/**
 * Editor preview (dev only): play the curtain over the current page without navigating,
 * with the current timings and the current page's curtain text.
 */
export function replayCurtain(label) {
  const cc = curtainCfg();
  if (!cc || busy) return Promise.resolve(false);
  busy = true;
  const view = document.querySelector('[data-router-view]');
  const text = label ?? curtainLabel(view, document);
  return runCurtain(cc, { ready: Promise.resolve({ label: text }) })
    .then(() => true)
    .finally(() => (busy = false));
}

function parsePage(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const incoming = doc.querySelector('[data-router-view]');
  if (!incoming) throw new Error('No [data-router-view] in response');
  return { doc, incoming, label: curtainLabel(incoming, doc) };
}

/** Replace the old view with the new page's view and update history/head. Returns the new view. */
function swapView(oldView, { doc, incoming }, url, push) {
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
  return view;
}

function mountView(view) {
  hooks.mount(view);
  document.documentElement.classList.remove('anim-pending');
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
  const t = transitions.page;
  const reduced = reducedMotion();
  const cc = reduced ? null : curtainCfg();
  try {
    const ready = getPage(url.pathname).then(parsePage);
    if (cc) {
      await runCurtain(cc, {
        leaveView: oldView,
        ready: ready.then((page) => ({ label: page.label, swap: () => swapView(oldView, page, url, push) })),
        onMount: mountView,
      });
    } else {
      const leave = reduced
        ? gsap.to(oldView, { autoAlpha: 0, duration: 0.2 })
        : gsap.to(oldView, { ...t.leave.to, duration: t.leave.duration, ease: t.leave.ease });
      const [page] = await Promise.all([ready, leave]);
      const view = swapView(oldView, page, url, push);
      if (!reduced) gsap.set(view, t.enter.from);
      const tl = reduced
        ? gsap.fromTo(view, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 })
        : gsap.fromTo(view, t.enter.from, { autoAlpha: 1, y: 0, duration: t.enter.duration, ease: t.enter.ease, clearProps: 'transform,opacity,visibility' });
      // Mount animations while the new view fades in.
      await new Promise((r) => setTimeout(r, reduced ? 0 : 450));
      mountView(view);
      await tl;
    }
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
