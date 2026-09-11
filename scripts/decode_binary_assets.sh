#!/usr/bin/env bash
# Restore PNG icons, optional raster attire, and optional plain JS helpers from base64 sidecars.
# Note: content/content.js is the bootstrap entry and is NOT restored from b64.
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
    thumb-*) out="assets/attire/thumbs/${name#thumb-}" ;;
    *) out="assets/attire/$name" ;;
  esac
  base64 -d "$f" > "$out"
  echo "wrote $out"
done

for f in content/b64/*.js.gz.b64; do
  [ -f "$f" ] || continue
  base="$(basename "$f" .gz.b64)"
  if [ "$base" = "content.js" ]; then
    echo "skip $f (bootstrap is source of truth)"
    continue
  fi
  base64 -d "$f" | gzip -d > "content/$base"
  echo "wrote content/$base (gunzip)"
done

echo "Done."
