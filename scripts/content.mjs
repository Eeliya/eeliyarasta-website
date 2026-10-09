/** Load all content files (+ the generated media manifest) into one object. Node only. */
import fs from 'node:fs';
import path from 'node:path';
import { FOLDERS, contentFromFiles, isContentFile } from '../src/site/files.js';

const read = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

/**
 * JSON files under dir, recursively, as paths relative to it with "/" separators
 * ("people.json", "people/[slug].json"), sorted.
 */
export function walkJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      out.push(...walkJson(path.join(dir, entry.name)).map((f) => `${entry.name}/${f}`));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(entry.name);
  }
  return out.sort();
}

/** Every content file as { "pages/home.json": data, "pages/people/[slug].json": data, ... }. */
export function readContentDir(root) {
  const dir = path.join(root, 'content');
  const files = {};
  for (const folder of FOLDERS) {
    for (const name of walkJson(path.join(dir, folder))) {
      const file = `${folder}/${name}`;
      if (isContentFile(file)) files[file] = read(path.join(dir, file));
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
