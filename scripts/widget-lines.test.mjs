import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';

test('every widget type has its Add widget line and a sketch of a type', () => {
  for (const t of Object.values(WIDGET_TYPES)) {
    assert.ok(typeof t.line === 'string' && t.line, `${t.type}: line`);
    assert.ok(WIDGET_TYPES[t.sketch], `${t.type}: sketch "${t.sketch}" is a type`);
  }
});
