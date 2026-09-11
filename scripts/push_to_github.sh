#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login -h github.com -p https -w"
  exit 1
fi
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/nparikh211/meet-attire.git
git push -u origin main --force-with-lease
echo "Pushed to https://github.com/nparikh211/meet-attire"
