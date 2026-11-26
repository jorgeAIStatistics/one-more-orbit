#!/bin/bash
# A frozen copy of the game for the checks (2026-11-26): a production build served on its own port (5300), so the
# code can be edited while a long check runs without the dev server reloading the page under it. Run the checks with
# OMO_PORT=5300. Usage: tools/check/snap.sh <dir>   (rebuilds and restarts the server)
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; DIR="${1:?a folder for the build}"
cd "$ROOT"
pkill -f "vite preview --port 5300" 2>/dev/null || true
npx vite build --mode checks --outDir "$DIR" --emptyOutDir > "$DIR.log" 2>&1
nohup npx vite preview --port 5300 --strictPort --outDir "$DIR" >> "$DIR.log" 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:5300/ && break; sleep 0.25; done
echo "snapshot served on 5300 from $DIR"
