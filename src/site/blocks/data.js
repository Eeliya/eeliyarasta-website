/** Data helpers shared by block types. */
import { warnOnce } from '../helpers.js';
import { isTemplate, paramsOf, sourceFile } from '../files.js';
import { parentId, pathOfId } from '../routes.js';
import { blocksOf } from '../layout/ids.js';

/**
 * The list a block pulls from: content/en/sources/<source>.json. A missing file or one that
 * isn't a top-level array warns and gives [] (the block renders empty).
 */
export function sourceList(ctx, source) {
  const list = ctx.sources?.[source];
  if (Array.isArray(list)) return list;
  warnOnce(
    `source "content/${sourceFile(source)}" ${list === undefined ? 'is missing' : 'is not a JSON array'}; the block renders empty.`,
    'sections',
  );
  return [];
}

/**
 * The page that shows all of a source ("See all" links): the folder of the [param] page of
 * that source (one not inside another), else the first page (not home) with a block of it, else /<source>/. So a
 * renamed page keeps its links.
 */
export function sourcePage(ctx, source) {
  const ids = Object.keys(ctx.pages || {}).sort();
  const page = (id) => ctx.pages[id];
  const tpl = ids.find(
    (id) => paramsOf(id).length === 1 && isTemplate(id) && page(id)?.template?.source === source,
  );
  if (tpl) return pathOfId(parentId(tpl));
  const lists = ids.find(
    (id) =>
      id !== 'home' &&
      !paramsOf(id).length &&
      blocksOf(page(id)).some((b) => b?.config?.source === source),
  );
  return lists ? pathOfId(lists) : `/${source}/`;
}
