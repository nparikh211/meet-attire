#!/usr/bin/env bash
# Restore PNG icons, optional raster attire overlays, and content JS from base64 sidecars.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p assets/icons assets/attire/thumbs content

for f in assets/icons/b64/*.png.b64; do
  [ -f "$f" ] || continue
  base="$(basename "$f" .b64)"
  base64 -d "$f" > "assets/icons/$base"
  echo "wrote assets/icons/$base"
done

for f in assets/attire/b64/*.png.b64; do
  [ -f "$f" ] || continue
  name="$(basename "$f" .b64)"
  case "$name" in
    thumb-*)
      out="assets/attire/thumbs/${name#thumb-}"
      ;;
    *)
      out="assets/attire/$name"
      ;;
  esac
  base64 -d "$f" > "$out"
  echo "wrote $out"
done

for f in content/b64/*.js.b64; do
  [ -f "$f" ] || continue
  base="$(basename "$f" .b64)"
  base64 -d "$f" > "content/$base"
  echo "wrote content/$base"
done

echo "Done."
