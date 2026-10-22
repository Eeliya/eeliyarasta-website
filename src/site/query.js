/**
 * Which items of a source a widget shows, from the page's address (a widget's From URL source,
 * src/site/layout/source.js; the main widget of a [param] page decides which pages exist,
 * src/site/routes.js). The one query the build, the preview and the editor share.
 *
 *   where   { "op": "and", "rules": [{ "param": "person", "field": "person" }, ...] }
 *           a rule: the item's `field` equals the page's value of `param` (its URL part);
 *           a param without a rule ("Any") doesn't filter. A rule can be a group itself
 *           ({ op: 'and' | 'or', rules }), so more kinds of rules can come later.
 *   params  the page's values: { person: "noor-vermeer", year: "2018" }
 *
 * A field's value is compared as a URL part: "slug" is the item's slug (itemSlug: its schema's
 * slug field, else its name slugified), any other field its value slugified ("2018", "Noor
 * Vermeer" -> "noor-vermeer"). refs: { person: "p-qw7b" } also lets a field that holds the id
 * of the param's item match (a reference to another source's item).
 */
import { itemSlug, slugify } from './helpers.js';

export const SLUG = 'slug';

/** The rules of `where` ([] when there are none). */
export const rulesOf = (where) => (Array.isArray(where?.rules) ? where.rules : []);

/** The rule of `param` in `where` (top level), else undefined: Any. */
export const ruleOf = (where, param) => rulesOf(where).find((r) => r?.param === param);

/** `field` of `item` as a URL part ('' when empty). */
export function valueOf(item, field, schema) {
  if (field === SLUG) return itemSlug(item, schema || {});
  const v = item?.[field];
  return v === undefined || v === null ? '' : slugify(String(v));
}

/** Does `field` exist on items of `schema` ("slug" always does)? */
export const hasField = (schema, field) =>
  field === SLUG || (schema?.fields || []).some((f) => f.key === field);

/** A param's default field: the source's field of the same name, else slug. */
export const defaultField = (param, schema) =>
  param !== SLUG && hasField(schema, param) ? param : SLUG;

/** `where` for the params of an address, each on its default field. */
export const defaultWhere = (params, schema) => ({
  op: 'and',
  rules: params.map((param) => ({ param, field: defaultField(param, schema) })),
});

function test(node, item, params, opts) {
  if (Array.isArray(node?.rules)) {
    const each = (r) => test(r, item, params, opts);
    return node.op === 'or' ? node.rules.some(each) : node.rules.every(each);
  }
  if (typeof node?.param !== 'string' || typeof node.field !== 'string') return false;
  const want = params?.[node.param];
  if (want === undefined) return true; // the page has no such param: nothing to match
  if (valueOf(item, node.field, opts.schema) === String(want)) return true;
  const ref = opts.refs?.[node.param];
  return ref !== undefined && ref !== '' && String(item?.[node.field] ?? '') === String(ref);
}

/** Does `item` match `where` for the page's `params`? */
export const matches = (item, where, params, { schema, refs } = {}) =>
  test(where || { rules: [] }, item, params, { schema, refs });

/** The items of `list` that match `where` for `params`, in their order. */
export const query = (list, where, params, opts = {}) =>
  (Array.isArray(list) ? list : []).filter((item) => matches(item, where, params, opts));

/**
 * What keeps a main widget from deciding pages, per param of the address: [{ param, problem }]
 * with problem 'any' (no rule: it would make the same page under many addresses) or 'missing'
 * (its field isn't in the source). [] when every param matches a field.
 */
export const unmatched = (where, params, schema) =>
  params.flatMap((param) => {
    const rule = ruleOf(where, param);
    if (!rule) return [{ param, problem: 'any' }];
    return hasField(schema, rule.field) ? [] : [{ param, problem: 'missing', field: rule.field }];
  });
