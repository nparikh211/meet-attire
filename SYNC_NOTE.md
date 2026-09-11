# Source sync note (v1.3.0)

Canonical hybrid sources live in the Load-unpacked tree / zip:
- `content/inject.js` — MediaPipe Pose + selfie segmenter + neural texture hooks
- `content/content.ui.js` — Generating… + fal bridge
- `background.js`, `options.html`, `options.js`, `manifest.json` **1.3.0**

After clone:

```bash
bash scripts/fetch_mediapipe.sh
python3 scripts/generate_assets.py
```

Then Load unpacked. Optional: paste fal.ai key in Options for CatVTON on outfit change.
