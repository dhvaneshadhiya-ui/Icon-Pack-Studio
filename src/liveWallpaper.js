// In-app live wallpaper animator: turns a still wallpaper into a seamless
// motion loop, recorded straight from a canvas to MP4 (H.264 where the
// browser supports it, WebM fallback). No external video model needed —
// convert the file to a Live Photo on the phone with intoLive / Photos.
//
// Every effect is periodic in t ∈ [0,1] with frame(1) === frame(0), so the
// exported clip loops seamlessly by construction.

export const LIVE_EFFECTS = {
  'Zoom in': 'Slow push toward the subject and back — the classic Ken Burns breath.',
  'Zoom out': 'Starts close, eases out to the full frame and back.',
  'Drift up': 'Gentle vertical pan, like a slow crane move.',
  'Drift left': 'Gentle horizontal pan across the scene.',
  'Breathe': 'Subtle scale + brightness pulse — calm, ambient.',
  'Light sweep': 'A soft diagonal light band sweeps across the image.',
  'Dust motes': 'Floating particles drifting over the scene.',
};

export const LIVE_DURATIONS = [4, 5, 6];

// The Remotion render service (live-engine/server.mjs) renders frame-by-frame
// instead of capturing in realtime: no dropped frames, exact loops, proper
// H.264 encoding, and richer effects. Optional — we fall back to the
// in-browser MediaRecorder path when it isn't running.
export const REMOTION_URL = 'http://localhost:8081';

export async function remotionAvailable() {
  try {
    const r = await fetch(`${REMOTION_URL}/health`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return null;
    const j = await r.json();
    return j.ok ? j.effects : null;
  } catch {
    return null;
  }
}

export async function renderViaRemotion({ imageUrl, effect, seconds, onProgress }) {
  onProgress?.('Rendering with Remotion…');
  const res = await fetch(`${REMOTION_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageUrl, effect, seconds }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* keep status */ }
    throw new Error(msg);
  }
  return { blob: await res.blob(), ext: 'mp4' };
}

// smooth ping-pong: 0 → 1 → 0 with zero velocity at both ends
const pp = (t) => (1 - Math.cos(2 * Math.PI * t)) / 2;

// deterministic particles so preview and recording match
const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const s = Math.sin(i * 127.1) * 43758.5453;
  const r = (k) => {
    const v = Math.sin((i + 1) * (k + 1) * 91.7) * 24634.6345;
    return v - Math.floor(v);
  };
  return {
    x: r(1), y: r(2),
    amp: 0.01 + r(3) * 0.03,      // drift amplitude (fraction of W/H)
    phase: r(4) * Math.PI * 2,
    size: 1.5 + r(5) * 3,
    alpha: 0.25 + r(6) * 0.4,
    cycles: 1 + Math.round(r(7) * 2), // integer → periodic over the loop
  };
});

function drawCover(ctx, img, W, H, scale = 1, ox = 0, oy = 0) {
  const k = Math.max(W / img.width, H / img.height) * scale;
  const dw = img.width * k;
  const dh = img.height * k;
  ctx.drawImage(img, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh);
}

/** Draw one frame of `effect` at loop position t ∈ [0,1]. */
export function drawLiveFrame(ctx, img, effect, t, W, H) {
  const p = pp(t);
  ctx.clearRect(0, 0, W, H);
  switch (effect) {
    case 'Zoom in':
      drawCover(ctx, img, W, H, 1 + 0.09 * p);
      break;
    case 'Zoom out':
      drawCover(ctx, img, W, H, 1.09 - 0.09 * p);
      break;
    case 'Drift up':
      drawCover(ctx, img, W, H, 1.08, 0, (p - 0.5) * H * 0.05);
      break;
    case 'Drift left':
      drawCover(ctx, img, W, H, 1.08, (0.5 - p) * W * 0.06, 0);
      break;
    case 'Breathe': {
      drawCover(ctx, img, W, H, 1 + 0.03 * p);
      ctx.fillStyle = `rgba(255,255,255,${0.05 * p})`;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'Light sweep': {
      drawCover(ctx, img, W, H, 1.02);
      const pos = t; // one full sweep per loop — periodic by construction
      const x = (pos * 2 - 0.5) * W;
      const g = ctx.createLinearGradient(x - W * 0.35, 0, x + W * 0.35, H * 0.4);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.14)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'Dust motes': {
      drawCover(ctx, img, W, H, 1.02);
      for (const m of PARTICLES) {
        const a = t * Math.PI * 2 * m.cycles + m.phase;
        const x = (m.x + Math.sin(a) * m.amp) * W;
        const y = (m.y + Math.cos(a * 0.9 + 1.3) * m.amp) * H;
        const tw = 0.6 + 0.4 * Math.sin(a * 1.7);
        ctx.beginPath();
        ctx.arc(x, y, m.size * (W / 1080), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${m.alpha * tw})`;
        ctx.fill();
      }
      break;
    }
    default:
      drawCover(ctx, img, W, H);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function pickMime() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  for (const m of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  }
  return '';
}

/**
 * Record `seconds` of the effect at 1080×1920/30fps in real time.
 * Returns { blob, ext } — ext is 'mp4' when the browser muxes H.264
 * (Chrome 126+, Safari), else 'webm'.
 */
export async function recordLiveWallpaper({ imageUrl, effect, seconds = 5, onProgress }) {
  const img = await loadImage(imageUrl);
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const mime = pickMime();
  if (!mime) throw new Error('This browser cannot record video (MediaRecorder unsupported).');
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => { rec.onstop = res; });

  drawLiveFrame(ctx, img, effect, 0, W, H);
  rec.start(250);
  const t0 = performance.now();
  // interval-driven (not rAF) so recording still progresses when the page
  // isn't the focused surface
  await new Promise((resolve) => {
    const iv = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      if (el >= seconds) {
        clearInterval(iv);
        return resolve();
      }
      drawLiveFrame(ctx, img, effect, (el % seconds) / seconds, W, H);
      onProgress?.(`Recording… ${Math.ceil(seconds - el)}s`);
    }, 1000 / 30);
  });
  drawLiveFrame(ctx, img, effect, 0, W, H); // land exactly on the loop start
  rec.stop();
  await done;
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext };
}
