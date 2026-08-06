#!/bin/bash
# Start the local uncensored image server (Z-Image Turbo 4-bit on MLX).
# First run: creates a venv at ~/IconPackLocalAI, installs mflux, downloads
# the ~5.9 GB pre-quantized model. After that it starts in about a minute.
#
#   ./run.sh                    # Z-Image Turbo, 6 steps (default)
#   ./run.sh --steps 4          # ~30% faster, still looks good
#   ./run.sh --variant schnell  # the older FLUX model (needs its own weights)
set -euo pipefail

HOME_DIR="$HOME/IconPackLocalAI"
VENV="$HOME_DIR/venv"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# parse --variant out of the args so we know which weights to fetch
VARIANT="z-image"
ARGS=("$@")
for i in "${!ARGS[@]}"; do
  if [ "${ARGS[$i]}" = "--variant" ]; then VARIANT="${ARGS[$((i+1))]}"; fi
done

case "$VARIANT" in
  z-image) REPO="mflux-community/z-image-turbo-mflux-q4"; MODEL_DIR="$HOME_DIR/z-image-turbo-4bit" ;;
  klein)   REPO="mflux-community/flux2-klein-4b-mflux-q4"; MODEL_DIR="$HOME_DIR/flux2-klein-4b" ;;
  *)       REPO="mflux-community/flux-1-schnell-mflux-q4"; MODEL_DIR="$HOME_DIR/flux-schnell-4bit" ;;
esac

mkdir -p "$HOME_DIR"

if [ ! -x "$VENV/bin/python" ]; then
  echo "Creating venv…"
  python3 -m venv "$VENV"
  "$VENV/bin/python" -m pip install --upgrade pip
fi

"$VENV/bin/python" -c "import mflux, fastapi, uvicorn" 2>/dev/null || {
  echo "Installing mflux + server deps (one time)…"
  "$VENV/bin/python" -m pip install mflux fastapi uvicorn
}

if [ ! -f "$MODEL_DIR/transformer/model.safetensors.index.json" ]; then
  echo "Downloading $REPO (one time)…"
  # Xet backend has been flaky on slow links; plain HTTPS + retries is safer
  HF_HUB_DISABLE_XET=1 "$VENV/bin/python" - "$REPO" "$MODEL_DIR" <<'PY'
import sys
from huggingface_hub import snapshot_download
repo, dest = sys.argv[1], sys.argv[2]
for attempt in range(1, 6):
    try:
        snapshot_download(repo, local_dir=dest, max_workers=2)
        break
    except Exception as e:
        print(f"retry {attempt}: {type(e).__name__}: {e}", flush=True)
else:
    raise SystemExit("download failed after 5 attempts")
PY
fi

# Supervisor loop: macOS can kill a long GPU command buffer with
# "[METAL] Command buffer execution failed: Impacting Interactivity", which
# aborts the process. Relaunch so a crash costs a model reload, not the
# session. Ctrl-C still exits cleanly.
trap 'echo; echo "stopped."; exit 0' INT TERM
while true; do
  "$VENV/bin/python" "$SCRIPT_DIR/server.py" --model-path "$MODEL_DIR" --port 8080 "$@" && break
  echo "--- server exited unexpectedly (likely the Metal GPU watchdog); restarting in 3s"
  echo "    if this repeats, use a smaller size or --steps 4, and avoid other GPU-heavy apps"
  sleep 3
done
