/**
 * Deterministic JSON formatter shared by the editor (browser) and the dev save
 * endpoint (Node), so every save produces the same bytes and small git diffs.
 *
 * 2-space indent; an object/array whose values are all primitives is kept on one
 * line when it fits in `width` (180) columns, e.g. "from": { "autoAlpha": 0, "y": 40 }.
 */
const isObj = (v) => v !== null && typeof v === 'object';
const flat = (v) => Object.values(v).every((x) => !isObj(x));
const oneLine = (v) => {
  if (Array.isArray(v))
    return v.length ? `[ ${v.map((x) => JSON.stringify(x)).join(', ')} ]` : '[]';
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return entries.length
    ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(', ')} }`
    : '{}';
};

function fmt(value, indent, prefixLen, width) {
  if (!isObj(value)) return JSON.stringify(value) ?? 'null';
  if (flat(value)) {
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

export function formatJSON(value, { width = 180 } = {}) {
  return fmt(value, '', 0, width) + '\n';
}
