#!/bin/bash
# Every World 1 level's checks again (the Ufotable pass, 2026-11-26): the full level checks (tools/check/level.sh), the
# smoothness audit, and freeze-frames on a wide desktop screen too. Run against the frozen build: OMO_PORT=5300.
# tools/check/allcheck.sh <out dir> ["which:id:folder:name:end|..."]
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; OUT="${1:?out dir}"; shift
LEVELS="${1:-first:started:started:the Drifting Edge:72|0:heroes:volcano:Emberwick:58|1:skyhigh:flutter:Cirra:64|ambush:ambush:darkness:the ambush:51.2|2:blank:luna:Glassmere:77|3:invincible:willow:Verdance:79.2}"
IFS='|' read -ra ALL <<< "$LEVELS"
for L in "${ALL[@]}"; do
  IFS=: read W ID F NAME END <<< "$L"
  D="$OUT/$NAME"; mkdir -p "$D/wide"
  REC=$W; [ "$W" = "0" ] && REC=heroes; [ "$W" = "1" ] && REC=l1; [ "$W" = "2" ] && REC=l2; [ "$W" = "3" ] && REC=l3
  AUD=$(python3 -c "import json;print(json.load(open('$ROOT/levels/$F/audio.json'))['file'].split('/')[-1][:-4])")
  bash "$ROOT/tools/check/level.sh" "$W" "$REC" "$ID" "$AUD" "$NAME" "$END" "$D" > "$D/level.log" 2>&1
  (cd "$ROOT/tools/check" && node smooth.mjs "$W" "$END" "$D/smooth.json" > /dev/null 2>&1)
  python3 "$ROOT/tools/check/smooth.py" "$D/smooth.json" "$D/smoothness.png" "$D/moments.json" > "$D/smoothness.txt" 2>&1
  T=$(python3 -c "import json,sys; print(','.join(str(m['t']) for m in json.load(open(sys.argv[1]))))" "$D/moments.json")
  (cd "$ROOT/tools/check" && OMO_VIEW=1440x900 node jshots2.mjs "$D/wide" "$T" "$W" > /dev/null 2>&1)
  python3 - "$D" <<'PY'
import glob, sys
from PIL import Image
d = sys.argv[1]; fs = sorted(glob.glob(f'{d}/wide/t*.jpg'), key=lambda f: float(f.split('/')[-1][1:-4]))
if fs:
    cols = 4; W, H = 720, 450; rows = (len(fs) + cols - 1) // cols
    im = Image.new('RGB', (cols * W, rows * H), (8, 7, 16))
    for i, f in enumerate(fs): im.paste(Image.open(f).resize((W, H)), ((i % cols) * W, (i // cols) * H))
    im.save(f'{d}/freeze-frames, wide.jpg', quality=82)
PY
  echo "$NAME done"
done
