/**
 * The Text widget's inline editor (src/site/text.js has the model): a lean contenteditable
 * over the widget's rendered lines in the preview. Typing is the browser's; after each input
 * the lines are read back into the model (readBody). Everything else (a line's style, bold,
 * italic, a link, a field or count chip, Enter) is an edit of the model (text.js), after
 * which the lines are rendered again and the selection put back where it was, by model
 * position ({ line, at }: a chip counts as one, a line break as one).
 *
 * The DOM it reads: one element per line ([data-line="<style>"]) under the body; in a line
 * text, <br> (a line break), <strong>/<b>, <em>/<i>, <a data-ts-link> and the chips
 * ([data-field], [data-count]: atomic, contenteditable=false). Anything else the browser
 * makes (a pasted <div>, a <span style>) is read as its text, so the model stays clean.
 */
import { MARKS, renderBody, tidyBody } from '../site/text.js';
import { isSafeHref, linkProblem } from '../site/hrefs.js';

const LINE = '[data-line]';
const isChip = (n) =>
  n.nodeType === 1 && (n.dataset.field !== undefined || n.dataset.count !== undefined);
const isNum = (n) => n.nodeType === 1 && n.classList.contains('ts__num');

/** The model of a rendered (and typed into) body element. */
export function readBody(root) {
  const lines = [];
  const lineEls = [...root.children].filter((n) => n.matches(LINE));
  // (text typed outside any line, the browser's: a paragraph)
  const els = lineEls.length ? [...root.childNodes] : [root];
  let loose = null;
  for (const n of els) {
    if (n.nodeType === 1 && n.matches(LINE)) {
      loose = null;
      lines.push({ style: n.dataset.line, text: readRuns(n) });
    } else if (n !== root && (n.nodeType === 3 ? n.textContent : true)) {
      if (n.nodeType === 1 && n.tagName === 'BR') continue;
      if (!loose) lines.push((loose = { style: 'paragraph', text: [] }));
      loose.text.push(...readRuns(n, [], null, true));
    } else if (n === root) lines.push({ style: 'paragraph', text: readRuns(root) });
  }
  return tidyBody(lines);
}

function readRuns(node, marks = [], link = null, self = false) {
  const out = [];
  const walk = (n, m, l) => {
    if (n.nodeType === 3) {
      const t = n.textContent.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
      if (t) out.push({ t, ...(m.length ? { marks: [...m] } : {}), ...(l ? { link: l } : {}) });
      return;
    }
    if (n.nodeType !== 1 || isNum(n)) return;
    if (isChip(n)) {
      if (n.dataset.field !== undefined)
        out.push({
          field: n.dataset.field,
          ...(n.dataset.format ? { format: n.dataset.format } : {}),
        });
      else out.push({ count: JSON.parse(n.dataset.count) });
      return;
    }
    if (n.tagName === 'BR') {
      // a line's last <br> is the browser's placeholder, not a line break
      if (n.nextSibling || n.parentNode !== node)
        out.push({ t: '\n', ...(m.length ? { marks: [...m] } : {}) });
      return;
    }
    const tag = n.tagName;
    const next = [...m];
    if ((tag === 'STRONG' || tag === 'B') && !next.includes('b')) next.push('b');
    if ((tag === 'EM' || tag === 'I') && !next.includes('i')) next.push('i');
    let nl = l;
    if (tag === 'A') {
      // our own links carry theirs; one the browser made: its href, when it is a safe one
      let own = null;
      try {
        own = n.dataset.tsLink ? JSON.parse(n.dataset.tsLink) : null;
      } catch {
        /* not ours */
      }
      const href = (n.getAttribute('href') || '').trim();
      nl = own && !linkProblem(own) ? own : href && isSafeHref(href) ? { href } : null;
    }
    for (const c of n.childNodes) walk(c, next, nl);
  };
  if (self) walk(node, marks, link);
  else for (const c of node.childNodes) walk(c, marks, link);
  return out.map((r) => (r.marks ? { ...r, marks: MARKS.filter((x) => r.marks.includes(x)) } : r));
}

/** The line elements of a body element. */
const linesOf = (root) => [...root.children].filter((n) => n.matches(LINE));

/** The length a node adds to its line. */
function lengthOf(n) {
  if (n.nodeType === 3) return n.textContent.replace(/\u200b/g, '').length;
  if (n.nodeType !== 1 || isNum(n)) return 0;
  if (isChip(n)) return 1;
  if (n.tagName === 'BR') return n.nextSibling || !n.parentElement?.matches(LINE) ? 1 : 0;
  let len = 0;
  for (const c of n.childNodes) len += lengthOf(c);
  return len;
}

/** A DOM point (node, offset) inside `root` as a model position, or null. */
export function posOf(root, node, offset) {
  const lines = linesOf(root);
  const lineEl = (node.nodeType === 1 ? node : node.parentElement)?.closest(LINE);
  const line = lines.indexOf(lineEl);
  if (line < 0) {
    if (node === root) {
      const i = Math.min(offset, lines.length - 1);
      return i < 0 ? null : { line: i, at: offset >= lines.length ? lengthOf(lines[i]) : 0 };
    }
    return null;
  }
  let at = 0;
  let found = false;
  const walk = (n) => {
    if (found) return;
    if (n === node) {
      if (n.nodeType === 3) at += Math.min(offset, n.textContent.length);
      else
        for (let k = 0; k < offset && k < n.childNodes.length; k++) at += lengthOf(n.childNodes[k]);
      found = true;
      return;
    }
    if (n.nodeType === 1 && (isChip(n) || isNum(n))) {
      // inside a chip: its end
      if (n.contains(node)) {
        at += isChip(n) ? 1 : 0;
        found = true;
        return;
      }
      at += lengthOf(n);
      return;
    }
    if (n.nodeType === 3 || n.tagName === 'BR') {
      at += lengthOf(n);
      return;
    }
    for (const c of n.childNodes) walk(c);
  };
  for (const c of lineEl.childNodes) walk(c);
  if (lineEl === node) found = true;
  return { line, at };
}

/** A model position as a DOM point [node, offset] in `root`. */
export function pointOf(root, pos) {
  const lines = linesOf(root);
  const lineEl = lines[Math.max(0, Math.min(pos.line, lines.length - 1))];
  if (!lineEl) return [root, 0];
  let left = pos.at;
  let point = null;
  const walk = (n) => {
    if (point) return;
    if (n.nodeType === 3) {
      const len = n.textContent.length;
      if (left <= len) point = [n, left];
      else left -= len;
      return;
    }
    if (n.nodeType !== 1 || isNum(n)) return;
    if (isChip(n) || n.tagName === 'BR') {
      const len = lengthOf(n);
      if (left === 0) point = [n.parentNode, [...n.parentNode.childNodes].indexOf(n)];
      else if (left <= len) point = [n.parentNode, [...n.parentNode.childNodes].indexOf(n) + 1];
      else left -= len;
      if (point && left > 0) left = 0;
      return;
    }
    for (const c of n.childNodes) walk(c);
  };
  for (const c of lineEl.childNodes) walk(c);
  if (point) return point;
  // the line's end (before its placeholder <br>, the browser's in an empty line)
  const kids = [...lineEl.childNodes];
  const last = kids.at(-1);
  const placeholder = last?.nodeName === 'BR' && lengthOf(last) === 0;
  return [lineEl, kids.length - (placeholder ? 1 : 0)];
}

/** The selection in `root` as model positions { from, to } (from: the anchor), or null. */
export function selectionOf(root, win) {
  const sel = win.getSelection();
  if (!sel || !sel.rangeCount || !root.contains(sel.anchorNode)) return null;
  const from = posOf(root, sel.anchorNode, sel.anchorOffset);
  const to = posOf(root, sel.focusNode, sel.focusOffset);
  return from && to ? { from, to } : null;
}

/** Put the selection at model positions. */
export function select(root, win, { from, to }) {
  const sel = win.getSelection();
  const [an, ao] = pointOf(root, from);
  const [fn, fo] = pointOf(root, to);
  try {
    sel.setBaseAndExtent(an, ao, fn, fo);
  } catch {
    /* a point the DOM changed under us */
  }
}

/** The lines rendered again for editing (chips show their field's name). */
export function renderEditing(root, body, { lead } = {}) {
  root.innerHTML = renderBody(body, { editing: true, lead });
}

/** Is a selection collapsed (a caret)? */
export const isCaret = (s) => !!s && s.from.line === s.to.line && s.from.at === s.to.at;
