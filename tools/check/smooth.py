#!/usr/bin/env python3
"""The smoothness audit's analysis (the owner's brief, 2026-11-26). From tools/check/smooth.mjs's frames: speed and
acceleration of the camera (its centre, and its zoom), of Orbin on the screen and of Orbin in the world, every frame;
a rough moment is a frame where the acceleration jumps far above what is around it. Writes a plot (PNG) and prints the
rough moments with their song times.  python3 smooth.py <frames.json> <out.png> [moments.json]"""
import json, math, sys
from PIL import Image, ImageDraw

D = json.load(open(sys.argv[1])); out = sys.argv[2]
moments = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else []
R = D['rows']
# drop repeated frames (same timestamp) and the first few
R = [r for i, r in enumerate(R) if i > 3 and r[0] > R[i - 1][0]]
t = [r[0] / 1000 for r in R]; song = [r[1] for r in R]
def series(xs, ys):
    v, a = [0.0] * len(xs), [0.0] * len(xs)
    for i in range(1, len(xs)):
        dt = max(1e-4, t[i] - t[i - 1]); v[i] = math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]) / dt
    vx = [0.0] + [(xs[i] - xs[i - 1]) / max(1e-4, t[i] - t[i - 1]) for i in range(1, len(xs))]
    vy = [0.0] + [(ys[i] - ys[i - 1]) / max(1e-4, t[i] - t[i - 1]) for i in range(1, len(xs))]
    for i in range(2, len(xs)):
        dt = max(1e-4, t[i] - t[i - 1]); a[i] = math.hypot(vx[i] - vx[i - 1], vy[i] - vy[i - 1]) / dt
    return v, a
U = [r[4] for r in R]
# the framing zoom is the zoom without the on-beat impacts (the punch and the drop's kick, which are meant to hit on the
# beat): those are listed apart, as impacts
F = [r[4] / ((1 + r[10] * 0.05) * (1 - r[11] * 0.2)) if len(r) > 11 else r[4] for r in R]
imp = [(r[10] if len(r) > 11 else 0) + (r[11] if len(r) > 11 else 0) for r in R]
cam_v, cam_a = series([r[2] for r in R], [r[3] for r in R])
zoom_v, zoom_a = series([math.log(max(1e-3, u)) * 1000 for u in F], [0] * len(F))  # (zoom: per mille of scale)
orb_v, orb_a = series([r[5] for r in R], [r[6] for r in R])
wx = [(r[5] + r[2]) / max(1e-3, r[4]) * 100 for r in R]; wy = [(r[6] + r[3]) / max(1e-3, r[4]) * 100 for r in R]  # (in hundredths of a ring)
wor_v, wor_a = series(wx, wy)

def rough(a, floor):
    """frames whose acceleration jumps above 6x the median of the 0.5 s around it (and above a floor)"""
    n, hits = len(a), []
    for i in range(2, n):
        lo, hi = max(0, i - 30), min(n, i + 30)
        w = sorted(a[lo:hi]); med = w[len(w) // 2]
        if a[i] > max(floor, 6 * med): hits.append(i)
    # group frames within 0.15 s
    groups = []
    for i in hits:
        if groups and song[i] - song[groups[-1][-1]] < 0.15: groups[-1].append(i)
        else: groups.append([i])
    return [(song[g[0]], max(a[j] for j in g)) for g in groups]
FLOORS = {'camera': 6000, 'zoom': 4000, 'orbin on screen': 9000, 'orbin in the world': 12000}
tracks = [('camera', cam_v, cam_a, 'px/s'), ('zoom', zoom_v, zoom_a, '‰/s'), ('orbin on screen', orb_v, orb_a, 'px/s'), ('orbin in the world', wor_v, wor_a, 'ring/100 s')]
report, onbeat = {}, {}
BEATS = sorted(D.get('beats', []))
def near_beat(s0, tol=0.045):
    import bisect
    i = bisect.bisect_left(BEATS, s0)
    return any(0 <= j < len(BEATS) and abs(BEATS[j] - s0) <= tol for j in (i - 1, i))
for name, v, a, unit in tracks:
    allr = rough(a, FLOORS[name])
    # (Orbin is judged while he is in the picture: off it, nothing is seen)
    if name.startswith('orbin'): allr = [x for x in allr if any(abs(r[1] - x[0]) < 0.01 and abs(r[5]) < D['w'] / 2 + 40 and abs(r[6]) < D['h'] / 2 + 40 for r in R)]
    # (Orbin's take-offs and landings land on the beat by design: a jump starts with a push. Those are listed apart.)
    if name.startswith('orbin'): report[name] = [x for x in allr if not near_beat(x[0])]; onbeat[name] = [x for x in allr if near_beat(x[0])]
    else: report[name] = allr
# ---- the plot
Wd, Hs = 2400, 150; T0, T1 = min(song), max(song)
im = Image.new('RGB', (Wd, 40 + len(tracks) * 2 * (Hs + 24)), (12, 11, 22)); d = ImageDraw.Draw(im)
X = lambda s: 60 + (s - T0) / max(1e-6, T1 - T0) * (Wd - 80)
y = 30
for name, v, a, unit in tracks:
    for lab, ser, col in ((f'{name}: speed', v, (130, 170, 230)), (f'{name}: acceleration', a, (240, 200, 120))):
        top = sorted(ser)[int(len(ser) * 0.995)] or 1
        d.rectangle([60, y, Wd - 20, y + Hs], outline=(50, 48, 70))
        d.text((64, y + 2), f'{lab} (scale {top:.0f} {unit}{"/s" if "acc" in lab else ""})', fill=(220, 220, 235))
        for m in moments:
            if T0 <= m['t'] <= T1: d.line([X(m['t']), y, X(m['t']), y + Hs], fill=(45, 60, 45))
        pts = [(X(song[i]), y + Hs - min(1.0, ser[i] / top) * (Hs - 4)) for i in range(len(ser))]
        d.line(pts, fill=col, width=1)
        if 'acc' in lab:
            for (s, m) in report[name]: d.ellipse([X(s) - 5, y + 2, X(s) + 5, y + 12], fill=(235, 90, 60))
        y += Hs + 24
for k in range(int(T0), int(T1) + 1, 5): d.text((X(k) - 6, y - 16), f'{k}', fill=(160, 160, 180))
im.save(out)
fr = len(R); dur = t[-1] - t[0]
impacts = []
for i in range(1, len(imp)):
    if imp[i] - imp[i - 1] > 0.02 and (not impacts or song[i] - impacts[-1] > 0.2): impacts.append(song[i])
print(json.dumps({'on the beat (take-offs, landings)': {k: len(v) for k, v in onbeat.items()}, 'impacts': [round(x, 2) for x in impacts], 'frames': fr, 'fps': round(fr / dur, 1), 'rough': {k: [[round(s, 2), round(m)] for s, m in v] for k, v in report.items()}}))
