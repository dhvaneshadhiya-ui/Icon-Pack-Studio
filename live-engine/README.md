# Live wallpaper engine (Remotion)

Renders live-wallpaper loops **frame by frame** instead of capturing the
browser in real time. Optional: the Studio falls back to its in-browser
MediaRecorder path when this service isn't running.

## Why use it

| | In-browser (MediaRecorder) | **Remotion engine** |
|---|---|---|
| Capture | realtime — drops frames when the Mac is busy | frame-by-frame, deterministic |
| Loop | close enough | **exact** (measured 1/255 mean difference across the wrap) |
| Encoding | fixed bitrate, browser-controlled | H.264 CRF 18 via ffmpeg |
| Effects | 7 canvas effects | those **+ Parallax + Depth pulse** (layered, masked, blurred) |
| Speed | realtime (4 s clip = 4 s) | ~16 s per 4 s clip at 1080×1920 |

The trade is wall-clock time for quality and determinism — worth it for
anything shipping to CrestWall or Gumroad.

## Run

```bash
cd live-engine
npm install     # first time
npm run server  # http://localhost:8081
```

The Studio detects it automatically (Wallpapers → Live shows
"✓ Remotion engine" and the extra effects). First render downloads
Remotion's headless Chrome once.

## Editing the motion

```bash
npm run studio   # Remotion Studio: live-edit the compositions
```

Effects live in `src/LiveWallpaper.jsx`. The rule for every effect: it must
be a function of loop position `t ∈ [0,1)` where `f(0) === f(1)`, or the
loop will visibly jump. `pingPong()` gives that for free; anything using
raw `t` must complete a whole number of cycles.

Add a new effect in both `src/LiveWallpaper.jsx` (the visual) and
`src/effects.mjs` (the shared name list — Node can't import JSX).

## API

```
GET  /health  -> { ok, effects, engine }
POST /render  { image: dataURL, effect, seconds, fps?, width?, height? } -> video/mp4
```

One render at a time; each opens a headless browser.

## Licensing

Remotion is free for individuals and companies up to 3 people, and requires
a paid Company License at 4+ (employees are aggregated across collaborating
parties). Selling the resulting wallpapers is permitted under the free
license if you qualify. See https://www.remotion.dev/docs/license
