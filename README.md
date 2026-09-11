# Meet Attire

Chrome Manifest V3 extension that overlays professional upper-body attire onto your **Google Meet** camera feed. Processing is **100% local** — video never leaves your machine.

## Install (Load unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder:

```text
/workspace/meet-attire
```

(If you cloned the repo, select the cloned `meet-attire` directory that contains `manifest.json`.)

5. Open [Google Meet](https://meet.google.com), join or start a call, and turn on your camera.
6. Use the floating **"Change attire?"** panel (bottom-right) to pick an outfit or **Off / Original**.

### After clone — restore PNG icons/overlays

SVG overlays work out of the box. To restore the Pillow-generated PNGs and extension icons:

```bash
bash scripts/decode_binary_assets.sh
```

### One-liner (after clone)

```bash
git clone https://github.com/nparikh211/meet-attire.git && echo "Load unpacked → $(pwd)/meet-attire"
```

## What's included

| Option | Label |
|--------|--------|
| 1 | Classic polo (subtle check, Burberry-inspired look — no logos) |
| 2 | White t-shirt |
| 3 | White button-down |
| 4 | Navy polo |
| 5 | Light blue oxford |
| — | Off / Original |

## Architecture

1. **`manifest.json` (MV3)** — content script on `https://meet.google.com/*`, `web_accessible_resources` for the page inject + assets. Minimal permissions (`storage` + Meet host).
2. **`content/content.js`** — runs at `document_start`, injects the page-world script, hosts a shadow-DOM floating panel, bridges messages with `window.postMessage` + token `meet-attire-v1`.
3. **`content/inject.js` (page world)** — patches `navigator.mediaDevices.getUserMedia` early. Video tracks are replaced with a `canvas.captureStream` that composites clothing; audio is passed through unchanged. On any failure, Meet gets the **original** stream (fail-open).
4. **Processor** — prefers Chrome's built-in `FaceDetector` to place a torso box under the face; falls back to a center-upper heuristic. Clothing overlays are drawn with soft edges at ~24 fps (`requestVideoFrameCallback` when available).
5. **`assets/attire/`** — SVG overlays (+ optional PNG via `scripts/generate_assets.py` / decode script).

```text
meet-attire/
├── manifest.json
├── README.md
├── .gitignore
├── content/
│   ├── content.js
│   └── inject.js
├── assets/
│   ├── attire/
│   │   └── thumbs/
│   └── icons/
└── scripts/
    ├── generate_assets.py
    └── decode_binary_assets.sh
```

## Privacy

- Camera frames are processed **only in your browser**.
- No analytics, no remote APIs, no uploads.
- Choice of attire is stored in `chrome.storage.local` on your profile.

## How to test

1. Load unpacked as above.
2. Open Meet → enable camera.
3. Confirm the panel appears and each option changes your self-view / what others see.
4. Click **Off / Original** — feed should match your real clothing again.
5. If something breaks, the extension falls back to the raw camera so Meet still works.

## Known limits (client-side clothing overlay)

- This is a **2D sprite overlay**, not 3D garment simulation or generative try-on.
- FaceDetector coverage varies by Chrome version/OS; without it, placement uses a geometric heuristic.
- Rapid motion, extreme angles, multiple people, or unusual framing can misalign the overlay.
- Meet UI updates or alternate camera paths may require adjusting the inject timing.
- Background effects / Meet appearance filters can interact oddly with an already-composited stream.

## Replacing assets

1. Drop new transparent PNGs/SVGs into `assets/attire/` (same filenames), **or**
2. Edit `scripts/generate_assets.py` and run `python3 scripts/generate_assets.py`
3. Refresh the extension on `chrome://extensions`.

## Development notes

- Messaging token: `MEET_ATTIRE_EXT` / `meet-attire-v1`.
- Panel uses **shadow DOM** so Meet's CSS does not restyle it.
- Debug: Meet tab → DevTools → Console; look for `[Meet Attire]` warnings.

## License

Personal / internal use. Clothing designs are generic silhouettes — no trademarked logos.
