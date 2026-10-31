#!/usr/bin/env bash
# Run every check on the site, in the order that fails fastest.
#
#   ./checks/run_all.sh
#
# The static checks read the repository; the browser checks need the built
# site served over HTTP, so this script builds it and starts a server on
# port 8899 for the duration.
#
# Environment:
#   BASE_URL    where the site is served (default http://127.0.0.1:8899)
#   CHROME_PATH the chromium binary for the Playwright checks (auto-detected)

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
PORT="${PORT:-8899}"
BASE_URL="${BASE_URL:-http://127.0.0.1:$PORT}"
FAILED=0
SERVER_PID=""

cd "$ROOT"

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null; fi
}
trap cleanup EXIT

banner() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
run()    { printf '\033[36m-- %s\033[0m\n' "$1"; shift; "$@"; local rc=$?; [[ $rc -ne 0 ]] && FAILED=1; return 0; }

# ---------------------------------------------------------------- the site ---
banner "build"
./build.sh --clean || { echo "build failed"; exit 1; }

if [[ -z "${CHROME_PATH:-}" ]]; then
  CHROME_PATH="$(ls -d /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome 2>/dev/null | tail -1)"
fi
export CHROME_PATH BASE_URL

# the browser checks need the site over HTTP
banner "serve"
( cd "$ROOT/build" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 ) &
SERVER_PID=$!
for _ in $(seq 1 40); do
  curl -s -o /dev/null "$BASE_URL/index.html" && break
  sleep 0.25
done

# --------------------------------------------------------- static checks ---
banner "structure and content"
run "links, anchors, schema"     python3 "$HERE/check_links.py"
run "FAQ visible vs schema"       python3 "$HERE/check_faq.py"
run "document structure"          python3 "$HERE/check_doc_structure.py"
run "unit lines (data-note)"      python3 "$HERE/check_notes.py"
run "byline dates vs schema"      python3 "$HERE/check_bylines.py"
run "structural / a11y / SEO"     python3 "$HERE/audit_struct.py"

# --------------------------------------------------------- browser checks ---
banner "in the browser"
run "site audit"                  node "$HERE/browser_audit.js"
run "maintenance"                 node "$HERE/test_maintenance.js"
run "unit lines"                  node "$HERE/test_notes.js"
run "layout detector"             node "$HERE/test_layout.js"
run "trackpad"                    node "$HERE/test_trackpad.js"
run "overflow at every width"     node "$HERE/test_overflow.js"

# ------------------------------------------------------------------ done ---
banner "result"
if [[ $FAILED -eq 0 ]]; then
  echo "ALL CHECKS PASSED"
else
  echo "SOMETHING FAILED — read the output above"
fi
exit $FAILED
