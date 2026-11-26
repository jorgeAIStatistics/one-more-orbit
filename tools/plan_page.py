#!/usr/bin/env python3
"""A level's one-page plan (the owner's brief of 2026-11-26): the journey map drawn from its level.json (places, path
shapes, launches with their times), the beat sheet by section, the set pieces, and storyboard panels (images in the
plan's folder named panel-*.jpg, captions from --panels). Usage:

    python3 tools/plan_page.py <folder> <out.html> [panels.json]

panels.json: [{"img": "panel-1.jpg", "caption": "..."}]; images are embedded.
"""
import base64, json, math, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
folder, out = sys.argv[1], pathlib.Path(sys.argv[2])
panels = json.loads(pathlib.Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else []
L = json.loads((ROOT / f'levels/{folder}/level.json').read_text())
A = json.loads((ROOT / f'levels/{folder}/audio.json').read_text())
spb = 60 / A['bpm']
places = L.get('places', [])
# leaps from the segments' words
bars = [w for s in L['segments'] for k in range(s['bars']) for w in [s['core']['bars'][k % len(s['core']['bars'])]]]
leaps = []
for b, w in enumerate(bars):
    m = re.search(r'leap(\d)?(?:@(\d))?', w)
    if m: leaps.append((b, b * 4 + int(m.group(2) or 0), int(m.group(1) or 4)))
# ---- the map (SVG, base-ring radii, portrait)
xs = [p['at'][0] for p in places] or [0]; ys = [p['at'][1] for p in places] or [0]
x0, x1, y0, y1 = min(xs) - 2.6, max(xs) + 2.6, min(ys) - 2.6, max(ys) + 2.6
S = 46
W, H = (x1 - x0) * S, (y1 - y0) * S
X = lambda x: (x - x0) * S
Y = lambda y: (y - y0) * S
def shape(p):
    cx, cy, k, rot = p['at'][0], p['at'][1], p.get('size', 1), p.get('rot', 0)
    pts = []
    if p['shape'] in ('circle',):
        for i in range(73): a = i / 72 * 2 * math.pi; pts.append((cx + math.cos(a) * k, cy + math.sin(a) * k))
    elif p['shape'] == 'ellipse':
        for i in range(73):
            a = i / 72 * 2 * math.pi; x, y = 1.26 * k * 0.83 * math.cos(a), 0.76 * k * 0.83 * math.sin(a)
            pts.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    elif p['shape'] == 'eight':
        for i in range(145):
            t = i / 144 * 2 * math.pi; x, y = 0.62 * math.sin(2 * t) * 0.83 * k, 1.25 * math.sin(t) * 0.83 * k
            pts.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    elif p['shape'] == 'line':
        d = p.get('dir', 0); half = 2.2 * p.get('len', 0.6) / 0.6
        pts = [(cx - math.cos(d) * half, cy - math.sin(d) * half), (cx + math.cos(d) * half, cy + math.sin(d) * half)]
    return ' '.join(f'{X(x):.1f},{Y(y):.1f}' for x, y in pts)
svg = [f'<svg viewBox="0 0 {W:.0f} {H:.0f}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:520px;background:#0d0b1e;border-radius:6px">']
for i, p in enumerate(places):
    col = ['#9fd8e8', '#f2c97a', '#f0a0c8', '#b3e6a0', '#c8b8ff', '#ffd0a0'][i % 6]
    svg.append(f'<polyline points="{shape(p)}" fill="none" stroke="{col}" stroke-width="3" stroke-dasharray="7 3" opacity="0.9"/>')
    svg.append(f'<circle cx="{X(p["at"][0]):.1f}" cy="{Y(p["at"][1]):.1f}" r="5" fill="{col}"/>')
    svg.append(f'<text x="{X(p["at"][0]) + 8:.1f}" y="{Y(p["at"][1]) - 8:.1f}" fill="{col}" font-size="15" font-family="Georgia,serif" font-style="italic">{i + 1}. {p["id"]}{" (spiral)" if p.get("spiral") else ""}</text>')
for j, (b, beat, F) in enumerate(leaps):
    if j + 1 >= len(places): break
    a, z = places[j]['at'], places[j + 1]['at']
    if a == z: continue
    mx, my = (a[0] + z[0]) / 2 + (z[1] - a[1]) * 0.18, (a[1] + z[1]) / 2 - (z[0] - a[0]) * 0.18
    svg.append(f'<path d="M{X(a[0]):.1f},{Y(a[1]):.1f} Q{X(mx):.1f},{Y(my):.1f} {X(z[0]):.1f},{Y(z[1]):.1f}" fill="none" stroke="#fff3dc" stroke-width="1.6" opacity="0.7"/>')
    svg.append(f'<text x="{X(mx) + 6:.1f}" y="{Y(my):.1f}" fill="#fff3dc" font-size="13" font-family="system-ui">launch {beat * spb:.1f} s ({F} beats)</text>')
svg.append('</svg>')
# ---- the beat sheet
rows, b = [], 0
for s in L['segments']:
    t0, t1 = b * 4 * spb, (b + s['bars']) * 4 * spb
    words = ', '.join(f'{b + k}: {s["core"]["bars"][k % len(s["core"]["bars"])]}' for k in range(s['bars']))
    rows.append(f'<tr><td class="n">{t0:.1f}–{t1:.1f} s</td><td>{s["id"]} ({s["label"].lower()})</td><td>{words}</td></tr>')
    b += s['bars']
sp = ''.join(f'<tr><td class="n">{p["time"]:.2f} s</td><td>{p["name"]}</td><td>{p["what"]}</td></tr>' for p in L.get('setpieces', []))
def img(path):
    data = base64.b64encode((out.parent / path).read_bytes()).decode()
    return f'data:image/jpeg;base64,{data}'
pn = ''.join(f'<figure style="display:inline-block;width:220px;margin:6px;vertical-align:top"><img src="{img(p["img"])}" style="width:100%"><figcaption>{p["caption"]}</figcaption></figure>' for p in panels)
css = (ROOT / 'mockups/plan.css').read_text()
doc = ' '.join(L['_doc'][:1]) if isinstance(L.get('_doc'), list) else str(L.get('_doc', ''))
html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{L["title"]}: the plan</title><style>{css}</style></head><body><main>
<span class="tag">Plan</span><h1>{L["title"]}, as a journey</h1><p class="lede">{doc}</p>
<h2>Journey map</h2>{"".join(svg)}
<h2>Beat sheet</h2><div class="scroll"><table><tr><th>When</th><th>Section</th><th>Bars</th></tr>{"".join(rows)}</table></div>
<h2>Set pieces</h2><div class="scroll"><table><tr><th>When</th><th>Set piece</th><th>What you see and do</th></tr>{sp}</table></div>
{"<h2>Storyboard</h2><div class='scroll' style='white-space:nowrap'>" + pn + "</div>" if pn else ""}
</main></body></html>'''
out.write_text(html)
print('wrote', out)
