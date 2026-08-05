#!/bin/bash
# Start the local uncensored image server (FLUX.1-schnell 4-bit on MLX).
# First run: creates a venv at ~/IconPackLocalAI, installs mflux, downloads
# the ~9 GB pre-quantized model. After that it starts in seconds.
set -euo pipefail

HOME_DIR="$HOME/IconPackLocalAI"
VENV="$HOME_DIR/venv"
MODEL_DIR="$HOME_DIR/flux-schnell-4bit"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
  echo "Downloading FLUX.1-schnell 4-bit (~9 GB, one time)…"
  "$VENV/bin/python" - <<'PY'
from huggingface_hub import snapshot_download
import os
snapshot_download(
    "mflux-community/flux-1-schnell-mflux-q4",
    local_dir=os.path.expanduser("~/IconPackLocalAI/flux-schnell-4bit"),
)
PY
fi

exec "$VENV/bin/python" "$SCRIPT_DIR/server.py" --model-path "$MODEL_DIR" --port 8080
