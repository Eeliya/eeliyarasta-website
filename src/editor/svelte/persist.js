/**
 * Keeps the editor where it was across a refresh: the tab, open/closed sections, the
 * selected field or Motion element, the Source Explorer, and the panel and preview scroll.
 *
 * Stored in sessionStorage: it survives a refresh but belongs to this browser tab, so two
 * editor tabs don't fight and a new tab starts fresh. The page itself is in the URL
 * (?path=/projects), so a copied link opens the same page.
 *
 * main.js calls restoreUi() before the UI mounts and restorePlace() once the preview shows
 * the page. Anything that no longer exists (a deleted field, a renamed file) is skipped.
 */
import { tick } from 'svelte';
import { ui } from './ui.svelte.js';

const KEY = 'editor:ui';
const MODES = ['browse', 'text', 'motion', 'settings'];

let saved = null;

/** Put back the tab, sections and explorer, and save them again when the page goes away. */
export function restoreUi(bridge) {
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    saved = null;
  }
  if (saved) {
    if (MODES.includes(saved.mode)) ui.mode = saved.mode;
    if (MODES.includes(saved.lastEdit)) ui.lastEdit = saved.lastEdit;
    if (saved.component) ui.target = saved.component; // Menu or Footer (pages: the URL)
    ui.sections = saved.sections || {};
    // SourcesModal opens itself when ui.explorer.open is set (Content tab only).
    if (saved.explorer && ui.mode === 'text') ui.explorer = saved.explorer;
  }
  addEventListener('pagehide', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        mode: ui.mode,
        lastEdit: ui.lastEdit,
        component: ui.target?.kind === 'component' ? ui.target : null,
        sections: ui.sections,
        explorer: ui.explorer,
        path: bridge.path(),
        edit: ui.selection?.edit,
        anim: ui.anim?.key,
        panelY: document.querySelector('.ed-body')?.scrollTop || 0,
        previewY: bridge.api?.scrollTop() || 0,
      }),
    );
  });
}

/**
 * The preview shows the page (the first 'navigate'): scroll it and pick what was picked,
 * if it is still the same page.
 */
export async function restorePlace(bridge) {
  if (!saved) return;
  const { path, edit, anim, panelY, previewY } = saved;
  saved = null; // only after the refresh, not on later page changes
  if (path !== bridge.path()) return;
  bridge.api.scrollTop(previewY);
  // Motion: the picked element; Content (and the others, for later): the selected field
  const motion = ui.mode === 'motion';
  const sel = motion
    ? anim && `[data-anim-key="${CSS.escape(anim)}"]`
    : edit && `[data-edit="${CSS.escape(edit)}"]`;
  const el = sel && bridge.doc.querySelector(sel);
  if (el && (motion || ui.mode === 'text')) bridge.select(el, motion ? 'anim' : 'text');
  // quiet: the Content panel doesn't scroll to the field, the panel scroll is put back below
  if (el && !motion) ui.selection = { edit, quiet: true };
  await tick();
  requestAnimationFrame(() => {
    const panel = document.querySelector('.ed-body');
    if (panel) panel.scrollTop = panelY;
  });
}
