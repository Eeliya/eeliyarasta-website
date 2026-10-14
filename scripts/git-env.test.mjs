/**
 * Regression: tests that run git (publish.test.mjs) and the editor's git never touch the repo a
 * hook points at.
 * The pre-push hook runs `npm test` with GIT_DIR (and GIT_INDEX_FILE, GIT_WORK_TREE) set to the
 * repo being pushed; publish.test.mjs once re-initialised that repo (core.bare=true), set a
 * "Test" identity in its config and committed onto the pushed branch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO_VARS, repoEnv } from './git-env.mjs';
import { testEnv } from './test-layout.mjs';

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

test('git run as tests and Publish run it, under a hook environment, leaves the hook repo untouched', () => {
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
  // what git exports to a hook: GIT_DIR alone (absolute, as in a linked worktree), and with the
  // index and work tree too
  const hooks = [
    { GIT_DIR: gitDir },
    { GIT_DIR: gitDir, GIT_INDEX_FILE: path.join(gitDir, 'index'), GIT_WORK_TREE: dir },
  ];
  for (const vars of hooks) {
    const hook = { ...process.env, ...vars, GIT_PREFIX: '' };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooked-'));
    // a test's git (testEnv, as publish.test.mjs's useTestEnv): what once rewrote the hook repo
    const t = (...args) =>
      execFileSync('git', args, { cwd: tmp, env: testEnv(hook), encoding: 'utf8' }).trim();
    t('init', '-q', '-b', 'main');
    t('config', 'user.name', 'Test');
    fs.writeFileSync(path.join(tmp, 'x.txt'), 'x\n');
    t('add', '.');
    t('commit', '-qm', 'x');
    assert.equal(fs.realpathSync(t('rev-parse', '--show-toplevel')), fs.realpathSync(tmp));
    // the editor's git (repoEnv): the repo of its cwd
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: tmp,
      env: repoEnv(hook),
      encoding: 'utf8',
    }).trim();
    assert.equal(fs.realpathSync(top), fs.realpathSync(tmp));
    assert.deepEqual(snapshot(), before, Object.keys(vars).join());
  }
});
