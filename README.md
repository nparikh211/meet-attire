# Meet Attire

Chrome Manifest V3 extension for **Google Meet** that overlays professional upper-body attire on your camera.

**v1.3 hybrid architecture**

1. **Local (every frame):** MediaPipe Pose + selfie segmentation warp a photoreal garment PNG onto your torso. Face is never covered. Fail-open to the original stream.
2. **Optional neural (once per outfit change):** If you set a **fal.ai** API key, selecting an outfit captures one frame + garment image, calls **fal-ai/cat-vton** (`cloth_type: upper`) from the extension service worker, then locks that neural still as the texture for subsequent **local** pose-warped frames. Video is **not** streamed to the cloud every frame.

> **Honesty:** Continuous tracking is pose-locked photoreal compositing (not per-frame neural VITON). CatVTON improves appearance on outfit change only. Without a fal key, local PNG warp still works.

## Install (Load unpacked)

```bash
git clone https://github.com/nparikh211/meet-attire.git
cd meet-attire
bash scripts/fetch_mediapipe.sh
python3 scripts/generate_assets.py   # optional: regenerate PNGs
```

1. `chrome://extensions` → Developer mode → **Load unpacked** → this folder
2. Open extension **Options** (or the toolbar popup) → paste your **fal.ai API key** (optional)
3. Join [Google Meet](https://meet.google.com), enable camera, pick an outfit

**Reload after updates:** reload the extension on `chrome://extensions`, then hard-refresh Meet.

**First load:** WASM may take a few seconds. Console: `[Meet Attire] MediaPipe Pose + SelfieSegmenter ready…`

## Privacy

- **Always local:** pose + segmentation + warping run in your browser.
- **Only on outfit change, and only if `falKey` is set:** one person frame + garment image are uploaded to fal.ai for CatVTON. The result is pulled back once; further frames stay on-device.
- Key stored in `chrome.storage.local` (`falKey`). Never hardcoded.
- No analytics.

## Architecture

| Piece | Role |
|-------|------|
| `content/content.js` | Injects page-world `inject.js` via script src |
| `content/inject.js` | getUserMedia patch, MediaPipe, warp, neural texture hook |
| `content/content.ui.js` | Panel, Generating…, fal bridge via `chrome.runtime` |
| `background.js` | fal upload + `fal.run/fal-ai/cat-vton` (avoids page CORS) |
| `options.html` | Paste / clear FAL_KEY |
| `vendor/mediapipe/` | Fetched via `scripts/fetch_mediapipe.sh` (not in git) |

```text
Outfit change → local PNG warp immediately
             → (if falKey) capture frame → background fal CatVTON
             → SET_NEURAL_TEXTURE → local pose warp uses neural still
```

## Known limits

- Not full real-time neural try-on; CatVTON is a still refreshed on outfit change.
- Procedural PNGs are photoreal-*looking* cutouts when fal is unavailable.
- Meet background effects / extreme angles can misalign edges.
- fal CatVTON is billed by fal; research/commercial terms are fal’s.

## Development

Messaging token: `MEET_ATTIRE_EXT` / `meet-attire-v1`.
Debug: Meet DevTools → `[Meet Attire]`.

## License

Personal / internal use. Generic silhouettes — no trademarked logos.
