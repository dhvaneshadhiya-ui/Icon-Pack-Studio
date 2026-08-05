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
import io
import random
import re
import threading
import time

from fastapi import FastAPI
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
FLUX_LOCK = threading.Lock()  # one generation at a time (16 GB M1)
MODEL_NAME = "flux.1-schnell-4bit"


def load_flux(model_path: str):
    from mflux.models.common.config.model_config import ModelConfig
    from mflux.models.flux.variants.txt2img.flux import Flux1

    global FLUX
    FLUX = Flux1(
        quantize=4,
        model_path=model_path,
        model_config=ModelConfig.schnell(),
    )
    print("Model loaded.")


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


@app.post("/v1/images/generations")
def generate(req: GenRequest):
    w, h = parse_size(req.size)
    out = []
    with FLUX_LOCK:
        for _ in range(max(1, min(4, req.n))):
            seed = random.randint(0, 2**31 - 1)
            t0 = time.time()
            result = FLUX.generate_image(
                seed=seed,
                prompt=req.prompt,
                num_inference_steps=4,  # schnell is trained for 4 steps
                height=h,
                width=w,
            )
            buf = io.BytesIO()
            result.image.save(buf, format="PNG")
            print(f"generated {w}x{h} seed={seed} in {time.time() - t0:.0f}s")
            out.append({"b64_json": base64.b64encode(buf.getvalue()).decode()})
    return {"created": int(time.time()), "data": out}


if __name__ == "__main__":
    import uvicorn

    ap = argparse.ArgumentParser()
    ap.add_argument("--model-path", required=True, help="dir with the mflux 4-bit schnell weights")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    print("Loading FLUX.1-schnell 4-bit (first load takes a minute)…")
    load_flux(args.model_path)
    uvicorn.run(app, host="127.0.0.1", port=args.port)
