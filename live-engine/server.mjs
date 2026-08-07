// Remotion render service for Icon Pack Studio live wallpapers.
//
// POST /render { image: dataURL, effect, seconds, fps?, width?, height? }
//   -> video/mp4 (H.264), rendered frame-by-frame (no realtime capture, so
//      no dropped frames and an exact seamless loop)
// GET  /health -> { ok, effects }
//
// Run: npm install && npm run server   (port 8081)
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { EFFECTS } from './src/effects.mjs';

const PORT = 8081;
const app = express();
app.use(express.json({ limit: '60mb' }));
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let bundleUrl = null;
let bundling = null;

// Bundle once, lazily — the first render pays ~20 s, the rest are instant.
async function getBundle() {
  if (bundleUrl) return bundleUrl;
  if (!bundling) {
    bundling = bundle({
      entryPoint: path.join(import.meta.dirname, 'src', 'index.js'),
      onProgress: (p) => {
        if (p % 25 === 0) console.log(`bundling ${p}%`);
      },
    }).then((url) => {
      bundleUrl = url;
      console.log('bundle ready');
      return url;
    });
  }
  return bundling;
}

app.get('/health', async (_req, res) => {
  res.json({ ok: true, effects: EFFECTS, engine: 'remotion' });
});

// one render at a time — Remotion opens a headless browser per job
let busy = false;

app.post('/render', async (req, res) => {
  if (busy) return res.status(429).json({ error: 'A render is already running.' });
  const {
    image,
    effect = 'Zoom in',
    seconds = 5,
    fps = 30,
    width = 1080,
    height = 1920,
  } = req.body || {};
  if (!image?.startsWith('data:image/')) {
    return res.status(400).json({ error: 'image must be a data: URL' });
  }
  busy = true;
  const out = path.join(os.tmpdir(), `live-${Date.now()}.mp4`);
  try {
    const serveUrl = await getBundle();
    const durationInFrames = Math.max(1, Math.round(seconds * fps));
    const inputProps = { src: image, effect };
    const composition = await selectComposition({
      serveUrl,
      id: 'live-wallpaper',
      inputProps,
    });
    const t0 = Date.now();
    await renderMedia({
      composition: { ...composition, durationInFrames, fps, width, height },
      serveUrl,
      codec: 'h264',
      crf: 18,             // visually lossless for a wallpaper loop
      outputLocation: out,
      inputProps,
      concurrency: 2,      // keep headroom on a 16 GB machine
    });
    console.log(`rendered ${effect} ${width}x${height} ${seconds}s in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    res.set('Content-Type', 'video/mp4');
    res.send(await fs.readFile(out));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  } finally {
    await fs.rm(out, { force: true });
    busy = false;
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`live-engine (Remotion) on http://localhost:${PORT}`);
  getBundle().catch((e) => console.error('bundle failed', e));
});
