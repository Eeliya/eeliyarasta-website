// Text widget fixes: safe links, paste into lines, fit to widget's search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeHref, linkProblem, hrefOf, UNSAFE_HREF } from '../src/site/hrefs.js';
import { checkBody, deleteRange, insertLines, plainLines, htmlLines } from '../src/site/text.js';
import { searchFit } from '../src/client/modules/fit.js';

test('links: only safe URLs; checked in a body; never output', () => {
  for (const ok of [
    'https://x.nl',
    'http://x',
    'mailto:a@b.c',
    'tel:+31',
    '/about/',
    '#top',
    '?q=1',
    'about/',
    '',
  ])
    assert.equal(isSafeHref(ok), true, ok);
  for (const bad of [
    'javascript:alert(1)',
    ' JavaScript:x',
    'java\tscript:x',
    'data:text/html,x',
    'vbscript:x',
    '\u0001javascript:x',
    'file:///etc',
  ])
    assert.equal(isSafeHref(bad), false, bad);
  assert.equal(linkProblem({ href: 'javascript:x' }), UNSAFE_HREF);
  assert.equal(linkProblem({ href: 'https://x.nl' }), null);
  assert.match(
    checkBody([{ style: 'paragraph', text: [{ t: 'a', link: { href: 'javascript:x' } }] }])[0],
    /"body\.0\.text\.0\.link": a link must be/,
  );
  assert.match(checkBody([{ style: 'paragraph', text: [{ t: 'a', link: 3 }] }])[0], /link/);
  assert.equal(hrefOf({}, { href: 'javascript:alert(1)' }), '#');
  assert.equal(hrefOf({}, 'javascript:alert(1)'), '#'); // a bound link's text too
  assert.equal(hrefOf({}, { href: '/about/' }), '/about/');
});

test('paste: plain text: a blank line a new Paragraph line, a newline a break in it', () => {
  assert.deepEqual(plainLines('One\r\ntwo\n\n\n  Three  \n\n'), [
    { style: 'paragraph', text: [{ t: 'One\ntwo' }] },
    { style: 'paragraph', text: [{ t: 'Three' }] },
  ]);
  assert.deepEqual(plainLines(' \n '), []);
});

// a parsed DOM, as much of it as htmlLines reads
const el = (tag, kids = [], attrs = {}, style = {}) => ({
  nodeType: 1,
  tagName: tag,
  childNodes: kids.map((k) => (typeof k === 'string' ? { nodeType: 3, textContent: k } : k)),
  getAttribute: (n) => attrs[n] ?? null,
  style,
});

test('paste: HTML: widgets are Paragraph lines; only bold, italic and safe links kept', () => {
  const root = el('BODY', [
    el('STYLE', ['p { color: red }']),
    el('H1', ['Big ', el('SPAN', ['title'], {}, { fontSize: '40px', color: 'red' })]),
    '\n  ',
    el('DIV', [
      el('P', [
        'One ',
        el('STRONG', ['bold']),
        ' and ',
        el('SPAN', ['it'], {}, { fontStyle: 'italic' }),
      ]),
      el('P', [
        'a',
        el('BR'),
        'b ',
        el('A', ['link'], { href: 'https://x.nl' }),
        ' ',
        el('A', ['bad'], { href: 'javascript:x' }),
      ]),
    ]),
    // Google Docs: everything in a <b style="font-weight:normal">
    el('B', [el('P', ['plain'])], {}, { fontWeight: 'normal' }),
    el('UL', [el('LI', ['x']), el('LI', ['y'])]),
    el('P', ['  ']),
  ]);
  assert.deepEqual(htmlLines(root, isSafeHref), [
    { style: 'paragraph', text: [{ t: 'Big title' }] },
    {
      style: 'paragraph',
      text: [{ t: 'One ' }, { t: 'bold', marks: ['b'] }, { t: ' and ' }, { t: 'it', marks: ['i'] }],
    },
    {
      style: 'paragraph',
      text: [{ t: 'a\nb ' }, { t: 'link', link: { href: 'https://x.nl' } }, { t: ' bad' }],
    },
    { style: 'paragraph', text: [{ t: 'plain' }] },
    { style: 'paragraph', text: [{ t: 'x' }] },
    { style: 'paragraph', text: [{ t: 'y' }] },
  ]);
});

test('paste: into a body: one line inline, more lines between the halves', () => {
  const body = [
    { style: 'title', text: [{ t: 'Hello world' }] },
    { style: 'small', text: [{ t: 'end' }] },
  ];
  const one = insertLines(body, { line: 0, at: 6 }, { line: 0, at: 11 }, plainLines('there'));
  assert.deepEqual(one.body[0], { style: 'title', text: [{ t: 'Hello there' }] });
  assert.deepEqual(one.at, { line: 0, at: 11 });
  const two = insertLines(body, { line: 0, at: 5 }, { line: 0, at: 5 }, plainLines('A\n\nB'));
  assert.deepEqual(two.body, [
    { style: 'title', text: [{ t: 'Hello' }] },
    { style: 'paragraph', text: [{ t: 'A' }] },
    { style: 'paragraph', text: [{ t: 'B' }] },
    { style: 'title', text: [{ t: ' world' }] },
    body[1],
  ]);
  assert.deepEqual(two.at, { line: 2, at: 1 });
  // at a line's end: no empty half; over two lines: they join first
  const end = insertLines(body, { line: 0, at: 11 }, { line: 0, at: 11 }, plainLines('A\n\nB'));
  assert.equal(end.body.length, 4);
  assert.deepEqual(deleteRange(body, { line: 1, at: 1 }, { line: 0, at: 5 }), [
    { style: 'title', text: [{ t: 'Hellond' }] },
  ]);
});

test('fit: the largest factor that fits, within 1%, near a guess in a few measures', () => {
  let n = 0;
  const at = (limit) => (k) => (n++, k <= limit);
  assert.ok(Math.abs(searchFit(at(1.37)) - 1.37) < 0.02);
  const cold = n;
  n = 0;
  assert.ok(Math.abs(searchFit(at(1.4), 1.37) - 1.4) < 0.02);
  assert.ok(n < cold, `${n} < ${cold}`);
  assert.equal(searchFit(at(0)), 0.05); // nothing fits: the smallest
  assert.ok(searchFit(at(99)) >= 19.8); // everything fits: the largest
});
