import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oneAtATime } from '../src/editor/lib/one-at-a-time.js';

test('page ops one at a time: a second waits for the first, in order, past a failure', async () => {
  const log = [];
  let running = 0;
  const op = oneAtATime(async (name, ms, fail) => {
    running++;
    assert.equal(running, 1, 'two ops at once');
    log.push(`start ${name}`);
    await new Promise((r) => setTimeout(r, ms));
    log.push(`end ${name}`);
    running--;
    if (fail) throw new Error(name);
    return name;
  });
  const a = op('a', 20, true);
  const b = op('b', 1);
  const c = op('c', 5);
  await assert.rejects(a, /a/);
  assert.deepEqual(await Promise.all([b, c]), ['b', 'c']);
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
});
