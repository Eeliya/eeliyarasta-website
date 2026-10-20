/**
 * Rich text: the Text block's body (src/site/blocks/basic.js), a list of lines, each in one
 * of the site's text styles (TEXT_STYLES, ./layout/type.js), its text a list of runs:
 *
 *   "body": [
 *     { "style": "label", "text": [{ "t": "Photography" }] },
 *     { "style": "title", "text": [{ "t": "People" }, { "count": { "source": "people" } }] },
 *     { "style": "paragraph", "text": [
 *       { "t": "Portraits, " }, { "t": "mostly", "marks": ["i"] },
 *       { "t": " natural light. " }, { "t": "Contact", "link": { "page": "pg-k2x9" } },
 *       { "field": "name", "format": "by {value}" } ] }
 *   ]
 *
 * A run is one of:
 *   { t, marks?, link? }   text ("\n" a line break), marks: 'b' bold, 'i' italic, a link (a
 *                          page, an item or a URL: ./hrefs.js)
 *   { field, format? }     a field of the item the block shows (its source: ./layout/source.js),
 *                          filled in when the page is built; format "{value} photos"
 *   { count: { source } }  how many items a source has; { count: { of: 'items' } }: how many
 *                          the block's own source shows
 * One line is one element (h1 / h2 / h3 / p) with its style's class (.ts--<style>). Every
 * value is escaped; fields and counts are chips (data-field / data-count) the editor's inline
 * editor (src/editor/rich.js) keeps whole.
 *
 * Plain functions on the model (positions: { line, at }, `at` counting a chip as one
 * character and "\n" as one) are shared with the editor: they keep a body normalised (runs
 * that look the same merged, empty text runs dropped, at least one line).
 */
import { esc, pad } from './helpers.js';
import { isObject } from './is.js';

/** The styles a line can have, in the editor's picker order: [style, label, tag]. */
export const LINE_STYLES = [
  ['title', 'Title', 'h1'],
  ['heading', 'Heading', 'h2'],
  ['subheading', 'Subheading', 'h3'],
  ['statement', 'Statement', 'p'],
  ['paragraph', 'Paragraph', 'p'],
  ['label', 'Label', 'p'],
  ['small', 'Small', 'p'],
];
const STYLE_IDS = LINE_STYLES.map(([s]) => s);
export const tagOf = (style) => LINE_STYLES.find(([s]) => s === style)?.[2] || 'p';
export const styleLabel = (style) => LINE_STYLES.find(([s]) => s === style)?.[1] || style;
export const MARKS = ['b', 'i'];

const isText = (r) => isObject(r) && typeof r.t === 'string';
const isField = (r) => isObject(r) && typeof r.field === 'string';
const isCount = (r) => isObject(r) && isObject(r.count);
/** A run's length in positions: its text's, a chip's 1. */
export const runLength = (r) => (isText(r) ? r.t.length : 1);
export const lineLength = (line) => (line?.text || []).reduce((n, r) => n + runLength(r), 0);

// ---------------------------------------------------------------- shape

/** Problems of a body (validate.js), each "body…: …". */
export function checkBody(body, key = 'body') {
  if (!Array.isArray(body)) return [`"${key}" must be a list of lines [{ style, text: [runs] }]`];
  const out = [];
  body.forEach((line, i) => {
    const at = `${key}.${i}`;
    if (!isObject(line)) return void out.push(`"${at}" must be an object { style, text }`);
    if (!STYLE_IDS.includes(line.style))
      out.push(`"${at}.style" must be one of ${STYLE_IDS.join(', ')}`);
    if (!Array.isArray(line.text)) return void out.push(`"${at}.text" must be a list of runs`);
    line.text.forEach((r, j) => {
      const rat = `${at}.text.${j}`;
      if (isText(r)) {
        if (
          r.marks !== undefined &&
          !(Array.isArray(r.marks) && r.marks.every((m) => MARKS.includes(m)))
        )
          out.push(`"${rat}.marks" must be a list of ${MARKS.join(', ')}`);
        if (r.link !== undefined && !isObject(r.link))
          out.push(`"${rat}.link" must be a link object`);
      } else if (isField(r)) {
        if (!/^[\w-]+$/.test(r.field)) out.push(`"${rat}.field" must be a field name`);
        if (
          r.format !== undefined &&
          !(typeof r.format === 'string' && r.format.includes('{value}'))
        )
          out.push(`"${rat}.format" must be a text with {value} in it`);
      } else if (isCount(r)) {
        const c = r.count;
        if (!(typeof c.source === 'string' || c.of === 'items'))
          out.push(`"${rat}.count" must be { "source": "<source>" } or { "of": "items" }`);
      } else out.push(`"${rat}" must be { t }, { field } or { count }`);
    });
  });
  return out;
}

/** A body's plain text: its lines joined by "\n" (chips: fill(run) or ''). */
export function plainText(body, fill = () => '') {
  return (Array.isArray(body) ? body : [])
    .map((l) => (l?.text || []).map((r) => (isText(r) ? r.t : (fill(r) ?? ''))).join(''))
    .join('\n');
}

/** The plain text of the body's first line of `style` (a page's title), or undefined. */
export function lineText(body, style) {
  const line = (Array.isArray(body) ? body : []).find((l) => l?.style === style);
  if (!line || (line.text || []).some((r) => !isText(r))) return undefined;
  return (
    line.text
      .map((r) => r.t)
      .join('')
      .trim() || undefined
  );
}

/** A body from plain text: one line per paragraph (a blank line between them). */
export const bodyOf = (text, style = 'paragraph') =>
  String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ style, text: [{ t: p }] }));

// ---------------------------------------------------------------- render

const sameLook = (a, b) =>
  isText(a) &&
  isText(b) &&
  JSON.stringify([...(a.marks || [])].sort()) === JSON.stringify([...(b.marks || [])].sort()) &&
  JSON.stringify(a.link ?? null) === JSON.stringify(b.link ?? null);

/**
 * Render a body. opts:
 *   value(run)  a field or count run's value (text, '' when it has none)
 *   href(link)  a link's URL
 *   editing     chips show what they are (the field's name) and can't be typed into
 *   attrs(i)    extra attributes of line i's element (data-anim)
 *   lead(i)     HTML before line i's text (a numbered label's "(01) ")
 */
export function renderBody(
  body,
  { value = () => '', href = () => '#', editing = false, attrs = () => '', lead = () => '' } = {},
) {
  const lines = Array.isArray(body) && body.length ? body : [{ style: 'paragraph', text: [] }];
  return lines
    .map((line, i) => {
      const style = STYLE_IDS.includes(line?.style) ? line.style : 'paragraph';
      const tag = tagOf(style);
      const runs = (line?.text || []).map((r) => renderRun(r, { value, href, editing })).join('');
      // an empty line keeps its height (and a caret) with a <br>
      return `<${tag} class="ts ts--${style}" data-line="${style}"${attrs(i, style)}>${lead(i, style)}${runs || '<br>'}</${tag}>`;
    })
    .join('');
}

function renderRun(r, { value, href, editing }) {
  if (isText(r)) {
    let out = esc(r.t).replace(/\n/g, '<br>');
    const marks = r.marks || [];
    if (marks.includes('i')) out = `<em>${out}</em>`;
    if (marks.includes('b')) out = `<strong>${out}</strong>`;
    if (r.link)
      out = `<a href="${esc(href(r.link))}" data-link="${esc(JSON.stringify(r.link))}">${out}</a>`;
    return out;
  }
  const ce = editing ? ' contenteditable="false"' : '';
  if (isField(r)) {
    const v = editing ? r.field : value(r);
    const fmt = r.format ? ` data-format="${esc(r.format)}"` : '';
    return `<span class="ts__chip" data-field="${esc(r.field)}"${fmt}${ce}>${esc(v)}</span>`;
  }
  if (isCount(r)) {
    const v = editing ? `#${r.count.source || 'items'}` : value(r);
    return `<sup class="ts__count" data-count="${esc(JSON.stringify(r.count))}"${ce}>${esc(v)}</sup>`;
  }
  return '';
}

/** A count's value as the site shows it: "04". */
export const countText = (n) => (Number.isInteger(n) ? pad(n) : '');

/** A field run's value: the item's value in its format; '' without one. */
export function fieldText(run, item) {
  const v = item?.[run.field];
  if (v === undefined || v === null || v === '' || typeof v === 'object') return '';
  return typeof run.format === 'string' ? run.format.replaceAll('{value}', String(v)) : String(v);
}

// ---------------------------------------------------------------- model edits

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Runs normalised: same-looking text runs merged, empty ones dropped. */
export function tidyRuns(runs) {
  const out = [];
  for (const r of runs) {
    if (isText(r)) {
      if (!r.t) continue;
      const c = { t: r.t };
      if (r.marks?.length) c.marks = MARKS.filter((m) => r.marks.includes(m));
      if (r.link) c.link = r.link;
      const last = out.at(-1);
      if (last && sameLook(last, c)) last.t += c.t;
      else out.push(c);
    } else out.push(r);
  }
  return out;
}

/** Line `i`'s runs split at `at`: [before, after]. */
function splitRuns(runs, at) {
  const a = [];
  const b = [];
  let n = 0;
  for (const r of runs) {
    const len = runLength(r);
    if (n + len <= at) a.push(r);
    else if (n >= at) b.push(r);
    else {
      a.push({ ...r, t: r.t.slice(0, at - n) });
      b.push({ ...r, t: r.t.slice(at - n) });
    }
    n += len;
  }
  return [a, b];
}

/** Positions in order (a before b). */
const ordered = (a, b) =>
  a.line < b.line || (a.line === b.line && a.at <= b.at) ? [a, b] : [b, a];

/**
 * fn(run) over the text runs between `from` and `to` (positions; a collapsed range: none),
 * the runs cut at its ends. Returns the new body.
 */
function mapRange(body, from, to, fn) {
  const [s, e] = ordered(from, to);
  const out = clone(body);
  for (let i = s.line; i <= e.line; i++) {
    const line = out[i];
    if (!line) continue;
    const len = lineLength(line);
    const a = i === s.line ? s.at : 0;
    const b = i === e.line ? e.at : len;
    if (b <= a) continue;
    const [head, rest] = splitRuns(line.text, a);
    const [mid, tail] = splitRuns(rest, b - a);
    line.text = tidyRuns([...head, ...mid.map((r) => (isText(r) ? fn(r) : r)), ...tail]);
  }
  return out;
}

/** The text runs of a range (for the toolbar: is it all bold?). */
export function runsIn(body, from, to) {
  const [s, e] = ordered(from, to);
  const got = [];
  mapRange(body, s, e, (r) => (got.push(r), r));
  return got;
}

/** Is every text of the range marked `mark`? (false for an empty range) */
export function hasMark(body, from, to, mark) {
  const runs = runsIn(body, from, to);
  return runs.length > 0 && runs.every((r) => r.marks?.includes(mark));
}

/** Mark `mark` toggled over a range: all marked already: off, else on. */
export function toggleMark(body, from, to, mark) {
  const on = !hasMark(body, from, to, mark);
  return mapRange(body, from, to, (r) => {
    const marks = new Set(r.marks || []);
    if (on) marks.add(mark);
    else marks.delete(mark);
    const { marks: _, ...rest } = r; // eslint-disable-line no-unused-vars
    return marks.size ? { ...rest, marks: [...marks] } : rest;
  });
}

/** A link over a range (null: removed). */
export function setLink(body, from, to, link) {
  return mapRange(body, from, to, (r) => {
    const { link: _, ...rest } = r; // eslint-disable-line no-unused-vars
    return link ? { ...rest, link } : rest;
  });
}

/** The link of a range's first text run, or null. */
export const linkIn = (body, from, to) => runsIn(body, from, to).find((r) => r.link)?.link ?? null;

/** Line `i`'s style set (the whole line: a style is a paragraph's). */
export function setStyle(body, i, style) {
  const out = clone(body.length ? body : [{ style: 'paragraph', text: [] }]);
  if (out[i] && STYLE_IDS.includes(style)) out[i].style = style;
  return out;
}

/** A chip run (a field or a count) put in at a position. */
export function insertRun(body, pos, run) {
  const out = clone(body.length ? body : [{ style: 'paragraph', text: [] }]);
  const line = out[Math.min(pos.line, out.length - 1)];
  const [a, b] = splitRuns(line.text, pos.at);
  line.text = tidyRuns([...a, run, ...b]);
  return out;
}

/** Line `pos.line` split at `pos.at` (Enter): the new line after it, in the same style. */
export function splitLine(body, pos) {
  const out = clone(body.length ? body : [{ style: 'paragraph', text: [] }]);
  const line = out[pos.line];
  if (!line) return out;
  const [a, b] = splitRuns(line.text, pos.at);
  line.text = tidyRuns(a);
  out.splice(pos.line + 1, 0, { style: line.style, text: tidyRuns(b) });
  return out;
}

/** Lines normalised (validate-clean): a style each, tidy runs. */
export const tidyBody = (body) =>
  (Array.isArray(body) ? body : []).map((l) => ({
    style: STYLE_IDS.includes(l?.style) ? l.style : 'paragraph',
    text: tidyRuns(Array.isArray(l?.text) ? l.text : []),
  }));
