import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK_TYPES } from '../src/site/blocks/index.js';

test('every block type has its Add block line and a sketch of a type', () => {
  for (const t of Object.values(BLOCK_TYPES)) {
    assert.ok(typeof t.line === 'string' && t.line, `${t.type}: line`);
    assert.ok(BLOCK_TYPES[t.sketch], `${t.type}: sketch "${t.sketch}" is a type`);
  }
});
