/**
 * Link checker for the built site: every internal link (href and src starting with "/")
 * in dist/**\/*.html must point at a file in dist/ ("/people/x/" -> dist/people/x/index.html).
 * Run after a build: `npm run check:links`. Exits 1 when a link is broken.
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] || 'dist');

const htmlFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });

/** The dist file a site URL serves, or null. */
function target(url) {
  let pathname = decodeURIComponent(url.split(/[?#]/)[0]);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.join(dist, pathname);
  if (!file.startsWith(dist)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  const index = path.join(file, 'index.html'); // "/people" serves /people/index.html
  return fs.existsSync(index) ? index : null;
}

if (!fs.existsSync(dist)) {
  console.error(`No ${dist}: run npm run build first.`);
  process.exit(1);
}
const broken = [];
let count = 0;
for (const file of htmlFiles(dist)) {
  const html = fs.readFileSync(file, 'utf8');
  for (const [, attr, url] of html.matchAll(/\s(href|src)="(\/[^"]*)"/g)) {
    if (url.startsWith('//')) continue; // protocol-relative: external
    count++;
    const decoded = url.replace(/&amp;/g, '&');
    if (!target(decoded))
      broken.push(`${path.relative(dist, file).split(path.sep).join('/')}: ${attr}="${url}"`);
  }
}
if (broken.length) {
  console.error(`${broken.length} broken internal links:\n  ${broken.join('\n  ')}`);
  process.exit(1);
}
console.log(`links ok: ${count} internal links in ${htmlFiles(dist).length} pages`);
