# Local uncensored image server

FLUX.1-schnell (Apache-2.0) quantized to 4-bit, running natively on Apple
Silicon via [mflux](https://github.com/filipstrand/mflux)/MLX, wrapped in an
OpenAI-compatible `POST /v1/images/generations` endpoint on
`http://localhost:8080`.

Why: OpenAI over-blocks legal themes (horror, gothic, weapons, dark action).
This runs on your own Mac — **no content filter, no API key, no per-image
cost, fully offline** after the one-time model download.

## Start

```bash
./run.sh
```

First run installs everything and downloads ~9 GB of weights into
`~/IconPackLocalAI/`; later runs start in about a minute (model load).

## Use from the Studio

⚙ Settings → Provider → **Local · LocalAI / ComfyUI** → Save. No key needed.
Generate wallpapers/icons exactly as with OpenAI.

## Notes

- ~16 GB M1: a 1024×1536 wallpaper takes a few minutes (4 inference steps).
  Sizes are capped at 1024×1536 and rounded to multiples of 16; the Studio's
  4K save sizes upscale from there as usual.
- Reference images (the images/edits endpoint) are OpenAI-only — the local
  route is prompt-only.
- Character IP rules still apply: the model will happily draw Spider-Man,
  but selling that through CrestWall/Gumroad is still infringement. Use the
  skill's INSPIRED-ORIGINAL transform for anything that ships.
