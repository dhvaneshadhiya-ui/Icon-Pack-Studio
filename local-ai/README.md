# Local uncensored image server

Z-Image Turbo (6B) quantized to 4-bit, running natively on Apple Silicon via
[mflux](https://github.com/filipstrand/mflux)/MLX, wrapped in an
OpenAI-compatible `POST /v1/images/generations` endpoint on
`http://localhost:8080`.

## Why Z-Image and not FLUX

Benchmarked on this 16 GB M1 (identical prompt and seed, 768×1152,
`benchmark.py`):

| | FLUX.1-schnell (12B) | **Z-Image Turbo (6B)** |
|---|---|---|
| Peak memory | 17.2 GB — exceeds RAM, swaps hard | **11.8 GB — fits** |
| Time @ default steps | 185 s (4 steps) | 214 s (6 steps) |
| Time @ 4 steps | — | **143 s** |
| Disk | 9.0 GB | **5.9 GB** |

FLUX's peak is larger than the machine's physical memory, so every render
pushes the rest of the system into swap. Z-Image fits, so the Mac stays
responsive. Quality is comparable or better.

Caveat: Z-Image renders text well and will add signage unprompted — put
"no text, no signage, no lettering" in the negatives for wallpapers.

Why: OpenAI over-blocks legal themes (horror, gothic, weapons, dark action).
This runs on your own Mac — **no content filter, no API key, no per-image
cost, fully offline** after the one-time model download.

## Start

```bash
./run.sh
```

First run installs everything and downloads ~5.9 GB of weights into
`~/IconPackLocalAI/`; later runs start in about a minute (model load).

```bash
./run.sh --steps 4          # ~30% faster, quality holds up well
./run.sh --variant schnell  # the older FLUX model (downloads its own weights)
```

## Use from the Studio

⚙ Settings → Provider → **Local · LocalAI / ComfyUI** → Save. No key needed.
Generate wallpapers/icons exactly as with OpenAI.

## Notes

- **Reference images work** via `POST /v1/images/edits` (img2img). mflux takes
  one reference, so only the first attachment is used. The Studio shows a
  **Reference influence** slider when a reference is attached on the local
  provider: ~0.30 keeps the reference's palette and mood while your prompt
  drives the subject (a matching set); above ~0.55 it largely recreates the
  reference.
- **Known crash:** macOS can abort a long GPU command with
  `[METAL] Command buffer execution failed: Impacting Interactivity` — its
  watchdog for GPU work that blocks the UI. `run.sh` supervises the server
  and restarts it automatically. To avoid it: smaller sizes, `--steps 4`,
  and don't run other GPU-heavy apps during a batch.
- Use the Studio's **"Portrait (fast)" (768×1152)** aspect for local runs —
  the 4K save sizes upscale from there, and it is roughly twice as fast as
  full 1024×1536. Sizes are capped at 1024×1536 and rounded to multiples of
  16. Batches run one at a time to stay inside unified memory.
- Weights live in `~/IconPackLocalAI/` (Z-Image 5.9 GB; FLUX 9 GB if you
  fetched it). The venv is at `~/IconPackLocalAI/venv`. Delete that folder
  to uninstall everything.
- `benchmark.py` reruns the comparison:
  `./venv/bin/python benchmark.py --variant z-image --model-path ~/IconPackLocalAI/z-image-turbo-4bit`
- Reference images (the images/edits endpoint) are OpenAI-only — the local
  route is prompt-only.
- Character IP rules still apply: the model will happily draw Spider-Man,
  but selling that through CrestWall/Gumroad is still infringement. Use the
  skill's INSPIRED-ORIGINAL transform for anything that ships.
