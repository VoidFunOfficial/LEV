#!/usr/bin/env bash
# Starts the production server from <dir>, checks that / and /render answer, and with --render
# also renders .github/smoke.oui through scripts/render.ts (needs Chrome on the machine).
# Usage: .github/scripts/smoke.sh <dir> [--render <out.png>]
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dir=$(cd "${1:?usage: smoke.sh <dir> [--render <out.png>]}" && pwd)
render_out=""
if [ "${2:-}" = "--render" ]; then render_out=${3:?--render needs an output path}; fi
port=${SMOKE_PORT:-3123}
origin="http://127.0.0.1:$port"
log=$(mktemp)

cd "$dir"
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$port" >"$log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT

ready=""
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "$origin/render" 2>/dev/null; then ready=1; break; fi
  if ! kill -0 "$pid" 2>/dev/null; then break; fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "The server did not answer $origin/render:" >&2
  cat "$log" >&2
  exit 1
fi
curl -fsS -o /dev/null "$origin/"
echo "server ok: $origin/ and $origin/render"

if [ -n "$render_out" ]; then
  node --experimental-strip-types --no-warnings scripts/render.ts "$here/smoke.oui" --origin "$origin" --out "$render_out"
fi
