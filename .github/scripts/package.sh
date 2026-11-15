#!/usr/bin/env bash
# Packs a built checkout into a self-contained archive for the current platform:
#   dist/release/learnev-<version>-<target>.tar.gz   (.zip for windows-*)
# It holds the tracked sources, the production build (.next) and production-only node_modules,
# so the target machine needs Node.js 24 and nothing else. Run after `npm ci && npm run build`.
# This prunes devDependencies from ./node_modules, so run it on a CI checkout or a copy.
# Usage: .github/scripts/package.sh <target>    e.g. linux-x64, macos-arm64, windows-x64
set -euo pipefail

target=${1:?usage: package.sh <target>}
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
[ -f .next/BUILD_ID ] || { echo "No production build; run npm run build first." >&2; exit 1; }

version=$(node -p 'require("./package.json").version')
name="learnev-${version}-${target}"
out="$PWD/dist/release"
stage="$out/$name"
rm -rf "$stage" "$out/$name.tar.gz" "$out/$name.zip"
mkdir -p "$stage"

npm prune --omit=dev --no-audit --no-fund
git ls-files -z -- . ':!:.github' | tar --null -T - -cf - | tar -xf - -C "$stage"
tar --exclude=.next/cache -cf - .next node_modules | tar -xf - -C "$stage"

case "$target" in
  windows-*)
    archive="$out/$name.zip"
    # Relative paths: Git Bash would hand 7z a POSIX path it cannot read.
    if command -v 7z >/dev/null 2>&1; then
      (cd "$out" && 7z a -tzip -mx=5 "$name.zip" "$name" >/dev/null)
    else
      (cd "$out" && pwsh -NoProfile -Command "Compress-Archive -Path '$name' -DestinationPath '$name.zip'")
    fi
    ;;
  *)
    archive="$out/$name.tar.gz"
    tar -czf "$archive" -C "$out" "$name"
    ;;
esac
rm -rf "$stage"
echo "packed $archive ($(du -h "$archive" | cut -f1))"
