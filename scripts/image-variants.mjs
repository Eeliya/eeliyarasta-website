/**
 * The responsive sizes of one photo, shared by the local pipeline (scripts/images.mjs: media/
 * -> public/media/) and uploads to Cloudflare R2 (scripts/r2.mjs), so both get the same
 * treatment: auto-rotated from EXIF, metadata stripped (sharp writes none unless asked: no
 * GPS, no camera data), WebP at WIDTHS (never wider than the original), the size, a tiny
 * blurred placeholder (LQIP) and the most vivid colour (album accents).
 */
export const WIDTHS = [480, 960, 1600];
export const QUALITY = 78;
export const FORMAT = { ext: 'webp', type: 'image/webp' };

/** sharp, or null when it isn't installed. */
export async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    return null;
  }
}

/** The widths to make for an image `width` px wide: WIDTHS up to it, at least one. */
export function widthsFor(width) {
  const out = [];
  for (const w of WIDTHS) {
    if (w > width && out.length) break;
    out.push(Math.min(w, width));
  }
  return out;
}

/** Upright size of an image (EXIF orientation 5-8 swaps width and height). */
export async function uprightSize(sharp, input) {
  const meta = await sharp(input).metadata();
  const portrait = (meta.orientation || 1) >= 5;
  return {
    width: portrait ? meta.height : meta.width,
    height: portrait ? meta.width : meta.height,
  };
}

const hex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * Most "vivid" colour of an image: bucket pixels by hue, weight by saturation ×
 * mid-lightness, return the average colour of the strongest bucket. Greyscale
 * images return a grey (templates then fall back to the site accent).
 */
export async function vividColor(sharp, input) {
  const { data, info } = await sharp(input)
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

/**
 * Every size of a photo (`input`: a file path or a Buffer), made one at a time to keep
 * memory low: { width, height, sizes: [{ w, buffer }], color, lqip }.
 */
export async function makeVariants(sharp, input) {
  const { width, height } = await uprightSize(sharp, input);
  const sizes = [];
  for (const w of widthsFor(width)) {
    const buffer = await sharp(input)
      .rotate()
      .resize({ width: w })
      .webp({ quality: QUALITY })
      .toBuffer();
    sizes.push({ w, buffer });
  }
  const color = await vividColor(sharp, input);
  const lqipBuf = await sharp(input).rotate().resize(16).blur(1).webp({ quality: 40 }).toBuffer();
  return {
    width,
    height,
    sizes,
    color,
    lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
  };
}
