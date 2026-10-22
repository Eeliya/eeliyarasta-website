// site.config.mjs and its paths (scripts/site-config.mjs), and the GitHub link from a remote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULTS, loadSiteConfig, repoUrl } from './site-config.mjs';
import { loadContent } from './content.mjs';
import { CONTENT_DIR } from '../src/site/files.js';
import { SITE_A } from '../test/fixtures/index.mjs';

test('no site.config.mjs: the defaults, resolved from the root', () => {
  const site = loadSiteConfig(SITE_A);
  assert.deepEqual(site.config, { ...DEFAULTS, repo: { ...DEFAULTS.repo } });
  assert.equal(site.contentDir, path.join(SITE_A, 'content/en'));
  assert.equal(site.manifest, path.join(SITE_A, '.generated/media.json'));
  assert.equal(site.publicMediaDir, path.join(SITE_A, 'public/media'));
  assert.equal(site.outDir, path.join(SITE_A, 'dist'));
  assert.equal(site.contentRel, 'content/en');
  assert.equal(site.mediaUrl, '/media');
});

test('a site.config.mjs moves the folders: content, manifest, media URL, messages', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-config-'));
  fs.writeFileSync(
    path.join(root, 'site.config.mjs'),
    `export default { contentDir: 'site/nl', generatedDir: 'gen', publicDir: 'static', publicMediaDir: 'static/img', outDir: 'out', repo: { owner: 'o' } };\n`,
  );
  fs.cpSync(path.join(SITE_A, 'content/en'), path.join(root, 'site/nl'), { recursive: true });
  fs.mkdirSync(path.join(root, 'gen'));
  fs.writeFileSync(path.join(root, 'gen/media.json'), '{"a.jpg":{"width":1}}');
  const site = loadSiteConfig(root);
  assert.equal(site.contentDir, path.join(root, 'site/nl'));
  assert.equal(site.mediaDir, path.join(root, 'media'), 'a key not set keeps its default');
  assert.equal(site.mediaUrl, '/img');
  assert.equal(site.outDir, path.join(root, 'out'));
  assert.deepEqual(site.config.repo, { owner: 'o', name: '' });
  const content = loadContent(root);
  assert.deepEqual(content.media, { 'a.jpg': { width: 1 } });
  assert.ok(content.pages.home);
  assert.equal(CONTENT_DIR, 'site/nl', 'messages name the configured folder');
  loadContent(SITE_A);
  assert.equal(CONTENT_DIR, 'content/en');
});

test('repoUrl: the git remote first, then the config, else none', () => {
  const repo = { owner: 'Me', name: 'site' };
  assert.equal(repoUrl('git@github.com:A/b.git', { repo }), 'https://github.com/A/b');
  assert.equal(repoUrl('https://github.com/A/b', { repo }), 'https://github.com/A/b');
  assert.equal(repoUrl('https://gitlab.com/A/b.git', { repo }), 'https://github.com/Me/site');
  assert.equal(repoUrl('', { repo }), 'https://github.com/Me/site');
  assert.equal(repoUrl(''), '');
});
