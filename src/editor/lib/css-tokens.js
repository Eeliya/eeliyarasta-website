/**
 * Design tokens read from the token stylesheets themselves (custom properties: `--name: value;`),
 * so CSS the editor builds in JS (overlay.js's Shadow DOM, bridge.js's <style>: where the
 * editor's stylesheet doesn't reach) has no copy of them. Pure: ../ui-tokens.js hands it the
 * files' text (Vite ?raw), the tests the same files read from disk.
 */

/** The custom properties of stylesheets (later ones win), with var() references followed. */
export function tokensOf(...sources) {
  const raw = {};
  for (const src of sources)
    for (const m of src.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) raw[m[1]] = m[2].trim();
  const value = (name, seen = new Set()) => {
    const v = raw[name];
    const ref = v && /^var\((--[\w-]+)\)$/.exec(v);
    if (!ref) return v;
    if (seen.has(name)) return undefined;
    seen.add(name);
    return value(ref[1], seen);
  };
  return value;
}

/** A hex colour's rgb channels ("#3cf" -> "51 204 255"), for rgb(… / alpha) tints. */
export function rgbOf(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
}

/** The tokens the injected CSS uses, from the site's and the editor's token files. */
export function uiTokens(site, editor) {
  const v = tokensOf(site, editor);
  return {
    accent: v('--c-accent'),
    accentRgb: rgbOf(v('--c-accent')),
    onAccent: v('--c-on-accent'),
    error: v('--c-error'),
    peekLine: v('--c-line-peek'),
    white: v('--white'),
    black: v('--black'),
    font: v('--f-mono'),
    fsXs: v('--fs-xs'),
    radiusXs: v('--radius-xs'),
    radiusSm: v('--radius-sm'),
  };
}
