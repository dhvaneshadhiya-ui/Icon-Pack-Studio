"""Local uncensored image server for Icon Pack Studio.

Exposes an OpenAI-compatible POST /v1/images/generations on localhost:8080,
backed by FLUX.1-schnell (4-bit, Apache-2.0) running on Apple Silicon via
mflux/MLX (API verified against mflux 0.18). No API key, no content filter,
no per-image cost, fully offline after the first model download.

Run:  ./run.sh   (from this directory)
Then in the Studio: ⚙ Settings → Provider → "Local · LocalAI / ComfyUI".
"""
import argparse
import base64
import concurrent.futures
import io
import os
import random
import re
import tempfile
import time

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # browser calls from localhost:5173 / netlify
    allow_methods=["*"],
    allow_headers=["*"],
)

FLUX = None
# MLX binds GPU streams to the thread that created them, and Z-Image evaluates
# on an explicit stream — so the model must be loaded AND used on one single
# thread. A 1-worker executor gives us that, and serializes generation for
# free (which we want anyway on 16 GB).
WORKER = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="mflux")
MODEL_NAME = "z-image-turbo-4bit"
STEPS = 6
GUIDANCE = None  # z-image-turbo likes ~2.0; flux schnell ignores guidance


def load_flux(model_path: str, variant: str = "schnell"):
    """Z-Image uses its own class and returns a bare PIL image; FLUX returns a
    GeneratedImage wrapper. Both take the same constructor args."""
    from mflux.models.common.config.model_config import ModelConfig

    global FLUX, MODEL_NAME, STEPS, GUIDANCE
    if variant == "z-image":
        from mflux.models.z_image.variants.z_image import ZImage as Cls
        # distilled for 8, but 6 is visually equivalent and ~30% faster;
        # 4 still looks good if you want the fastest run
        model_cfg, STEPS, MODEL_NAME, GUIDANCE = ModelConfig.z_image_turbo(), 6, "z-image-turbo-4bit", 2.0
    elif variant == "klein":
        from mflux.models.flux.variants.txt2img.flux import Flux1 as Cls
        model_cfg, STEPS, MODEL_NAME, GUIDANCE = ModelConfig.flux2_klein_4b(), 4, "flux2-klein-4b", None
    else:
        from mflux.models.flux.variants.txt2img.flux import Flux1 as Cls
        model_cfg, STEPS, MODEL_NAME, GUIDANCE = ModelConfig.schnell(), 4, "flux.1-schnell-4bit", None

    FLUX = Cls(quantize=4, model_path=model_path, model_config=model_cfg)
    print(f"Model loaded: {MODEL_NAME} ({STEPS} steps)")


class GenRequest(BaseModel):
    prompt: str
    model: str | None = None
    n: int = 1
    size: str | None = "1024x1536"


def parse_size(size: str | None):
    m = re.match(r"^(\d+)x(\d+)$", size or "")
    w, h = (int(m.group(1)), int(m.group(2))) if m else (1024, 1536)
    # multiples of 16, capped for 16 GB of unified memory
    w = max(256, min(1024, w // 16 * 16))
    h = max(256, min(1536, h // 16 * 16))
    return w, h


@app.get("/v1/models")
def models():
    return {"data": [{"id": MODEL_NAME, "object": "model"}]}


def _render(prompt: str, w: int, h: int, n: int, image_path: str | None = None,
            image_strength: float = 0.30):
    """Runs on the single mflux worker thread — never call directly.

    image_path turns this into img2img: the reference steers composition and
    palette. image_strength is how much of the reference to keep — measured
    on this setup: ~0.3 keeps the palette/mood while the prompt drives the
    subject (the useful default), ~0.55+ essentially reproduces the
    reference and ignores the prompt."""
    import mlx.core as mx

    out = []
    for _ in range(n):
        seed = random.randint(0, 2**31 - 1)
        t0 = time.time()
        kwargs = {"guidance": GUIDANCE} if GUIDANCE is not None else {}
        if image_path:
            kwargs["image_path"] = image_path
            kwargs["image_strength"] = image_strength
        result = FLUX.generate_image(
            seed=seed,
            prompt=prompt,
            num_inference_steps=STEPS,
            height=h,
            width=w,
            **kwargs,
        )
        # ZImage returns a PIL image; Flux1 returns a GeneratedImage wrapper
        img = getattr(result, "image", result)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        print(f"generated {w}x{h} seed={seed} in {time.time() - t0:.0f}s", flush=True)
        out.append({"b64_json": base64.b64encode(buf.getvalue()).decode()})
        # hand MLX's buffer cache back to the OS so the rest of the
        # system isn't left swapped out after a batch
        mx.clear_cache()
    return out


@app.post("/v1/images/generations")
def generate(req: GenRequest):
    w, h = parse_size(req.size)
    n = max(1, min(4, req.n))
    out = WORKER.submit(_render, req.prompt, w, h, n).result()
    return {"created": int(time.time()), "data": out}


@app.post("/v1/images/edits")
async def edits(
    prompt: str = Form(...),
    n: int = Form(1),
    size: str = Form("1024x1536"),
    image_strength: float = Form(0.30),
    image: list[UploadFile] = File(default=[], alias="image[]"),
):
    """Reference-image generation (img2img).

    The Studio posts here whenever references are attached. mflux takes a
    single reference, so only the first upload is used — say so in the
    response header rather than silently ignoring the rest.
    """
    w, h = parse_size(size)
    if not image:
        out = WORKER.submit(_render, prompt, w, h, max(1, min(4, n))).result()
        return {"created": int(time.time()), "data": out}

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    try:
        tmp.write(await image[0].read())
        tmp.close()
        if len(image) > 1:
            print(f"note: {len(image)} references sent, using the first "
                  f"(mflux img2img takes one)", flush=True)
        out = WORKER.submit(
            _render, prompt, w, h, max(1, min(4, n)), tmp.name, image_strength
        ).result()
    finally:
        os.unlink(tmp.name)
    return {"created": int(time.time()), "data": out}


if __name__ == "__main__":
    import uvicorn

    ap = argparse.ArgumentParser()
    ap.add_argument("--model-path", required=True, help="dir with the mflux 4-bit weights")
    ap.add_argument("--variant", default="z-image", choices=["schnell", "z-image", "klein"])
    ap.add_argument("--steps", type=int, help="override the variant's default step count")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    print(f"Loading {args.variant} 4-bit (first load takes a minute)…")
    # load on the same worker thread that will run generation — MLX streams
    # are thread-bound
    WORKER.submit(load_flux, args.model_path, args.variant).result()
    if args.steps:
        STEPS = args.steps
        print(f"Step override: {STEPS}")
    uvicorn.run(app, host="127.0.0.1", port=args.port)
