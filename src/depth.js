// Depth-effect wallpapers.
//
// iOS 16+ segments a wallpaper's subject ON DEVICE and slides the Lock Screen
// clock behind its upper edge. There is no special file format and no layering
// on our side — the production method is a SINGLE flat image whose composition
// obeys the rules:
//  - subject slightly below center, its upper edge extending into the clock area
//  - upper 35–45% of the frame mostly clean (clock + Dynamic Island)
//  - clean silhouette, strong subject/background separation, shallow depth of field
//  - subject must not hide too many clock numbers, or iOS disables the effect
//  - large Lock Screen widgets near the top also disable it
// The clock-band preview in the Wallpapers tab is a validation view; the manual
// compositor below is a secondary tool for hand-assembled cut-outs.
import { svgToPng } from './svg.js';
import { wallpaperArt } from './wallpapers.js';

export const CLOCK_BAND = { top: 0.12, bottom: 0.27 };

// House production prompts (CrestWall). [SUBJECT] is replaced by the user.
export const DEPTH_PROMPT_TEMPLATE =
  "Create a premium iPhone lock screen wallpaper featuring [SUBJECT]. Compose it specifically for Apple's Depth Effect. Place the main subject slightly below center with its upper portion extending naturally toward the top of the frame so that part of the silhouette overlaps the future clock area. Keep the top 35–45% mostly clean with elegant negative space while allowing only the upper edge of the subject to intersect the clock region. Use strong foreground-background separation, a clean silhouette, cinematic lighting, shallow depth of field, and minimal visual clutter around the subject. Leave safe space around the Dynamic Island. Vertical 9:19.5 (1290×2796). Wallpaper quality. Ultra-detailed. Premium aesthetic. No text, no watermark, no logos, no UI, no borders, no mockup. Optimized for Apple Lock Screen Depth Effect.";

// Compact spec that can be appended to any wallpaper prompt.
export const DEPTH_SPEC =
  'Optimized for Apple iPhone Lock Screen Depth Effect. Vertical 9:19.5 (1290×2796). Leave the upper 35–45% mostly clean for the clock and Dynamic Island. Position the main subject slightly below center with a small portion extending into the clock area. Maintain a clean silhouette, strong subject-background separation, shallow depth of field, minimal background clutter, and avoid important details behind the Dynamic Island. Wallpaper quality. No text, logos, watermark, UI, borders, or mockups.';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Composite background + subject into a flat wallpaper (manual path).
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
