/**
 * Where a photo is used: every string value equal to its media/ path or R2 key in the content
 * files ({ "sources/people.json": data, ... }), as [{ file, ptr }]. The editor (Media window,
 * on the unsaved content) and the dev server (before a delete, on the files on disk) share it.
 */
import { compile } from './pointer.js';

export function photoUses(files, key) {
  const out = [];
  const walk = (file, v, parts) => {
    if (v === key) out.push({ file, ptr: compile(parts) });
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(file, x, [...parts, k]);
  };
  if (key) for (const [file, data] of Object.entries(files)) walk(file, data, []);
  return out;
}
