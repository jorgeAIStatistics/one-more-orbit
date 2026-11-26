#!/bin/bash
# The smoothness audit on every World 1 level (tools/check/smooth.mjs + smooth.py), into <out dir>: per level its
# frames, its plot and its rough moments.  OMO_PORT=5300 tools/check/smoothall.sh <out dir> [levels...]
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; OUT="${1:?out dir}"; shift
mkdir -p "$OUT"
LEVELS=${@:-"first:started:72 0:heroes:58 1:skyhigh:64 ambush:ambush:51.2 2:blank:77 3:invincible:79.2"}
for L in $LEVELS; do
  IFS=: read W ID END <<< "$L"
  (cd "$ROOT" && npx vite-node tools/check/moments.ts $ID 2>/dev/null | tail -1) > "$OUT/$ID.moments.json"
  (cd "$ROOT/tools/check" && node smooth.mjs $W $END "$OUT/$ID.json" > /dev/null 2>&1)
  python3 "$ROOT/tools/check/smooth.py" "$OUT/$ID.json" "$OUT/$ID.png" "$OUT/$ID.moments.json" > "$OUT/$ID.txt" 2>&1
  echo "$ID $(cat "$OUT/$ID.txt" | head -c 600)"
done
