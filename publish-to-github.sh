#!/usr/bin/env bash
# Creates the GitHub repo, commits everything to a feature branch, waits for the
# free GitHub Actions builds, and downloads both APKs into ./apk/ (reporter/ and desk/)
#
# Usage:   ./publish-to-github.sh [API_URL]
# Example: ./publish-to-github.sh http://192.168.1.10:4000
# Needs:   git and GitHub CLI (https://cli.github.com). On Windows run it in Git Bash.
set -euo pipefail
REPO="jaathiya-vaartalu-epaper-studio"
BRANCH="feature/news-desk-epaper"
API_URL="${1:-}"
cd "$(dirname "$0")"

command -v git >/dev/null || { echo "Install Git first: https://git-scm.com"; exit 1; }
command -v gh  >/dev/null || { echo "Install GitHub CLI first: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login

if [ -n "$API_URL" ]; then
  for app in jaathiya-vaartalu-reporter-mobile jaathiya-vaartalu-admin-mobile; do echo "export const API_BASE = '$API_URL';" > $app/src/config.js; done
  echo "Apps will use API: $API_URL"
fi

if [ ! -d .git ]; then
  git init -b main
  git add README.md .gitignore
  git commit -m "Initial commit"
  gh repo create "$REPO" --private --source=. --remote=origin --push
fi

git checkout -B "$BRANCH"
git add -A
git commit -m "Reporter and Desk apps (mobile + web), API, e-paper studio, APK builds" || echo "Nothing new to commit"
git push -u origin "$BRANCH"

rm -rf apk
for pair in "reporter-mobile-apk.yml:jv-reporter-apk:reporter" "admin-mobile-apk.yml:jv-desk-apk:desk"; do
  IFS=: read -r WF ART DIR <<< "$pair"
  echo "Waiting for $WF to start..."
  RUN_ID=""
  for i in $(seq 1 20); do
    sleep 6
    RUN_ID=$(gh run list --branch "$BRANCH" --workflow "$WF" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)
    [ -n "$RUN_ID" ] && break
  done
  [ -z "$RUN_ID" ] && { echo "Build did not start. Open the repo's Actions tab and run $WF manually."; exit 1; }
  echo "Build $RUN_ID running (about 15-25 minutes)..."
  gh run watch "$RUN_ID" --exit-status
  gh run download "$RUN_ID" -n "$ART" -D "apk/$DIR"
done
echo ""
echo "Done. APKs: $(pwd)/apk/reporter/app-release.apk and $(pwd)/apk/desk/app-release.apk"
echo "Repo:      $(gh repo view --json url -q .url)"
