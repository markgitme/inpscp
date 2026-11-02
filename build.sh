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
#   ./build.sh            stage the site
#   ./build.sh --clean    wipe ./build/ first
#   ./build.sh --wip      also stage the work-in-progress pages (never published)
#
# --wip exists because a tool in development must not reach the published
# site. A work in progress has no guide, no FAQ entry, no schema block and no
# byline, so it cannot be published yet — and "we will remember to take it
# out" is not a mechanism. The published build is what `./build.sh` produces
# with no flag, and it never contains a work-in-progress page. The --wip build
# is for the browser checks and for previewing a tool that is still in
# development.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$ROOT/build"

CLEAN=0
WIP=0
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    --wip)   WIP=1 ;;
    *) echo "build.sh: unknown option '$arg'" >&2; exit 1 ;;
  esac
done

SITE_FILES=(
  "index.html" "mouse-check.html" "keyboard-check.html"
  "about.html" "contact.html" "privacy.html" "terms.html" "404.html"
  "assets/css/style.css"
  "assets/css/review.css"
  "assets/favicon.svg"
  "assets/og-image.png"
  "assets/js/keyboard.js"
  "assets/js/mouse.js"
  "assets/js/review.js"
  "assets/js/site.js"
  "assets/js/theme.js"
  "assets/js/trackpad.js"
  "robots.txt" "sitemap.xml" "ads.txt" "manifest.webmanifest"
  "troubleshooting/index.html"
  "troubleshooting/mouse.html"
  "troubleshooting/keyboard.html"
  "troubleshooting/trackpad.html"
  "_headers"
)

# Work in progress. These pages are built only when --wip is passed, so they
# cannot be published by accident. Nothing in the published site may link to
# them either — checks/check_build.py asserts that.
#
# The troubleshooting directory and the assets directory are listed file by
# file rather than as directories, because one guide and one script belong
# to a tool that is still in development and must not be published with the
# others. The guard at the bottom of this file fails the build if a file is
# added to either directory and not listed, so a new asset cannot be
# published by accident either.
WIP_FILES=(
  "headset-check.html"
  "assets/js/headset.js"
  "troubleshooting/headset.html"
)

if [[ "$CLEAN" -eq 1 ]]; then
  rm -rf "$OUT"
fi
rm -rf "$OUT"
mkdir -p "$OUT"

FILES=("${SITE_FILES[@]}")
if [[ "$WIP" -eq 1 ]]; then
  FILES+=("${WIP_FILES[@]}")
fi

for f in "${FILES[@]}"; do
  if [[ -e "$ROOT/$f" ]]; then
    # Keep the directory structure: a path like troubleshooting/mouse.html
    # has to land in build/troubleshooting/, not in build/.
    dest="$OUT/$(dirname "$f")"
    mkdir -p "$dest"
    cp -R "$ROOT/$f" "$dest/"
  else
    echo "build.sh: missing $f" >&2
    exit 1
  fi
done

# Every file under assets/ and troubleshooting/ must be named in one of the
# two lists above. A directory staged wholesale would publish a work in
# progress with it, and "we will remember to take it out" is not a
# mechanism — so an unlisted file fails the build instead.
LISTED=$(printf '%s\n' "${SITE_FILES[@]}" "${WIP_FILES[@]}")
for d in assets troubleshooting; do
  while IFS= read -r found; do
    rel="${found#"$ROOT/"}"
    if ! grep -qxF "$rel" <<<"$LISTED"; then
      echo "build.sh: $rel is in $d/ but is in neither SITE_FILES nor WIP_FILES" >&2
      echo "build.sh: add it to one of them, or it will never be published" >&2
      exit 1
    fi
  done < <(find "$ROOT/$d" -type f | sort)
done

echo "Staged $(find "$OUT" -type f | wc -l | tr -d ' ') files -> $OUT"
if [[ "$WIP" -eq 1 ]]; then
  echo "  (with work in progress: ${WIP_FILES[*]})"
fi
