/**
 * Minimal structural diff/patch, used to re-apply local edits on top of a newer
 * remote version of a file before committing (so nobody's changes get clobbered).
 */
import { set, remove } from './pointer.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const clone = (v) => (v === undefined ? undefined : structuredClone(v));
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Leaf-level operations turning `a` into `b`: [{ path: [...], value }] (value undefined = delete). */
export function diff(a, b, path = []) {
  if (equal(a, b)) return [];
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => (k in b ? diff(a[k], b[k], [...path, k]) : [{ path: [...path, k], value: undefined }]));
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.flatMap((x, i) => diff(x, b[i], [...path, i]));
  return [{ path, value: clone(b) }];
}

export function patch(obj, ops) {
  let out = clone(obj);
  for (const { path, value } of ops) {
    if (!path.length) out = clone(value);
    else if (value === undefined) remove(out, path);
    else set(out, path, clone(value));
  }
  return out;
}
