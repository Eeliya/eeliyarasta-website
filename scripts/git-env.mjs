/**
 * Environments for running git on a repo named by its directory (cwd) only.
 *
 * A git hook (pre-push: lint and tests) runs with variables that point git at the repo being
 * pushed, GIT_DIR above all (in a linked worktree an absolute path). A git started from a hook
 * with them set works on THAT repo whatever its cwd is: a test's `git init` / `git config` /
 * `git commit` in a temp dir then rewrites the real repo (this happened: core.bare=true, a
 * "Test" identity and a stray commit on the pushed branch). So:
 *
 *   repoEnv()  the environment without the variables that choose a repo, index, work tree or
 *              object store (the editor's Publish: auth helpers like GIT_SSH_COMMAND stay)
 *   testEnv()  no GIT_* at all, no system or global config, a fixed test identity (tests)
 */

/** Variables that choose which repository, work tree, index or objects git uses. */
export const REPO_VARS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
  'GIT_QUARANTINE_PATH',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_REFLOG_ACTION',
];
const REPO_PATTERNS = [/^GIT_CONFIG_(KEY|VALUE)_\d+$/, /^GIT_PUSH_OPTION_/];

const isRepoVar = (k) => REPO_VARS.includes(k) || REPO_PATTERNS.some((re) => re.test(k));

/** `env` without the variables that choose a repo (git then finds it from its cwd). */
export function repoEnv(env = process.env, extra = {}) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (!isRepoVar(k)) out[k] = v;
  return { ...out, ...extra };
}

/** The test identity, as environment (no `git config` writes). */
const TEST_IDENTITY = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

/** `env` without any GIT_*, ignoring the system and global config, with the test identity. */
export function testEnv(env = process.env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (!k.startsWith('GIT_')) out[k] = v;
  return {
    ...out,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    ...TEST_IDENTITY,
  };
}

/** Make this process's own environment a test one (children, e.g. the editor's git, inherit it). */
export function useTestEnv() {
  const clean = testEnv(process.env);
  for (const k of Object.keys(process.env)) if (!(k in clean)) delete process.env[k];
  Object.assign(process.env, clean);
}
