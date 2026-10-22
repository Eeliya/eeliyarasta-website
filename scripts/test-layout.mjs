/**
 * Test helpers. A widget written flat ({ pos, link, phone } next to its other keys) as
 * content stores it ({ layout: { base, phone } }, rows only when its size stores them), and
 * back (flat) for assertions. And a git environment for tests that run git (testEnv,
 * useTestEnv; see git-env.mjs for why).
 */
import fs from 'node:fs';
import path from 'node:path';
import { storesRows } from '../src/site/layout/grid.js';

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function lay(b) {
  const { pos, link, phone, ...rest } = b;
  if (rest.layout) return b;
  const keep = storesRows(rest);
  const base = clean({ ...(pos || { col: 1, span: 120, row: 1 }), link });
  if (!keep) delete base.rows;
  const out = { ...rest, layout: { base } };
  if (phone === null) out.layout.phone = null;
  else if (phone) {
    const ph = clean({ ...phone });
    if (!keep) delete ph.rows;
    out.layout.phone = ph;
  }
  return out;
}

export function flat(b) {
  const { layout, ...rest } = b || {};
  const { link, ...pos } = layout?.base || {};
  return clean({ ...rest, pos, link, phone: layout?.phone });
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

/** [fn()'s result, the console.warn messages it printed]. */
export function warnings(fn) {
  const seen = [];
  const warn = console.warn;
  console.warn = (...a) => seen.push(a.join(' '));
  try {
    return [fn(), seen];
  } finally {
    console.warn = warn;
  }
}

/** A temp site's content file (content/en/<f>), parsed. */
export const read = (root, f) =>
  JSON.parse(fs.readFileSync(path.join(root, 'content/en', f), 'utf8'));

/**
 * A [param] page's content (src/site/layout/source.js) for page `id` ("people/[person]"): an
 * album widget as its main widget, From URL `from`, each param of the address matching the field
 * `fields` names for it, else slug. extra: more keys of the page (meta, ...).
 */
export function paramPage(id, from, fields = {}, extra = {}) {
  const params = id
    .split('/')
    .map((s) => /^\[(.+)\]$/.exec(s)?.[1])
    .filter(Boolean);
  const rules = params.map((param) => ({ param, field: fields[param] ?? 'slug' }));
  return {
    main: 'b-main',
    sections: [
      {
        id: 's-main',
        widgets: [
          {
            id: 'b-main',
            type: 'album',
            source: { mode: 'url', from, where: { op: 'and', rules } },
          },
        ],
      },
    ],
    ...extra,
  };
}
