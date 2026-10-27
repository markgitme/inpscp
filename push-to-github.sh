#!/usr/bin/env bash
# push-to-github.sh — publish this site to a GitHub repository.
#
# Usage:
#   GH_TOKEN=ghp_xxx ./push-to-github.sh https://github.com/YOUR_USER/YOUR_REPO.git
#
# The token is used through a scoped HTTP header for github.com only. It is
# never written to .git/config, never stored in the remote URL, and never
# ends up in the repository history.
#
# Token needs (fine-grained PAT, recommended):
#   Repository access : only the one repository you are pushing to
#   Permissions       : Contents -> Read and write
#   Nothing else.
#
# Revoke it afterwards at: https://github.com/settings/personal-access-tokens

set -euo pipefail

REMOTE="${1:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$REMOTE" ]]; then
  echo "usage: GH_TOKEN=... ./push-to-github.sh https://github.com/USER/REPO.git" >&2
  exit 1
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN is not set." >&2
  echo "Create a fine-grained token (repo -> Contents: Read and write) and export it:" >&2
  echo "  export GH_TOKEN=github_pat_..." >&2
  exit 1
fi

cd "$ROOT"

# make sure the branch name matches GitHub's default
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  git branch -m main
  echo "renamed branch $BRANCH -> main"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

echo "pushing to $REMOTE (branch: $(git rev-parse --abbrev-ref HEAD))"

AUTH="$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"

git -c "http.https://github.com/.extraheader=Authorization: Basic $AUTH" \
    push -u origin HEAD

echo
echo "Pushed. To pull it back down later:"
echo "  git pull origin main"
echo
echo "Enable free hosting with: Settings -> Pages -> Source: Deploy from a branch -> main / (root)"
