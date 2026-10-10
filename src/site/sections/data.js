/** Data helpers shared by section types. */
import { warnOnce } from '../helpers.js';
import { TEMPLATE, sourceFile } from '../files.js';
import { pathOfId } from '../routes.js';

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

/**
 * The page that shows all of a source ("See all" links): the folder of the [slug] page of
 * that source, else the first page (not home) with a section of it, else /<source>/. So a
 * renamed page keeps its links.
 */
export function sourcePage(ctx, source) {
  const ids = Object.keys(ctx.pages || {}).sort();
  const page = (id) => ctx.pages[id];
  const tpl = ids.find((id) => id.endsWith(TEMPLATE) && page(id)?.config?.source === source);
  if (tpl) return pathOfId(tpl);
  const lists = ids.find(
    (id) =>
      id !== 'home' &&
      !id.endsWith(TEMPLATE) &&
      page(id)?.sections?.some?.((s) => s?.config?.source === source),
  );
  return lists ? pathOfId(lists) : `/${source}/`;
}
