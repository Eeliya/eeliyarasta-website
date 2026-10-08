/** Load all content files (+ the generated media manifest) into one object. Node only. */
import fs from 'node:fs';
import path from 'node:path';

const read = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

export function loadContent(root) {
  const dir = path.join(root, 'content');
  return {
    site: read(path.join(dir, 'site.json')),
    home: read(path.join(dir, 'home.json')),
    people: read(path.join(dir, 'people.json'), []),
    places: read(path.join(dir, 'places.json'), []),
    projects: read(path.join(dir, 'projects.json'), []),
    animations: read(path.join(dir, 'animations.json'), {}),
    media: read(path.join(root, '.generated', 'media.json'), {}),
  };
}
