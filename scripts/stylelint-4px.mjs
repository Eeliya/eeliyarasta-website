// Two editor-only Stylelint rules (see stylelint.config.mjs):
//   local/grid-4px             sizes and gaps in multiples of 4px (0, 1px and 999px+ pills are fine)
//   local/no-alpha-text-color  text colors without transparency (rgba, / alpha, #rrggbbaa)
import stylelint from 'stylelint';

const {
  createPlugin,
  utils: { report, ruleMessages },
} = stylelint;

const GRID = 'local/grid-4px';
const ALPHA = 'local/no-alpha-text-color';

const SIZE =
  /^(padding|margin|gap|row-gap|column-gap|width|height|min-width|min-height|max-width|max-height|border-radius|top|left|right|bottom|inset|translate)(-|$)/;
const PX = /(-?\d*\.?\d+)px\b/g;

/** px numbers in a declaration that must sit on the grid; for transform only those in translate(). */
function pxValues(prop, value) {
  if (prop === 'transform') {
    return [...value.matchAll(/translate[XYZ3d]*\(([^)]*)\)/g)].flatMap((m) =>
      [...m[1].matchAll(PX)].map((n) => n[1]),
    );
  }
  if (!SIZE.test(prop) || (/-(width|style|color)$/.test(prop) && prop.startsWith('border')))
    return [];
  return [...value.matchAll(PX)].map((n) => n[1]);
}

const grid = createPlugin(GRID, (on) => (root, result) => {
  if (!on) return;
  const messages = ruleMessages(GRID, {
    off: (prop, px) => `${prop}: ${px}px is off the 4px grid (use a multiple of 4, 0 or 1px)`,
  });
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    for (const n of pxValues(prop, decl.value)) {
      const v = Math.abs(Number(n));
      if (v === 0 || v === 1 || v >= 999 || v % 4 === 0) continue;
      report({
        ruleName: GRID,
        result,
        node: decl,
        word: `${n}px`,
        message: messages.off(prop, n),
      });
    }
  });
});

const TRANSPARENT =
  /rgba?\([^)]*(\/\s*[\d.]+%?|,[^,)]*,[^,)]*,\s*[\d.]+%?)\s*\)|hsla?\([^)]*(\/|,[^,)]*,[^,)]*,)\s*[\d.]+%?\s*\)|#([0-9a-f]{4}|[0-9a-f]{8})\b|color-mix\([^)]*transparent/i;

const alpha = createPlugin(ALPHA, (on) => (root, result) => {
  if (!on) return;
  const messages = ruleMessages(ALPHA, {
    off: (prop) => `${prop}: no transparent text colors, use a solid color token`,
  });
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    if (prop !== 'color' && prop !== '-webkit-text-fill-color') return;
    const m = decl.value.match(TRANSPARENT);
    if (m && !/,\s*1\s*\)|\/\s*1\s*\)|\/\s*100%\s*\)/.test(m[0]))
      report({ ruleName: ALPHA, result, node: decl, message: messages.off(prop) });
  });
});

export default [grid, alpha];
