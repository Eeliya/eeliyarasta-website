// The Text widget's inline editor (src/editor/rich.js) on a light DOM (linkedom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readBody, renderEditing, posOf, pointOf, isCaret } from '../src/editor/rich.js';
import { htmlLines, renderBody } from '../src/site/text.js';
import { isSafeHref } from '../src/site/hrefs.js';

const dom = (inner = '') => {
  const { document } = parseHTML(
    `<!doctype html><html><body><div id="r">${inner}</div></body></html>`,
  );
  return document.getElementById('r');
};

const body = [
  { style: 'title', text: [{ t: 'Hi ' }, { t: 'there', marks: ['b', 'i'] }] },
  {
    style: 'paragraph',
    text: [
      { t: 'By ' },
      { field: 'name', format: '{value}!' },
      { t: ' a\nb ' },
      { t: 'link', link: { page: 'pg-abcd' } },
      { count: { source: 'people' } },
    ],
  },
  { style: 'small', text: [] },
];

test('rich: rendered for editing and read back: the same body', () => {
  const root = dom();
  renderEditing(root, body);
  assert.deepEqual(readBody(root), body);
  // chips are atomic and show their name; a link carries itself, not its URL
  assert.match(
    root.innerHTML,
    /data-field="name" data-format="\{value\}!" contenteditable="false">name</,
  );
  assert.match(root.innerHTML, /contenteditable="false">#people</);
  assert.match(
    root.innerHTML,
    /<a href="#" data-ts-link="\{&quot;page&quot;:&quot;pg-abcd&quot;\}">link<\/a>/,
  );
});

test('rich: the site HTML has the URL only, no link data', () => {
  const html = renderBody(body, { href: () => '/x/' });
  assert.match(html, /<a href="\/x\/">link<\/a>/);
  assert.doesNotMatch(html, /data-ts-link|data-link|pg-abcd/);
});

test('rich: what the browser types is read clean', () => {
  const root = dom(
    '<h1 data-line="title">A<b>B</b><span style="color:red">C</span><br></h1>' +
      '<p data-line="paragraph">x<br>y<i>z</i><a href="javascript:x">bad</a><a href="/ok/">ok</a></p>' +
      '<div>loose</div>',
  );
  assert.deepEqual(readBody(root), [
    { style: 'title', text: [{ t: 'A' }, { t: 'B', marks: ['b'] }, { t: 'C' }] },
    {
      style: 'paragraph',
      text: [
        { t: 'x\ny' },
        { t: 'z', marks: ['i'] },
        { t: 'bad' },
        { t: 'ok', link: { href: '/ok/' } },
      ],
    },
    { style: 'paragraph', text: [{ t: 'loose' }] },
  ]);
});

test('rich: DOM points and model positions (a chip counts one, a break one)', () => {
  const root = dom();
  renderEditing(root, body);
  const p = root.children[1];
  const chip = p.querySelector('[data-field]');
  const after = chip.nextSibling; // " a"
  assert.deepEqual(posOf(root, after, 1), { line: 1, at: 5 }); // "By " + chip + " "
  assert.deepEqual(posOf(root, chip.firstChild, 2), { line: 1, at: 4 }); // in a chip: its end
  const [n, o] = pointOf(root, { line: 1, at: 5 });
  assert.equal(n, after);
  assert.equal(o, 1);
  assert.deepEqual(posOf(root, ...pointOf(root, { line: 0, at: 4 })), { line: 0, at: 4 });
  // an empty line: its start
  assert.deepEqual(posOf(root, ...pointOf(root, { line: 2, at: 0 })), { line: 2, at: 0 });
  assert.equal(isCaret({ from: { line: 1, at: 2 }, to: { line: 1, at: 2 } }), true);
});

test('rich: pasted HTML parsed by a DOM: lines, marks, safe links only', () => {
  const { document } = parseHTML(
    '<html><body><style>p{}</style><h2 style="font-size:40px">Head</h2>' +
      '<p>One <strong>b</strong> <em>i</em><br>two <a href="https://x.nl">x</a> <a href="javascript:y">y</a></p>' +
      '<div><div>Nested</div></div></body></html>',
  );
  assert.deepEqual(htmlLines(document.body, isSafeHref), [
    { style: 'paragraph', text: [{ t: 'Head' }] },
    {
      style: 'paragraph',
      text: [
        { t: 'One ' },
        { t: 'b', marks: ['b'] },
        { t: ' ' },
        { t: 'i', marks: ['i'] },
        { t: '\ntwo ' },
        { t: 'x', link: { href: 'https://x.nl' } },
        { t: ' y' },
      ],
    },
    { style: 'paragraph', text: [{ t: 'Nested' }] },
  ]);
});
