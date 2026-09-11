#!/usr/bin/env bash
# Fetch MediaPipe Tasks Vision WASM + pose/face/selfie models into vendor/mediapipe.
# Large binaries are intentionally NOT committed to GitHub — run this after clone.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/mediapipe"
WASM="$VENDOR/wasm"
mkdir -p "$WASM"

echo "==> Meet Attire: installing MediaPipe into $VENDOR"

cd "$ROOT"
if command -v npm >/dev/null 2>&1; then
  if [[ ! -d node_modules/@mediapipe/tasks-vision ]]; then
    npm install --no-fund --no-audit @mediapipe/tasks-vision@0.10.14 >/dev/null
  fi
  MP="node_modules/@mediapipe/tasks-vision"
  cp -f "$MP/wasm/"*.js "$MP/wasm/"*.wasm "$WASM/" 2>/dev/null || true
  if [[ -f "$MP/vision_bundle.mjs" ]]; then
    cp -f "$MP/vision_bundle.mjs" "$VENDOR/vision_bundle.mjs"
  elif [[ -f "$MP/vision_bundle.mjs.js" ]]; then
    cp -f "$MP/vision_bundle.mjs.js" "$VENDOR/vision_bundle.mjs"
  fi
  if [[ -f "$VENDOR/vision_bundle.mjs" && ! -f "$VENDOR/vision_bundle.js" ]]; then
    cp -f "$VENDOR/vision_bundle.mjs" "$VENDOR/vision_bundle.js"
  fi
else
  echo "npm not found — will download JS/wasm from CDN only" >&2
fi

POSE_URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
FACE_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
SEG_URL="https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"
MULTI_URL="https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
CDN_BASE="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"

download() {
  local url="$1" dest="$2"
  if [[ -f "$dest" && -s "$dest" ]]; then
    echo "  skip (exists): $(basename "$dest")"
    return 0
  fi
  echo "  curl $(basename "$dest")"
  curl -fsSL --retry 3 --retry-delay 1 -o "$dest" "$url"
}

download "$POSE_URL" "$VENDOR/pose_landmarker_lite.task"
download "$FACE_URL" "$VENDOR/face_landmarker.task"
download "$SEG_URL" "$VENDOR/selfie_segmenter.tflite"
download "$MULTI_URL" "$VENDOR/selfie_multiclass_256x256.tflite"

if [[ ! -f "$VENDOR/vision_bundle.mjs" || ! -s "$VENDOR/vision_bundle.mjs" ]]; then
  download "$CDN_BASE/vision_bundle.mjs" "$VENDOR/vision_bundle.mjs"
  cp -f "$VENDOR/vision_bundle.mjs" "$VENDOR/vision_bundle.js"
fi

if [[ ! -f "$WASM/vision_wasm_internal.js" ]]; then
  for f in \
    vision_wasm_internal.js vision_wasm_internal.wasm \
    vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm \
    vision_wasm_module_internal.js vision_wasm_module_internal.wasm
  do
    download "$CDN_BASE/wasm/$f" "$WASM/$f" || true
  done
fi

echo "==> Done. Key files:"
ls -lh "$VENDOR"/*.task "$VENDOR"/*.tflite "$VENDOR"/vision_bundle.mjs 2>/dev/null || true
ls "$WASM" | head
echo ""
echo "Next: chrome://extensions → Load unpacked → $ROOT"
echo "First Meet load may take a few seconds while WASM compiles."
