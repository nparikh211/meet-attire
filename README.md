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

### After clone — restore JS, icons, and PNG overlays

**Required after clone:** decode packaged sidecars (JS sources, icons, optional PNG attire):

```bash
bash scripts/decode_binary_assets.sh
```

SVG attire overlays are already plain files. The Load-unpacked folder on this box (`/workspace/meet-attire`) already has decoded files.

To finish pushing the local git tree to GitHub after `gh auth login`:

```bash
bash scripts/push_to_github.sh
```

### One-liner (after clone)

```bash
git clone https://github.com/nparikh211/meet-attire.git && cd meet-attire && bash scripts/decode_binary_assets.sh && echo "Load unpacked → $(pwd)"
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

1. **`manifest.json` (MV3)** — content script on `https://meet.google.com/*`, `web_accessible_resources` for inject + assets. Minimal permissions (`storage` + Meet host).
2. **`content/content.js`** — `document_start`, injects page-world script, shadow-DOM panel, `postMessage` token `meet-attire-v1`.
3. **`content/inject.js` (page world)** — patches `getUserMedia`; video via `canvas.captureStream` + clothing composite; audio unchanged; fail-open to original stream.
4. **Processor** — `FaceDetector` when available + torso geometry; ~24fps via `requestVideoFrameCallback` / rAF.
5. **`assets/attire/`** — SVG overlays (+ optional PNG via Pillow generator / decode script).

## Privacy

- Camera frames processed only in your browser. No uploads/analytics.
- Attire choice stored in `chrome.storage.local`.

## Known limits

2D sprite overlay (not 3D try-on). FaceDetector/heuristic placement can drift with motion/angles. Meet filters may interact oddly.

## License

Personal / internal use. Generic silhouettes — no trademarked logos.
