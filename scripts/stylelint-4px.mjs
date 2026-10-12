// Two editor-only Stylelint rules (see stylelint.config.mjs):
//   local/grid-4px             sizes and gaps in multiples of 4px (0, 1px and 999px+ pills are fine)
//   local/no-alpha-text-color  text colors without transparency (rgba, / alpha, #rrggbbaa)
//   local/no-raw-tokens        no raw hex colours or px font sizes outside token files
//                              (_tokens.scss): use the tokens (--c-*, --fs-*)
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

const RAW = 'local/no-raw-tokens';
const HEX = /#[0-9a-f]{3,8}\b/i;

const raw = createPlugin(RAW, (on) => (root, result) => {
  if (!on) return;
  // token files set the raw values
  if (/(^|\/)_tokens\.scss$/.test(root.source?.input?.file || '')) return;
  const messages = ruleMessages(RAW, {
    hex: (prop) => `${prop}: no raw hex colour, use a colour token (--c-*)`,
    size: () => 'font-size: no px size, use a type size token (--fs-*)',
  });
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    if (HEX.test(decl.value))
      report({ ruleName: RAW, result, node: decl, message: messages.hex(prop) });
    if ((prop === 'font-size' || prop === 'font') && /\d*\.?\d+px/.test(decl.value.split('/')[0]))
      report({ ruleName: RAW, result, node: decl, message: messages.size() });
  });
});

export default [grid, alpha, raw];
