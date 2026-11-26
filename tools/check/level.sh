#!/bin/bash
# Every check of a level (the owner's Part 5): audit, tests, readability, frame times, freeze-frames, a recording.
# tools/check/level.sh <which: first|0|1|2|3> <rec: first|heroes|l1|l2|l3> <level id> <audio folder> <name in tests> <end s> <out dir>
set -e
W=$1; REC=$2; ID=$3; AUD=$4; NAME=$5; END=$6; OUT=$7
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; CK="$ROOT/tools/check"; PY="$ROOT/tools/.venv/bin/python"
mkdir -p "$OUT/freeze-frames"
cd "$ROOT"
npx vite-node tools/variety.ts $ID > "$OUT/audit.txt" 2>&1 || true
npx vitest run tests/forgive.test.ts -t "$NAME" 2>&1 | grep -E "FORGIVE|SPAMBOT|PAIRS|✓|×|→|Tests" | sed 's/^ *//' > "$OUT/tests.txt" || true
cd "$CK"
node frame6.mjs $W > "$OUT/readability.txt" 2>&1 || true
node hitch1.mjs ${OMO_PORT:-5199} x "$NAME" $W $END > "$OUT/frame-times.txt" 2>&1 || true
T=$(cd "$ROOT" && npx vite-node tools/check/moments.ts $ID 2>/dev/null | tail -1)
echo "$T" > "$OUT/moments.json"
TIMES=$(python3 -c "import json,sys; print(','.join(str(m['t']) for m in json.loads(sys.argv[1])))" "$T")
rm -rf "$OUT/freeze-frames"/*.jpg
node jshots2.mjs "$OUT/freeze-frames" "$TIMES" $W > /dev/null 2>&1 || true
python3 - "$OUT" <<'PY'
import json, glob, sys
from PIL import Image, ImageDraw
out = sys.argv[1]; M = {m['t']: m['what'] for m in json.load(open(f'{out}/moments.json'))}
fs = sorted(glob.glob(f'{out}/freeze-frames/t*.jpg'), key=lambda f: float(f.split('/')[-1][1:-4]))
if fs:
    cols = 8; W, H = 240, 520; rows = (len(fs) + cols - 1) // cols
    im = Image.new('RGB', (cols * (W + 8), rows * (H + 30)), (8, 7, 16)); d = ImageDraw.Draw(im)
    for i, f in enumerate(fs):
        t = float(f.split('/')[-1][1:-4]); x = (i % cols) * (W + 8); y = (i // cols) * (H + 30)
        im.paste(Image.open(f).resize((W, H)), (x, y + 26)); d.text((x + 4, y + 6), f'{t:.2f} s  {M.get(t, "")}'[:44], fill=(255, 226, 170))
    im.save(f'{out}/freeze-frames, all.jpg', quality=84)
PY
node rec5.mjs $REC "$OUT/rec" -1.5 $END > "$OUT/rec.log" 2>&1
(cd "$CK" && "$PY" mux.py "$OUT/rec" "$OUT/recording.mp4" level "$ROOT/public/audio/$AUD.mp3" 0 >> "$OUT/rec.log" 2>&1)
FF=$("$PY" -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
"$FF" -loglevel error -y -i "$OUT/recording.mp4" -vf "fps=1/3,scale=200:-1,tile=13x2" -frames:v 1 "$OUT/every 3 s.jpg" || true
rm -rf "$OUT/rec"
echo "checks done: $OUT"
