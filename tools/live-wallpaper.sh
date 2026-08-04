#!/usr/bin/env bash
# live-wallpaper.sh — prepare a video for use as an iOS live wallpaper.
#
#   ./tools/live-wallpaper.sh input.mp4 "Spider Swing" [seconds]
#
# Produces, in build-out/live/<name>/:
#   <name>.mov        H.264 MOV, 1080x1920, 30fps, trimmed, seamlessly looped,
#                     audio stripped — the file users convert to a Live Photo
#   <name>-still.jpg  the key frame (what shows when the wallpaper is static)
#   <name>-cover.jpg  a 3x3 contact sheet for listings
#   README.txt        buyer instructions
#
# WHY A MOV, NOT A FINISHED LIVE PHOTO: Apple's DTS has confirmed that
# programmatically created Live Photos have UNDOCUMENTED requirements to be
# wallpaper-eligible — they play in Photos but report "Motion not available"
# on the Lock Screen, and Apple advises against reverse-engineering it.
# The reliable path is to ship the motion file and let the user's Live Photo
# converter (intoLive etc.) or a native capture path produce the pairing.
# See: https://developer.apple.com/forums/thread/798044
set -euo pipefail

FFMPEG="${FFMPEG:-$(command -v ffmpeg || echo "$HOME/.npm-global/bin/ffmpeg")}"
IN="${1:?usage: live-wallpaper.sh input.mp4 \"Name\" [seconds]}"
NAME="${2:-Live Wallpaper}"
SECS="${3:-4}"

SLUG=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-//; s/-$//')
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build-out/live/$SLUG"
mkdir -p "$OUT"

echo "→ $NAME  (${SECS}s, 1080x1920)"

# 1. trim + crop to 9:16 + normalise to 30fps, strip audio (wallpapers are silent)
"$FFMPEG" -y -loglevel error -i "$IN" -t "$SECS" \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" \
  -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  "$OUT/tmp-trim.mp4"

# 2. seamless loop: forward + reversed tail so the motion never jumps
"$FFMPEG" -y -loglevel error -i "$OUT/tmp-trim.mp4" \
  -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[out]" \
  -map "[out]" -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -movflags +faststart "$OUT/$SLUG.mov"

# 3. key still — the frame the Lock Screen shows when not pressed
"$FFMPEG" -y -loglevel error -ss "$(echo "$SECS" | awk '{print $1/2}')" -i "$OUT/tmp-trim.mp4" \
  -frames:v 1 -q:v 2 "$OUT/$SLUG-still.jpg"

# 4. listing contact sheet
"$FFMPEG" -y -loglevel error -i "$OUT/tmp-trim.mp4" \
  -vf "fps=3,scale=360:-1,tile=3x3" -frames:v 1 -q:v 3 "$OUT/$SLUG-cover.jpg"

rm -f "$OUT/tmp-trim.mp4"

cat > "$OUT/README.txt" <<EOF
$NAME — live wallpaper
$(printf '%*s' "${#NAME}" '' | tr ' ' '=')======================

WHAT'S INSIDE
  $SLUG.mov         the motion file (1080x1920, silent, seamless loop)
  $SLUG-still.jpg   the still frame

HOW TO USE IT ON iPHONE
  1. Save $SLUG.mov to your Photos app.
  2. Open a Live Photo maker (e.g. intoLive — free on the App Store).
  3. Import the video, set the loop length, and export it as a Live Photo.
  4. Settings > Wallpaper > Add New Wallpaper > Photos, pick the Live Photo,
     and make sure the Live Photo (motion) toggle is ON.
  5. Set as Lock Screen.

NOTES
  - Motion plays on the Lock Screen when you touch and hold. iOS may pause
    motion in Low Power Mode.
  - The still frame is included if you prefer a static wallpaper.
EOF

echo "✓ $OUT"
ls -lh "$OUT" | awk 'NR>1 {print "  " $9 "  " $5}'
