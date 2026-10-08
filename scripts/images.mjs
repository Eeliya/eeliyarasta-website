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
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'media');
const OUT = path.join(ROOT, 'public', 'media');
const MANIFEST = path.join(ROOT, '.generated', 'media.json');
const WIDTHS = [480, 960, 1600];
const QUALITY = 78;
const EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[images] sharp not available: copying originals without resizing.');
}

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

/**
 * Most "vivid" colour of an image: bucket pixels by hue, weight by saturation ×
 * mid-lightness, return the average colour of the strongest bucket. Greyscale
 * images return a grey (templates then fall back to the site accent).
 */
async function vividColor(file) {
  const { data, info } = await sharp(file)
    .resize(32, 32, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let total = { r: 0, g: 0, b: 0, n: 0 };
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    total.r += r;
    total.g += g;
    total.b += b;
    total.n++;
    const max = Math.max(r, g, b) / 255,
      min = Math.min(r, g, b) / 255,
      l = (max + min) / 2,
      d = max - min;
    if (d < 0.08) continue;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h =
      max === r / 255
        ? ((g - b) / 255 / d) % 6
        : max === g / 255
          ? (b - r) / 255 / d + 2
          : (r - g) / 255 / d + 4;
    h = (h * 60 + 360) % 360;
    const w = s * (1 - Math.abs(2 * l - 1));
    const bin = bins[Math.floor(h / 30) % 12];
    bin.w += w;
    bin.r += r * w;
    bin.g += g * w;
    bin.b += b * w;
  }
  const best = bins.reduce((a, c) => (c.w > a.w ? c : a));
  if (best.w < 1) return hex({ r: total.r / total.n, g: total.g / total.n, b: total.b / total.n });
  return hex({ r: best.r / best.w, g: best.g / best.w, b: best.b / best.w });
}

const hex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

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

  const img = sharp(file).rotate();
  const meta = await img.metadata();
  const portrait = (meta.orientation || 1) >= 5;
  const width = portrait ? meta.height : meta.width;
  const height = portrait ? meta.width : meta.height;
  const srcset = [];
  for (const w of WIDTHS) {
    if (w > width && srcset.length) break;
    const tw = Math.min(w, width);
    const url = `/media/${base}-${tw}.webp`;
    await sharp(file)
      .rotate()
      .resize({ width: tw })
      .webp({ quality: QUALITY })
      .toFile(path.join(ROOT, 'public', url));
    srcset.push({ url, w: tw });
  }
  const accent = await vividColor(file);
  const lqipBuf = await sharp(file).rotate().resize(16).blur(1).webp({ quality: 40 }).toBuffer();
  manifest[rel] = {
    mtime,
    pipeline: 'sharp',
    width,
    height,
    src: srcset[srcset.length - 1].url,
    srcset,
    color: accent,
    lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
  };
  built++;
}

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(
  `[images] ${files.length} images, ${built} (re)built → public/media, manifest → .generated/media.json`,
);
