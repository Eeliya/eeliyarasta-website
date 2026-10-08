/** JSON Pointer (RFC 6901) helpers: "/sections/people/title" <-> ['sections', 'people', 'title']. */
export const parse = (ptr) =>
  !ptr ? [] : ptr.slice(1).split('/').map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));

export const compile = (parts) => parts.map((p) => '/' + String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('');

export function get(obj, ptr) {
  let cur = obj;
  for (const k of Array.isArray(ptr) ? ptr : parse(ptr)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

/** Set a value, creating intermediate objects. */
export function set(obj, ptr, value) {
  const parts = Array.isArray(ptr) ? ptr : parse(ptr);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts.at(-1)] = value;
}

/**
 * Remove a value. Empty parent objects are removed too, but never the first
 * `keep` path segments (e.g. keep=1 for "/elements/<key>/from/y" keeps "elements").
 */
export function remove(obj, ptr, { keep = 0 } = {}) {
  const parts = Array.isArray(ptr) ? ptr : parse(ptr);
  const chain = [obj];
  for (let i = 0; i < parts.length - 1; i++) {
    const next = chain.at(-1)?.[parts[i]];
    if (next === null || typeof next !== 'object') return;
    chain.push(next);
  }
  const parent = chain.at(-1);
  if (Array.isArray(parent)) parent.splice(Number(parts.at(-1)), 1);
  else delete parent[parts.at(-1)];
  for (let i = parts.length - 1; i > keep; i--) {
    const node = chain[i];
    if (node && typeof node === 'object' && !Array.isArray(node) && !Object.keys(node).length) delete chain[i - 1][parts[i - 1]];
    else break;
  }
}
