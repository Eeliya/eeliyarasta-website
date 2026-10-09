/** Load all content files (+ the generated media manifest) into one object. Node only. */
import fs from 'node:fs';
import path from 'node:path';
import { FOLDERS, contentFromFiles } from '../src/site/files.js';

const read = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

/** Every content file as { "pages/home.json": data, "sources/people.json": data, ... }. */
export function readContentDir(root) {
  const dir = path.join(root, 'content');
  const files = {};
  for (const folder of FOLDERS) {
    const sub = path.join(dir, folder);
    if (!fs.existsSync(sub)) continue;
    for (const name of fs.readdirSync(sub).sort()) {
      if (name.endsWith('.json')) files[`${folder}/${name}`] = read(path.join(sub, name));
    }
  }
  return files;
}

export function loadContent(root) {
  return {
    ...contentFromFiles(readContentDir(root)),
    media: read(path.join(root, '.generated', 'media.json'), {}),
  };
}
