/**
 * Toasts: short messages at the bottom left (Toasts.svelte shows them).
 *   toast('Save failed: …', { kind: 'error', timeout: 0 })
 *   toast('Saved', { kind: 'ok', files: ['pages/index.json'], note: '(draft, not published)' })
 * kind: 'info' | 'ok' | 'error'. timeout: ms until it goes away, 0 = stays until dismissed.
 * files are shown as content/<file>; link: { href, label } opens in a new tab.
 */
export const toasts = $state([]);
let ids = 0;

export function toast(
  text,
  { kind = 'info', timeout = 5000, files = [], note = '', link = null } = {},
) {
  const id = ++ids;
  toasts.push({ id, text, kind, files, note, link });
  if (timeout) setTimeout(() => dismiss(id), timeout);
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}
