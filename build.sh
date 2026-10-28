#!/usr/bin/env bash
# Stage a clean, deployable copy of the site into ./build/
#
# Only the public site files go in. The git history, README, CHANGELOG and
# helper scripts stay out of the published output.
#
# Used for two things:
#   - local deploys:  website_deploy path=<repo>/build
#   - Cloudflare Pages: build command `./build.sh`, output directory `build`
#
#   ./build.sh          stage the site
#   ./build.sh --clean  wipe ./build/ first

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$ROOT/build"

SITE_FILES=(
  "index.html" "mouse-check.html" "keyboard-check.html"
  "about.html" "contact.html" "privacy.html" "terms.html" "404.html"
  "assets"
  "robots.txt" "sitemap.xml" "ads.txt" "manifest.webmanifest"
  "troubleshooting"
  "_headers"
)

if [[ "${1:-}" == "--clean" ]]; then
  rm -rf "$OUT"
fi
rm -rf "$OUT"
mkdir -p "$OUT"

for f in "${SITE_FILES[@]}"; do
  if [[ -e "$ROOT/$f" ]]; then
    cp -R "$ROOT/$f" "$OUT/"
  else
    echo "build.sh: missing $f" >&2
    exit 1
  fi
done

echo "Staged $(find "$OUT" -type f | wc -l | tr -d ' ') files -> $OUT"
