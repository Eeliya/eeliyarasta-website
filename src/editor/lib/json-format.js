/**
 * Deterministic JSON formatter shared by the editor (browser) and the dev save
 * endpoint (Node), so every save produces the same bytes and small git diffs.
 *
 * 2-space indent; an object/array whose values are all primitives is kept on one
 * line when it fits in `width` (99) columns, e.g. "from": { "autoAlpha": 0, "y": 40 }.
 * 99: Prettier's printWidth (100) less a trailing comma, so saved files are Prettier-clean.
 * An array goes on one line the way Prettier prints it, with no space inside its brackets
 * ([1, 2], [{ "from": "/a/", "to": "/b/" }]), when every item does (a value, a flat object,
 * an array of values) and it fits, unless Prettier breaks it: 2+ items that are all objects
 * (or all arrays) with 2+ entries each.
 */
const isObj = (v) => v !== null && typeof v === 'object';
const flat = (v) => Object.values(v).every((x) => !isObj(x));
/** Items Prettier can keep on one line: values, flat objects, arrays of values. */
const flatItem = (x) => !isObj(x) || (Array.isArray(x) ? x.every((y) => !isObj(y)) : flat(x));
/** Prettier breaks an array of 2+ objects (or arrays) that each have 2+ entries. */
const size = (x) => (Array.isArray(x) ? x.length : Object.keys(x).length);
const mustBreak = (v) =>
  v.length > 1 &&
  v.every((x) => isObj(x) && Array.isArray(x) === Array.isArray(v[0]) && size(x) > 1);
/** An array Prettier keeps on one line (when it fits). */
const flatItems = (v) => Array.isArray(v) && v.every(flatItem) && !mustBreak(v);
const oneLine = (v) => {
  if (Array.isArray(v))
    return `[${v.map((x) => (isObj(x) ? oneLine(x) : JSON.stringify(x))).join(', ')}]`;
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return entries.length
    ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(', ')} }`
    : '{}';
};

function fmt(value, indent, prefixLen, width) {
  if (!isObj(value)) return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value) ? flatItems(value) : flat(value)) {
    const line = oneLine(value);
    if (indent.length + prefixLen + line.length <= width) return line;
  }
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((x) => inner + fmt(x, inner, 0, width)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value).filter(([, x]) => x !== undefined);
  if (!entries.length) return '{}';
  return `{\n${entries
    .map(([k, x]) => {
      const key = `${JSON.stringify(k)}: `;
      return inner + key + fmt(x, inner, key.length, width);
    })
    .join(',\n')}\n${indent}}`;
}

export function formatJSON(value, { width = 99 } = {}) {
  return fmt(value, '', 0, width) + '\n';
}
