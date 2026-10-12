/**
 * Regression: tests that run git (publish.test.mjs) never touch the repo a hook points at.
 * The pre-push hook runs `npm test` with GIT_DIR (and GIT_INDEX_FILE, GIT_WORK_TREE) set to the
 * repo being pushed; publish.test.mjs once re-initialised that repo (core.bare=true), set a
 * "Test" identity in its config and committed onto the pushed branch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REPO_VARS, repoEnv, testEnv } from './git-env.mjs';

// fileURLToPath, not URL.pathname: on Windows that is "/S:/…", a cwd spawn can't use (ENOENT)
const here = path.dirname(fileURLToPath(import.meta.url));
const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, env: testEnv(), encoding: 'utf8' }).trim();

test('repoEnv / testEnv drop the variables that choose a repo', () => {
  const env = { PATH: '/bin', GIT_DIR: '/x', GIT_INDEX_FILE: '/x/i', GIT_SSH_COMMAND: 'ssh' };
  for (const k of REPO_VARS) env[k] = '/x';
  env.GIT_CONFIG_KEY_0 = 'core.bare';
  const r = repoEnv(env);
  assert.deepEqual(Object.keys(r).sort(), ['GIT_SSH_COMMAND', 'PATH']); // auth helpers stay
  const t = testEnv(env);
  assert.ok(!Object.keys(t).some((k) => /^GIT_(DIR|INDEX|SSH|WORK|COMMON|CONFIG_KEY)/.test(k)));
  assert.equal(t.GIT_AUTHOR_NAME, 'Test');
});

test('publish.test.mjs under a hook environment leaves the hook repo untouched', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-'));
  git(dir, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'keep.txt'), 'sentinel\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'sentinel');
  const gitDir = path.join(dir, '.git');
  const snapshot = () => ({
    config: fs.readFileSync(path.join(gitDir, 'config'), 'utf8'),
    head: fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8'),
    commit: git(dir, 'rev-parse', 'HEAD'),
    count: git(dir, 'rev-list', '--count', '--all'),
    index: fs.readFileSync(path.join(gitDir, 'index')).toString('base64'),
    status: git(dir, 'status', '--porcelain'),
    files: fs.readdirSync(dir).sort().join(),
  });
  const before = snapshot();
  // NODE_TEST_CONTEXT (set for this file by the test runner) would make the child report to us
  // and exit 0 whatever happens: run it as a test run of its own
  const { NODE_TEST_CONTEXT: _, ...base } = process.env; // eslint-disable-line no-unused-vars
  // what git exports to a hook: GIT_DIR alone (absolute, as in a linked worktree), and with the
  // index and work tree too
  const hooks = [
    { GIT_DIR: gitDir },
    { GIT_DIR: gitDir, GIT_INDEX_FILE: path.join(gitDir, 'index'), GIT_WORK_TREE: dir },
  ];
  for (const vars of hooks) {
    const r = spawnSync(process.execPath, ['--test', path.join(here, 'publish.test.mjs')], {
      cwd: path.dirname(here),
      env: { ...base, ...vars, GIT_PREFIX: '' },
      encoding: 'utf8',
    });
    // a spawn that failed (r.error: ENOENT, a timeout …) says why
    assert.equal(r.error, undefined, `spawn failed: ${r.error?.code} ${r.error?.message}`);
    assert.equal(r.status, 0, `status ${r.status} signal ${r.signal}\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /^# pass 1$/m);
    assert.deepEqual(snapshot(), before, Object.keys(vars).join());
  }
});
