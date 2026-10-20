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
import { linkProblem } from './hrefs.js';

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
        if (r.link !== undefined) {
          const bad = linkProblem(r.link);
          if (bad) out.push(`"${rat}.link": ${bad}`);
        }
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
      // the site: just its URL (made at build time); while edited, the link itself
      // (data-ts-link: rich.js reads it back), never in the site's HTML
      out = editing
        ? `<a href="#" data-ts-link="${esc(JSON.stringify(r.link))}">${out}</a>`
        : `<a href="${esc(href(r.link))}">${out}</a>`;
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

// Enter at the end of one of these starts body text (a Paragraph), not another of them
const LEAD_STYLES = new Set(['title', 'heading', 'subheading', 'statement', 'label']);

/**
 * Line `pos.line` split at `pos.at` (Enter): the new line after it. Mid-line both halves keep
 * the style; at the end of a title, heading, subheading, statement or label the new line is a
 * Paragraph (what follows a heading is text); after a paragraph or small text, the same.
 */
export function splitLine(body, pos) {
  const out = clone(body.length ? body : [{ style: 'paragraph', text: [] }]);
  const line = out[pos.line];
  if (!line) return out;
  const [a, b] = splitRuns(line.text, pos.at);
  line.text = tidyRuns(a);
  const atEnd = !tidyRuns(b).length && tidyRuns(a).length > 0;
  const style = atEnd && LEAD_STYLES.has(line.style) ? 'paragraph' : line.style;
  out.splice(pos.line + 1, 0, { style, text: tidyRuns(b) });
  return out;
}

/** Lines normalised (validate-clean): a style each, tidy runs. */
export const tidyBody = (body) =>
  (Array.isArray(body) ? body : []).map((l) => ({
    style: STYLE_IDS.includes(l?.style) ? l.style : 'paragraph',
    text: tidyRuns(Array.isArray(l?.text) ? l.text : []),
  }));

/** The range between two positions taken out (its lines joined): the new body. */
export function deleteRange(body, from, to) {
  const [s, e] = ordered(from, to);
  const out = clone(body);
  if (!out[s.line] || !out[e.line]) return out;
  const [head] = splitRuns(out[s.line].text, s.at);
  const [, tail] = splitRuns(out[e.line].text, e.at);
  out.splice(s.line, e.line - s.line + 1, {
    style: out[s.line].style,
    text: tidyRuns([...head, ...tail]),
  });
  return out;
}

/**
 * Pasted lines ([{ style, text }], pastedLines) put in over a selection: one line goes into
 * the caret's line; more each become their own line between its two halves (an empty half
 * goes). Returns { body, at } (at: the caret after them).
 */
export function insertLines(body, from, to, lines) {
  const base = deleteRange(body.length ? body : [{ style: 'paragraph', text: [] }], from, to);
  const [s] = ordered(from, to);
  const pos = { line: Math.min(s.line, base.length - 1), at: s.at };
  const line = base[pos.line];
  const [head, tail] = splitRuns(line.text, pos.at);
  if (!lines.length) return { body: base, at: pos };
  if (lines.length === 1) {
    line.text = tidyRuns([...head, ...lines[0].text, ...tail]);
    return {
      body: base,
      at: { line: pos.line, at: pos.at + lineLength(lines[0]) },
    };
  }
  const mid = lines.map((l) => ({ style: l.style, text: tidyRuns(l.text) }));
  const parts = [
    ...(head.length ? [{ style: line.style, text: tidyRuns(head) }] : []),
    ...mid,
    ...(tail.length ? [{ style: line.style, text: tidyRuns(tail) }] : []),
  ];
  base.splice(pos.line, 1, ...parts);
  const last = pos.line + (head.length ? 1 : 0) + mid.length - 1;
  return { body: base, at: { line: last, at: lineLength(base[last]) } };
}

/**
 * Plain pasted text as lines: a blank line starts a new Paragraph line, a single newline is a
 * line break in it.
 */
export function plainLines(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/[ \t]+\n|\n[ \t]+/g, '\n').trim())
    .filter(Boolean)
    .map((p) => ({ style: 'paragraph', text: [{ t: p }] }));
}

const BLOCK_TAGS = new Set(
  'P DIV H1 H2 H3 H4 H5 H6 LI UL OL BLOCKQUOTE PRE SECTION ARTICLE HEADER FOOTER TABLE TR FIGURE FIGCAPTION DL DT DD HR ADDRESS MAIN ASIDE NAV'.split(
    ' ',
  ),
);
const SKIP_TAGS = new Set(
  'SCRIPT STYLE META TITLE HEAD LINK NOSCRIPT TEMPLATE IFRAME OBJECT SVG IMG'.split(' '),
);

/**
 * Pasted HTML (a parsed DOM tree: any node with nodeType, tagName, childNodes, getAttribute,
 * style) as lines: every block (a paragraph, a heading, a list item, …) its own Paragraph
 * line, <br> a line break in it; only bold, italic and safe links kept (no styles, fonts,
 * colours or sizes). `safe(href)`: is the link allowed (hrefs.js isSafeHref).
 */
export function htmlLines(root, safe) {
  const lines = [];
  let cur = null;
  const pre = { on: 0 };
  const close = () => {
    if (cur) {
      // spaces at a line's edges and around its breaks go
      const runs = tidyRuns(cur);
      if (runs.length && isText(runs[0]))
        runs[0] = { ...runs[0], t: runs[0].t.replace(/^\s+/, '') };
      const z = runs.at(-1);
      if (z && isText(z)) runs[runs.length - 1] = { ...z, t: z.t.replace(/\s+$/, '') };
      const text = tidyRuns(
        runs.map((r) => (isText(r) ? { ...r, t: r.t.replace(/ ?\n ?/g, '\n') } : r)),
      );
      if (text.length) lines.push({ style: 'paragraph', text });
    }
    cur = null;
  };
  const push = (t, marks, link) => {
    if (!t) return;
    cur = cur || [];
    cur.push({
      t,
      ...(marks.length ? { marks: MARKS.filter((m) => marks.includes(m)) } : {}),
      ...(link ? { link } : {}),
    });
  };
  const walk = (n, marks, link) => {
    if (n.nodeType === 3) {
      let t = String(n.textContent ?? n.nodeValue ?? '').replace(/\u00a0/g, ' ');
      if (!pre.on) t = t.replace(/\s+/g, ' ');
      if (!cur && !t.trim()) return; // whitespace between blocks
      push(t, marks, link);
      return;
    }
    if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
    const tag = String(n.tagName || '').toUpperCase();
    if (SKIP_TAGS.has(tag)) return;
    if (tag === 'BR') {
      push('\n', marks, link);
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) close();
    const style = n.style || {};
    const weight = String(style.fontWeight || '');
    const next = [...marks];
    const bold =
      tag === 'B' ||
      tag === 'STRONG' ||
      weight === 'bold' ||
      weight === 'bolder' ||
      Number(weight) >= 600;
    // a Google Docs paste wraps everything in <b style="font-weight:normal">
    const notBold = weight === 'normal' || (weight && Number(weight) < 600);
    if (bold && !notBold && !next.includes('b')) next.push('b');
    if ((tag === 'I' || tag === 'EM' || style.fontStyle === 'italic') && !next.includes('i'))
      next.push('i');
    let nl = link;
    if (tag === 'A') {
      const href = (n.getAttribute?.('href') || '').trim();
      nl = href && safe(href) ? { href } : null;
    }
    if (tag === 'PRE') pre.on++;
    for (const c of n.childNodes || []) walk(c, next, nl);
    if (tag === 'PRE') pre.on--;
    if (block) close();
  };
  walk(root, [], null);
  close();
  return lines;
}
