#!/usr/bin/env bash
set -euo pipefail

REF="${VERCEL_GIT_COMMIT_SHA:-main}"
WORK="$(mktemp -d)"
ARCHIVE="$WORK/repo.tgz"

echo "Building SynPlayer frontend from ref: $REF"
curl -fsSL "https://codeload.github.com/lauraevan/synscraper/tar.gz/$REF" -o "$ARCHIVE"
tar -xzf "$ARCHIVE" -C "$WORK"
SRC="$(find "$WORK" -maxdepth 1 -type d -name 'synscraper-*' | head -n 1)"

if [ -z "$SRC" ] || [ ! -d "$SRC/frontend" ]; then
  echo "Could not locate frontend source" >&2
  exit 1
fi

yarn --cwd "$SRC/frontend" install --frozen-lockfile
yarn --cwd "$SRC/frontend" build
rm -rf public
cp -R "$SRC/frontend/build" public

test -f public/index.html
echo "SynPlayer frontend built to backend/public"
