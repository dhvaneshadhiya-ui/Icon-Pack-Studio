// Depth-effect wallpaper composer.
//
// iOS 16+ lifts a photo's subject IN FRONT of the Lock Screen clock. It is not
// a file format — iOS segments the subject itself at set-wallpaper time. Our
// job is purely compositional: produce a flat image whose subject is
// well-separated and positioned so it overlaps the clock band.
//
// Rules encoded here (from how iOS behaves):
//  - the clock occupies roughly 12%–27% of screen height
//  - the subject must CROSS that band for any lift to be visible
//  - it must not blanket the band, or iOS drops depth to keep time readable
//  - flat/abstract art rarely segments; a clear figure or object does
import { svgToPng } from './svg.js';
import { wallpaperArt } from './wallpapers.js';

export const CLOCK_BAND = { top: 0.12, bottom: 0.27 };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Composite background + subject into a flat wallpaper.
 * subject: { url, x, y, scale }  — x/y are the subject centre as 0..1 of W/H
 * background: { kind: 'art', p, style } | { kind: 'image', url }
 */
export async function composeDepth({ background, subject, W, H }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (background.kind === 'image' && background.url) {
    const bg = await loadImage(background.url);
    // cover-fit
    const k = Math.max(W / bg.width, H / bg.height);
    const dw = bg.width * k;
    const dh = bg.height * k;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    const svg = wallpaperArt(background.p, background.style, W, H, 'depth-bg');
    const blob = await svgToPng(svg, W, H);
    const bg = await loadImage(URL.createObjectURL(blob));
    ctx.drawImage(bg, 0, 0, W, H);
  }

  if (subject?.url) {
    const s = await loadImage(subject.url);
    const target = W * (subject.scale ?? 0.8);
    const k = target / s.width;
    const dw = s.width * k;
    const dh = s.height * k;
    ctx.drawImage(s, W * subject.x - dw / 2, H * subject.y - dh / 2, dw, dh);
  }

  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

/**
 * Check the subject actually crosses the clock band — the difference between
 * a depth wallpaper and an ordinary one.
 */
export function depthAdvice(subject, subjectAspect = 1.4) {
  if (!subject?.url) return { ok: false, msg: 'Add a subject cut-out (PNG with transparent background).' };
  // subject height as a fraction of screen height, using the rendered aspect
  const hFrac = ((subject.scale ?? 0.8) * subjectAspect) / 1.777; // W/H of 9:16
  const top = subject.y - hFrac / 2;
  const bottom = subject.y + hFrac / 2;
  if (top > CLOCK_BAND.bottom) {
    return { ok: false, msg: 'Subject sits below the clock — raise it so its top crosses the guide band, or iOS shows no depth.' };
  }
  if (bottom < CLOCK_BAND.top) {
    return { ok: false, msg: 'Subject is entirely above the clock — lower it into the guide band.' };
  }
  if (top < CLOCK_BAND.top && bottom > CLOCK_BAND.bottom && (subject.scale ?? 0.8) > 0.95) {
    return { ok: true, warn: true, msg: 'Subject covers the whole clock band — iOS may disable depth to keep the time readable. Try a smaller scale.' };
  }
  return { ok: true, msg: 'Subject crosses the clock band — depth effect should trigger.' };
}
