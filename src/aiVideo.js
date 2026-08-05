// Prompt → video via the OpenAI Videos API (sora-2, $0.10/s at 720×1280),
// using the same key as image generation. Flow: create job → poll → download
// MP4. NOTE: OpenAI retires /v1/videos + sora-2 on 2026-09-24; the model is
// configurable in Settings for whatever replaces it.
import { loadAiCfg } from './aiConfig.js';

export const VIDEO_SECONDS = [4, 8, 12];
export const VIDEO_COST_PER_SEC = 0.10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function apiBase(cfg) {
  // derive https://host/v1 from the images endpoint so custom endpoints work
  return (cfg.endpoint || 'https://api.openai.com/v1/images/generations').replace(/\/v1\/.*$/, '/v1');
}

export async function generateVideo({ prompt, seconds = 4, size = '720x1280', onProgress }) {
  const cfg = loadAiCfg();
  if (!cfg.key) throw new Error('Add your API key in ⚙ Settings first.');
  const base = apiBase(cfg);
  const auth = { Authorization: `Bearer ${cfg.key}` };
  const create = await fetch(`${base}/videos`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.videoModel || 'sora-2',
      prompt,
      seconds: String(seconds),
      size,
    }),
  });
  if (!create.ok) throw new Error(`HTTP ${create.status}: ${(await create.text()).slice(0, 200)}`);
  let job = await create.json();
  while (job.status === 'queued' || job.status === 'in_progress') {
    onProgress?.(`Rendering… ${Math.round(job.progress ?? 0)}%`);
    await sleep(5000);
    const r = await fetch(`${base}/videos/${job.id}`, { headers: auth });
    if (!r.ok) throw new Error(`HTTP ${r.status} while polling`);
    job = await r.json();
  }
  if (job.status !== 'completed') {
    throw new Error(job.error?.message || `Video generation ${job.status}`);
  }
  onProgress?.('Downloading…');
  const content = await fetch(`${base}/videos/${job.id}/content`, { headers: auth });
  if (!content.ok) throw new Error(`HTTP ${content.status} downloading video`);
  return content.blob(); // video/mp4
}

function loadVideo(src) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('Could not load video'));
    v.src = src;
  });
}

function drawVideoCover(ctx, v, W, H, alpha = 1) {
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return;
  const k = Math.max(W / vw, H / vh);
  const dw = vw * k, dh = vh * k;
  ctx.globalAlpha = alpha;
  ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
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
 * Re-encode a clip into a seamless loop with a tail→head crossfade.
 * Output duration = source − fade; out(0) and out(end) are the same frame
 * (source at t=fade), so the loop has no visible seam.
 * Runs in real time: two <video> elements over a recorded canvas.
 */
export async function smoothLoop({ src, fade = 1, onProgress }) {
  const main = await loadVideo(src);
  const overlay = await loadVideo(src);
  const D = main.duration;
  if (!isFinite(D) || D <= fade + 0.5) throw new Error('Clip too short for a crossfade loop.');
  const L = D - fade;
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

  main.currentTime = fade; // skip the head; the crossfade re-introduces it
  await new Promise((r) => { main.onseeked = r; });
  drawVideoCover(ctx, main, W, H);
  rec.start(250);
  await main.play();
  const t0 = performance.now();
  let overlayStarted = false;
  await new Promise((resolve) => {
    const iv = setInterval(async () => {
      const el = (performance.now() - t0) / 1000;
      if (el >= L) {
        clearInterval(iv);
        return resolve();
      }
      drawVideoCover(ctx, main, W, H);
      if (el >= L - fade) {
        if (!overlayStarted) {
          overlayStarted = true;
          overlay.currentTime = 0;
          overlay.play();
        }
        drawVideoCover(ctx, overlay, W, H, Math.min(1, (el - (L - fade)) / fade));
      }
      onProgress?.(`Looping… ${Math.ceil(L - el)}s`);
    }, 1000 / 30);
  });
  main.pause();
  overlay.pause();
  rec.stop();
  await done;
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext };
}
