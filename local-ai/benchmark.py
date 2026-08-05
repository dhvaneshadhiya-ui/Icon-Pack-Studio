"""Benchmark local models on identical prompts: time, peak memory, output.

Usage:
  ./venv/bin/python benchmark.py --variant schnell --model-path ~/…/flux-schnell-4bit
  ./venv/bin/python benchmark.py --variant z-image --model-path ~/…/z-image-turbo-4bit

Writes <variant>-<n>.png next to the script and prints one CSV line per image
so runs can be compared directly.
"""
import argparse
import os
import time

import mlx.core as mx

PROMPTS = [
    ("gothic", "A haunting gothic cathedral interior at midnight, moonlight through shattered "
               "stained glass, ravens perched on broken stone arches, thick fog, crimson and deep "
               "violet palette, cinematic volumetric light, ultra detailed, vertical phone "
               "wallpaper composition, no text, no watermark"),
    ("neon", "A moody neon-noir alley at night, rain-slick asphalt, crimson and cyan signage "
             "glow, deep shadows, cinematic, vertical phone wallpaper, no text, no watermark"),
]


def build(variant: str, model_path: str):
    from mflux.models.common.config.model_config import ModelConfig

    if variant == "z-image":
        from mflux.models.z_image.variants.z_image import ZImage as Cls
        return Cls(quantize=4, model_path=model_path, model_config=ModelConfig.z_image_turbo()), 8, 2.0
    if variant == "klein":
        from mflux.models.flux.variants.txt2img.flux import Flux1 as Cls
        return Cls(quantize=4, model_path=model_path, model_config=ModelConfig.flux2_klein_4b()), 4, None
    from mflux.models.flux.variants.txt2img.flux import Flux1 as Cls
    return Cls(quantize=4, model_path=model_path, model_config=ModelConfig.schnell()), 4, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", required=True, choices=["schnell", "z-image", "klein"])
    ap.add_argument("--model-path", required=True)
    ap.add_argument("--size", default="768x1152")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--steps", type=int, help="override the variant's default step count")
    ap.add_argument("--only", help="run just this prompt name")
    args = ap.parse_args()
    w, h = (int(x) for x in args.size.split("x"))

    t_load = time.time()
    model, steps, guidance = build(args.variant, os.path.expanduser(args.model_path))
    if args.steps:
        steps = args.steps
    load_s = time.time() - t_load

    print(f"# variant={args.variant} steps={steps} guidance={guidance} "
          f"size={w}x{h} load={load_s:.0f}s")
    print("variant,prompt,seconds,peak_gb,png_kb")
    here = os.path.dirname(os.path.abspath(__file__))
    for name, prompt in PROMPTS:
        if args.only and name != args.only:
            continue
        mx.clear_cache()
        mx.reset_peak_memory()
        t0 = time.time()
        kwargs = {"guidance": guidance} if guidance is not None else {}
        result = model.generate_image(seed=args.seed, prompt=prompt,
                                      num_inference_steps=steps, height=h, width=w, **kwargs)
        secs = time.time() - t0
        peak = mx.get_peak_memory() / 1e9
        img = getattr(result, "image", result)
        out = os.path.join(here, f"bench-{args.variant}-{name}-{steps}st.png")
        img.save(out)
        kb = os.path.getsize(out) // 1024
        print(f"{args.variant},{name},{secs:.0f},{peak:.1f},{kb}")
        mx.clear_cache()


if __name__ == "__main__":
    main()
