/**
 * Image pipeline (optional, but on by default in `npm run dev` / `npm run build`).
 *
 *   media/<any>/<file>.jpg  ──►  public/media/<any>/<file>-<width>.webp   (responsive sizes)
 *                           ──►  .generated/media.json                    (manifest)
 *
 * The manifest stores, per source image: intrinsic width/height, the generated
 * srcset, a tiny blurred placeholder (LQIP) and the dominant colour, which the
 * templates use for album accents when an album has no explicit `accent`.
 *
 * If `sharp` isn't installed, originals are copied as-is and the site still works
 * (no srcset / placeholders). Outputs are cached: unchanged images are skipped.
 * Sizes, format and quality: scripts/image-variants.mjs (shared with uploads to R2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMAT, loadSharp, makeVariants } from './image-variants.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'media');
const OUT = path.join(ROOT, 'public', 'media');
const MANIFEST = path.join(ROOT, '.generated', 'media.json');
const EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

const sharp = await loadSharp();
if (!sharp) console.warn('[images] sharp not available: copying originals without resizing.');

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(dir, e.name))
            : EXT.test(e.name)
              ? [path.join(dir, e.name)]
              : [],
        )
    : [];

const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const manifest = {};
const files = walk(SRC);
let built = 0;

for (const file of files) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const base = rel.replace(EXT, '');
  const mtime = fs.statSync(file).mtimeMs;
  const cached = prev[rel];
  const outputsExist =
    cached && cached.srcset.every((s) => fs.existsSync(path.join(ROOT, 'public', s.url)));
  if (
    cached &&
    cached.mtime === mtime &&
    cached.pipeline === (sharp ? 'sharp' : 'copy') &&
    outputsExist
  ) {
    manifest[rel] = cached;
    continue;
  }
  fs.mkdirSync(path.join(OUT, path.dirname(rel)), { recursive: true });

  if (!sharp) {
    const url = `/media/${rel}`;
    fs.copyFileSync(file, path.join(OUT, rel));
    manifest[rel] = {
      mtime,
      pipeline: 'copy',
      width: 0,
      height: 0,
      src: url,
      srcset: [{ url, w: 0 }],
      color: null,
      lqip: null,
    };
    continue;
  }

  const v = await makeVariants(sharp, file);
  const srcset = [];
  for (const { w, buffer } of v.sizes) {
    const url = `/media/${base}-${w}.${FORMAT.ext}`;
    fs.writeFileSync(path.join(ROOT, 'public', url), buffer);
    srcset.push({ url, w });
  }
  manifest[rel] = {
    mtime,
    pipeline: 'sharp',
    width: v.width,
    height: v.height,
    src: srcset[srcset.length - 1].url,
    srcset,
    color: v.color,
    lqip: v.lqip,
  };
  built++;
}

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(
  `[images] ${files.length} images, ${built} (re)built → public/media, manifest → .generated/media.json`,
);
