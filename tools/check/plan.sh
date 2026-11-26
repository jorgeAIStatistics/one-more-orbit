#!/bin/bash
# A level's one-page plan with its storyboard (the owner's brief, 2026-11-26): a freeze-frame of each set piece (half a
# second into it, a perfect run on a phone screen), captioned with what happens there.
# tools/check/plan.sh <which: first|ambush|0|1|2|3> <level folder> <plan dir>
set -e
W=$1; F=$2; mkdir -p "$3"; OUT="$(cd "$3" && pwd)"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; CK="$ROOT/tools/check"
mkdir -p "$OUT/panels"
T=$(python3 -c "import json,sys; L=json.load(open(sys.argv[1])); print(','.join(f\"{p['time'] + 0.5:g}\" for p in L['setpieces']))" "$ROOT/levels/$F/level.json")
(cd "$CK" && node jshots2.mjs "$OUT/panels" "$T" "$W" > /dev/null 2>&1) || true
python3 - "$ROOT/levels/$F/level.json" "$OUT" <<'PY'
import json, sys, pathlib
L = json.load(open(sys.argv[1])); out = pathlib.Path(sys.argv[2])
panels = []
for p in L['setpieces']:
    name = f"t{p['time'] + 0.5:g}".replace('t', '', 1).rjust(5, '0')
    img = f'panels/t{name}.jpg'
    if (out / img).exists(): panels.append({'img': img, 'caption': f"<b>{p['time']:.1f} s · {p['name']}</b><br>{p['what']}"})
(out / 'panels.json').write_text(json.dumps(panels))
print(len(panels), 'panels')
PY
python3 "$ROOT/tools/plan_page.py" "$F" "$OUT/0 the plan.html" "$OUT/panels.json"
