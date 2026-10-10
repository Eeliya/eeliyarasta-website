/** Data helpers shared by section types. */
import { warnOnce } from '../helpers.js';
import { sourceFile } from '../files.js';

/**
 * The list a section pulls from: content/sources/<source>.json. A missing file or one that
 * isn't a top-level array warns and gives [] (the section renders empty).
 */
export function sourceList(ctx, source) {
  const list = ctx.sources?.[source];
  if (Array.isArray(list)) return list;
  warnOnce(
    `source "content/${sourceFile(source)}" ${list === undefined ? 'is missing' : 'is not a JSON array'}; the section renders empty.`,
    'sections',
  );
  return [];
}
