# Meet Attire

Chrome Manifest V3 extension that overlays **pose-locked photoreal garments** onto your **Google Meet** camera feed using on-device **MediaPipe Pose + selfie segmentation**.

Video never leaves your machine.

> **Honesty:** This is **pose-locked photoreal garment compositing** (segmentation + warped shirt PNGs), **not** a full neural VITON / generative virtual try-on. Fabric lighting and sleeve physics will not match a real shirt perfectly — but clothing **continuously tracks shoulders/hips**, is **person-masked**, and **never covers the face**.

## Install (Load unpacked)

### 1. Clone + fetch MediaPipe models

Large WASM/model files are **not** shipped in git. After clone:

```bash
git clone https://github.com/nparikh211/meet-attire.git
cd meet-attire
bash scripts/fetch_mediapipe.sh
# optional: regenerate photoreal PNG garments
python3 scripts/generate_assets.py
```

### 2. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `meet-attire` folder (the one that contains `manifest.json`)
5. Open [Google Meet](https://meet.google.com), join a call, turn on camera
6. Use the floating **"Change attire?"** panel (bottom-right)

**Reload after updates:** on `chrome://extensions`, click the reload button for Meet Attire, then hard-refresh the Meet tab.

**First load:** WASM compile can take a few seconds; the console may log `[Meet Attire] MediaPipe Pose + SelfieSegmenter ready`. If models fail, the extension **fails open** to your original camera stream.

### One-liner

```bash
git clone https://github.com/nparikh211/meet-attire.git && cd meet-attire && bash scripts/fetch_mediapipe.sh && echo "Load unpacked -> $(pwd)"
```

## What's included

| Option | Label |
|--------|--------|
| 1 | Classic polo (subtle check — no logos) |
| 2 | White t-shirt |
| 3 | White button-down |
| 4 | Navy polo |
| 5 | Light blue oxford |
| — | Off / Original |

Primary overlays are **photoreal-style PNG** cutouts (`assets/attire/*.png`) with transparent neck holes. SVGs remain as fallbacks.

## Architecture (v1.2)

1. **`manifest.json` (MV3)** — content scripts on Meet; `web_accessible_resources` for inject, attire PNGs, and `vendor/mediapipe/*` (+ wasm).
2. **`content/content.js`** — injects `content/inject.js` via `<script src=chrome-extension://…>` (Meet CSP-safe). No inline eval.
3. **`content/content.ui.js`** — floating shadow-DOM panel; sends `INIT` with `assetBase = chrome.runtime.getURL("")` because the **page world cannot use `chrome.runtime`**.
4. **`content/inject.js` (page world)** — patches `getUserMedia`; each frame:
   - draws the camera frame
   - runs **PoseLandmarker** (VIDEO) every frame when possible
   - runs **ImageSegmenter** (selfie_segmenter) ~15–20 fps
   - builds a torso quad from shoulders (11/12) → hips (23/24), width expanded ~18%
   - warps the shirt PNG into that quad (triangle affine split)
   - multiplies by the person confidence mask
   - **hard-excludes** everything above a neck line (below nose / mid-shoulders) so the face is never covered
   - composites onto the output canvas (`captureStream`)
5. **Fail-open** — if MediaPipe fails to load, Meet gets the original stream.

```text
meet-attire/
├── manifest.json                 # v1.2.0
├── README.md
├── content/
│   ├── content.js                # script-src inject bootstrap
│   ├── content.ui.js             # panel (Tracks your torso · local on-device)
│   └── inject.js                 # MediaPipe pose + segment + warp
├── assets/attire/                # photoreal PNG + SVG fallback + thumbs/
├── vendor/mediapipe/             # fetched locally (not in git)
│   ├── vision_bundle.mjs
│   ├── pose_landmarker_lite.task
│   ├── selfie_segmenter.tflite
│   └── wasm/
└── scripts/
    ├── fetch_mediapipe.sh         # REQUIRED after clone
    ├── generate_assets.py        # procedural photoreal-ish PNGs
    └── decode_binary_assets.sh
```

## Privacy

- Camera frames are processed **only in your browser** (MediaPipe WASM on-device).
- No analytics, no remote inference APIs, no uploads.
- Attire choice is stored in `chrome.storage.local`.

## Known limits (honesty gap vs neural try-on)

- **Not VITON:** no garment deformation network, no lighting transfer from your real shirt, no fabric simulation.
- Procedural / cutout PNGs are *photoreal-looking*, not photographs of you wearing the item.
- Rapid motion, extreme angles, multiple people, or Meet background effects can misalign edges.
- Pose/segment models need a clear upper body; if pose is lost briefly, last lock / fallback torso is used.

## Replacing assets

```bash
python3 scripts/generate_assets.py
```

Or drop transparent PNGs into `assets/attire/` using the same filenames (`classic-polo.png`, …). Keep a neck-hole alpha so the face stays clear.

## Development

- Messaging: `MEET_ATTIRE_EXT` / `meet-attire-v1`
- Debug: Meet tab → DevTools → Console → `[Meet Attire]`
- After changing inject/UI: reload the extension, then refresh Meet

## License

Personal / internal use. Clothing designs are generic silhouettes — no trademarked logos.
