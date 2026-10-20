// The Text block's body (src/site/text.js): checked, rendered, edited as a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkBody,
  plainText,
  lineText,
  bodyOf,
  renderBody,
  fieldText,
  countText,
  tidyRuns,
  hasMark,
  toggleMark,
  setLink,
  linkIn,
  setStyle,
  insertRun,
  splitLine,
  tidyBody,
} from '../src/site/text.js';

const at = (line, a) => ({ line, at: a });
const body = [
  { style: 'title', text: [{ t: 'Hello ' }, { t: 'world', marks: ['b'] }] },
  { style: 'paragraph', text: [{ t: 'By ' }, { field: 'name', format: '{value}!' }] },
];

test('text: a body is checked line by line, run by run', () => {
  assert.deepEqual(checkBody(body), []);
  assert.match(checkBody('x')[0], /"body" must be a list of lines/);
  assert.deepEqual(
    checkBody([
      { style: 'huge', text: [{ t: 'a', marks: ['u'] }, { field: 'a b' }, { count: {} }, {}] },
    ]),
    [
      '"body.0.style" must be one of title, heading, subheading, statement, paragraph, label, small',
      '"body.0.text.0.marks" must be a list of b, i',
      '"body.0.text.1.field" must be a field name',
      '"body.0.text.2.count" must be { "source": "<source>" } or { "of": "items" }',
      '"body.0.text.3" must be { t }, { field } or { count }',
    ],
  );
  assert.match(checkBody([{ style: 'title', text: [{ field: 'a', format: 'x' }] }])[0], /{value}/);
});

test('text: plain text, a page title, a body from text', () => {
  assert.equal(
    plainText(body, (r) => `<${r.field}>`),
    'Hello world\nBy <name>',
  );
  assert.equal(lineText(body, 'title'), 'Hello world');
  assert.equal(lineText(body, 'label'), undefined);
  assert.equal(lineText(body, 'paragraph'), undefined); // a field in it: no fixed title
  assert.deepEqual(bodyOf('a\n\n b '), [
    { style: 'paragraph', text: [{ t: 'a' }] },
    { style: 'paragraph', text: [{ t: 'b' }] },
  ]);
});

test('text: rendered safe; chips show values, or their names while editing', () => {
  const value = (r) => fieldText(r, { name: 'Ann<' });
  const out = renderBody(body, { value });
  assert.match(
    out,
    /^<h1 class="ts ts--title" data-line="title">Hello <strong>world<\/strong><\/h1>/,
  );
  assert.match(
    out,
    /<span class="ts__chip" data-field="name" data-format="\{value\}!">Ann&lt;!<\/span>/,
  );
  const ed = renderBody(body, { value, editing: true });
  assert.match(ed, /data-field="name" data-format="\{value\}!" contenteditable="false">name</);
  // escaped text; a link; an empty line keeps a <br>
  const more = renderBody(
    [
      { style: 'small', text: [{ t: '<b>', link: { href: '/x/' } }] },
      { style: 'heading', text: [] },
    ],
    { href: (l) => l.href },
  );
  assert.match(more, /<p class="ts ts--small"[^>]*><a href="\/x\/"[^>]*>&lt;b&gt;<\/a><\/p>/);
  assert.match(more, /<h2 class="ts ts--heading" data-line="heading"><br><\/h2>/);
  // an unknown style renders as a paragraph; no body: one empty paragraph
  assert.match(renderBody([{ style: 'x', text: [] }]), /ts--paragraph/);
  assert.match(renderBody(undefined), /^<p class="ts ts--paragraph"/);
  assert.equal(fieldText({ field: 'n' }, {}), '');
  assert.equal(countText(4), '04');
  assert.match(
    renderBody([{ style: 'title', text: [{ count: { source: 'projects' } }] }], {
      value: () => '07',
    }),
    /<sup class="ts__count" data-count="\{&quot;source&quot;:&quot;projects&quot;\}">07<\/sup>/,
  );
});

test('text: marks and links over a selection, cut at its ends; tidy runs', () => {
  const b = toggleMark(body, at(0, 2), at(0, 8), 'i');
  assert.deepEqual(b[0].text, [
    { t: 'He' },
    { t: 'llo ', marks: ['i'] },
    { t: 'wo', marks: ['b', 'i'] },
    { t: 'rld', marks: ['b'] },
  ]);
  assert.equal(hasMark(b, at(0, 2), at(0, 6), 'i'), true);
  assert.equal(hasMark(b, at(0, 2), at(0, 2), 'i'), false); // a caret: nothing
  // toggled back: as it was
  assert.deepEqual(toggleMark(b, at(0, 8), at(0, 2), 'i'), body);
  // across lines; chips untouched
  const l = setLink(body, at(0, 6), at(1, 4), { href: '/a/' });
  assert.deepEqual(l[1].text, [{ t: 'By ', link: { href: '/a/' } }, body[1].text[1]]);
  assert.deepEqual(linkIn(l, at(1, 0), at(1, 1)), { href: '/a/' });
  assert.deepEqual(setLink(l, at(0, 0), at(1, 4), null), body);
  assert.deepEqual(tidyRuns([{ t: 'a' }, { t: '' }, { t: 'b' }, { field: 'x' }]), [
    { t: 'ab' },
    { field: 'x' },
  ]);
});

test('text: a line style, a chip put in, a line split', () => {
  assert.equal(setStyle(body, 1, 'small')[1].style, 'small');
  assert.equal(setStyle(body, 1, 'nope')[1].style, 'paragraph');
  assert.deepEqual(setStyle([], 0, 'title'), [{ style: 'title', text: [] }]);
  assert.deepEqual(insertRun(body, at(0, 5), { field: 'x' })[0].text, [
    { t: 'Hello' },
    { field: 'x' },
    { t: ' ' },
    { t: 'world', marks: ['b'] },
  ]);
  const s = splitLine(body, at(0, 3));
  assert.deepEqual(s.slice(0, 2), [
    { style: 'title', text: [{ t: 'Hel' }] },
    { style: 'title', text: [{ t: 'lo ' }, { t: 'world', marks: ['b'] }] },
  ]);
  assert.deepEqual(tidyBody([{ text: [{ t: '' }] }, null]), [
    { style: 'paragraph', text: [] },
    { style: 'paragraph', text: [] },
  ]);
});
