/**
 * Test helpers: a block written flat ({ pos, link, phone } next to its other keys) as
 * content stores it ({ layout: { base, phone } }, rows only when its size stores them), and
 * back (flat) for assertions.
 */
import { storesRows } from '../src/site/layout/grid.js';

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function lay(b) {
  const { pos, link, phone, ...rest } = b;
  if (rest.layout) return b;
  const keep = storesRows(rest);
  const base = clean({ ...(pos || { col: 1, span: 120, row: 1 }), link });
  if (!keep) delete base.rows;
  const out = { ...rest, layout: { base } };
  if (phone === null) out.layout.phone = null;
  else if (phone) {
    const ph = clean({ ...phone });
    if (!keep) delete ph.rows;
    out.layout.phone = ph;
  }
  return out;
}

export function flat(b) {
  const { layout, ...rest } = b || {};
  const { link, ...pos } = layout?.base || {};
  return clean({ ...rest, pos, link, phone: layout?.phone });
}
