/**
 * A block's source: the items it shows (its bound fields the first one, a list block all of
 * them). Stored on the block as "source", one of:
 *
 *   { "mode": "item", "from": "people", "id": "p-qw7b" }   one item, picked
 *   { "mode": "all",  "from": "people" }                   every item (list blocks only)
 *   { "mode": "url",  "from": "shoots", "where": { "op": "and", "rules": [...] } }
 *                                                          the items matching the page's
 *                                                          address (src/site/query.js)
 *   no "source"                                            None: the block's own texts
 *
 * Field blocks (a type without `list`) offer Item / From URL / None, list blocks (`list: true`:
 * album cards, grids, project lists) All / From URL / None. From URL only on a [param] page:
 * every param of its address has a row (a rule) or is Any (no rule).
 *
 * The main block of a [param] page ("main": "<block id>" in its index.json) decides which pages
 * exist (src/site/routes.js): one per value its rules give the page's own param, among the
 * items that match the params above; a page exists when at least one item matches. It must be
 * From URL with a rule for every param (no Any): else no pages are built (mainProblem says why).
 */
import { isTemplate, paramsOf } from '../files.js';
import { isObject } from '../is.js';
import { schemaOf } from '../schemas.js';
import { defaultWhere, query, unmatched } from '../query.js';
import { blocksOf, eachBlock } from './ids.js';

export const MODES = ['item', 'all', 'url'];

/** The block's source ({ mode, from, id?, where? }), null for None (or a broken one). */
export const sourceOf = (block) => {
  const s = block?.source;
  return isObject(s) && MODES.includes(s.mode) && typeof s.from === 'string' && s.from ? s : null;
};

/** The source list `from` of a context or content ([] when it isn't one). */
const listOf = (ctx, from) => (Array.isArray(ctx?.sources?.[from]) ? ctx.sources[from] : []);

/**
 * What a block shows: { source, items, item, index, indexOf }: its source's id, its items, the
 * first (its bound fields') and that one's index in the source (indexOf: any item's, for the
 * editor's markers); source null and items [] for None.
 * route: the page's (its params on a [param] page, the ids of their items as refs).
 */
export function blockItems(ctx, route, block) {
  const s = sourceOf(block);
  if (!s) return { source: null, items: [], item: null, index: -1, indexOf: () => -1 };
  const list = listOf(ctx, s.from);
  let items = list;
  if (s.mode === 'item') items = list.filter((it) => it?.id === s.id).slice(0, 1);
  else if (s.mode === 'url')
    items = query(list, s.where, route?.params || {}, {
      schema: schemaOf(ctx, s.from),
      refs: refsOf(route),
    });
  const item = items[0] ?? null;
  const indexOf = (it) => list.indexOf(it);
  return { source: s.from, items, item, index: item ? indexOf(item) : -1, indexOf };
}

/** The ids of a page's param items ({ person: "p-qw7b" }): what a reference field can hold. */
export const refsOf = (route) =>
  Object.fromEntries(Object.entries(route?.items || {}).map(([p, it]) => [p, it?.id]));

/** The main block of a page (its "main" block id), null when there is none. */
export const mainOf = (page) =>
  (typeof page?.main === 'string' && blocksOf(page).find((b) => b?.id === page.main)) || null;

/** Where the main block sits: { block, at, j } (null without one). */
export function mainAt(page) {
  if (typeof page?.main !== 'string') return null;
  for (const [block, , at, j] of eachBlock(page?.sections))
    if (block?.id === page.main) return { block, at, j };
  return null;
}

/** The source a [param] page's items come from: its main block's (null without one). */
export const pageSourceOf = (page) => sourceOf(mainOf(page))?.from ?? null;

/**
 * Why [param] page `id` builds no pages, or null when its main block can decide them:
 * { kind, message, param?, field? }. kind: 'none' (no main block), 'mode' (not From URL),
 * 'source' (its source isn't a list), 'any' / 'missing' (a param without a rule, or one whose
 * field the source doesn't have: param names it). The message is the page head's warning.
 */
export function mainProblem(content, id) {
  if (!isTemplate(id)) return null;
  const page = content?.pages?.[id];
  const main = mainOf(page);
  const say = (kind, why, more = {}) => ({ kind, message: `No pages are built: ${why}`, ...more });
  if (!main) return say('none', 'pick the main block');
  const s = sourceOf(main);
  if (s?.mode !== 'url') return say('mode', 'the main block isn’t From URL');
  if (!Array.isArray(content?.sources?.[s.from]))
    return say('source', 'the main block’s source is missing');
  const [first] = unmatched(s.where, paramsOf(id), schemaOf(content, s.from));
  if (!first) return null;
  return first.problem === 'any'
    ? say('any', `[${first.param}] needs a field to match`, first)
    : say('missing', `[${first.param}] matches no field`, first);
}

/** A From URL source of `from` on a page with `params`: each param on its default field. */
export const urlSource = (content, from, params) => ({
  mode: 'url',
  from,
  where: defaultWhere(params, schemaOf(content, from)),
});

/**
 * A new block's source fitted to its page (Add block): From URL on a [param] page matches
 * every param of its address (its default fields); on a page without params From URL can't
 * be, so a list shows All and one item its source's first (no item: None, undefined).
 * Item and All stay as they are.
 */
export function fitSource(source, { list = false, params = [], content } = {}) {
  const s = sourceOf({ source });
  if (!s) return undefined;
  if (s.mode !== 'url') return s;
  if (params.length) return urlSource(content, s.from, params);
  if (list) return { mode: 'all', from: s.from };
  const first = listOf(content, s.from).find((it) => typeof it?.id === 'string');
  return first ? { mode: 'item', from: s.from, id: first.id } : undefined;
}
