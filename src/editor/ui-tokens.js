/**
 * The editor's tokens for CSS it injects into the preview (overlay.js's Shadow DOM, bridge.js's
 * <style>), where the editor's stylesheet doesn't reach: the same values as
 * styles/_tokens.scss (scripts/ui-tokens.test.mjs keeps them in step).
 */
export const T = {
  accent: '#3cf', // --c-accent (--cyan-400)
  accentRgb: '51 204 255', // the accent as rgb channels, for its tints
  onAccent: '#000', // --c-on-accent
  error: '#ff8a7a', // --c-error (--red-300)
  white: '#fff', // --white
  black: '#000', // --black
  font: "'DM Mono', ui-monospace, monospace", // the site's --f-mono
  fsXs: '10px', // --fs-xs
  radiusXs: '2px', // --radius-xs
  radiusSm: '4px', // --radius-sm
};
