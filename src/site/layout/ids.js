/**
 * Stable ids of sections ("s-k3x9") and blocks ("b-7qpa"): given once, when a section or
 * block is made, and kept when it moves or its content changes. The editor finds a section
 * or block in the preview by its id; later, bindings and animations will point at them too.
 */

export const ID = { section: 's', block: 'b' };

/** Is `id` a section (kind 's') or block ('b') id? */
export const isId = (id, kind) => new RegExp(`^${kind}-[a-z0-9]{4,12}$`).test(String(id ?? ''));

/** A new id of `kind` ('s' or 'b') not in `taken` (a Set of ids), then added to it. */
export function newId(kind, taken = new Set()) {
  for (;;) {
    const id = `${kind}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`;
    if (taken.has(id)) continue;
    taken.add(id);
    return id;
  }
}

/** Every block of a page (its sections' blocks, in order). */
export const blocksOf = (page) =>
  (Array.isArray(page?.sections) ? page.sections : []).flatMap((s) =>
    Array.isArray(s?.blocks) ? s.blocks : [],
  );

/** Every section and block id of a page's sections. */
export function idsOf(sections) {
  const ids = new Set();
  for (const s of Array.isArray(sections) ? sections : []) {
    if (s?.id) ids.add(s.id);
    for (const b of Array.isArray(s?.blocks) ? s.blocks : []) if (b?.id) ids.add(b.id);
  }
  return ids;
}
