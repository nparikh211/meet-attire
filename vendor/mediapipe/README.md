# MediaPipe vendor tree

This directory is populated by:

```bash
bash scripts/fetch_mediapipe.sh
```

Required at runtime:

- `vision_bundle.mjs`
- `wasm/` (vision wasm internals)
- `pose_landmarker_lite.task`
- `selfie_segmenter.tflite`

Optional: `face_landmarker.task`, `selfie_multiclass_256x256.tflite`.

These multi-MB binaries are gitignored — do not commit them via MCP `push_files`.
