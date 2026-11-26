#!/usr/bin/env python3
"""World 1, complete: the final report (the owner's brief of 2026-11-26). One section per level with its checks (from the
check folders), every decision made without the owner, known issues, what needs the owner's decision, and how to
play each level, scene and memory. Usage: python3 tools/final_report.py <report dir>"""
import base64, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
R = pathlib.Path(sys.argv[1])
CSS = (ROOT / 'mockups/plan.css').read_text()
U = R / '6 the Ufotable pass'
LEVELS = [('the Drifting Edge', U / 'the Drifting Edge', None), ('Emberwick', U / 'Emberwick', None), ('Cirra', U / 'Cirra', '1 Cirra'),
          ('the ambush', U / 'the ambush', '3 the ambush'), ('Glassmere', U / 'Glassmere', '4 Glassmere'), ('Verdance', U / 'Verdance', '5 Verdance'),
          ('the guardian', U / 'the guardian', '7 the guardian')]

def read(p):
    return p.read_text() if p.exists() else ''

def img(p, h=300):
    if not p.exists(): return ''
    return f'<div class="scroll"><img src="data:image/jpeg;base64,{base64.b64encode(p.read_bytes()).decode()}" style="max-width:none;height:{h}px"></div>'

def png(p, h=420):
    if not p.exists(): return ''
    return f'<div class="scroll"><img src="data:image/png;base64,{base64.b64encode(p.read_bytes()).decode()}" style="max-width:none;height:{h}px"></div>'

def level(name, d, folder):
    audit = read(d / 'audit.txt')
    verdict = next((l.strip() for l in audit.splitlines() if 'VERDICT' in l), 'no audit')
    journey = '<br>'.join(l.strip() for l in audit.splitlines() if re.search(r'places, \d+ hops|shortest gap .* quick taps', l))
    tests = '<br>'.join(l for l in read(d / 'tests.txt').splitlines() if re.search(r'FORGIVE|SPAMBOT|PAIRS|Tests', l))
    ready = '<br>'.join(read(d / 'readability.txt').splitlines()[-3:])
    ft = read(d / 'frame-times.txt')
    try:
        j = json.loads([l for l in ft.splitlines() if l.startswith('{')][-1]); ft = f"average {j['avg']} ms, 99th percentile {j['p99']} ms, worst {j['worst']} ms, frames over 17 ms: {j['over17']} of {j['frames']}"
    except Exception:
        ft = 'not measured'
    sm = read(d / 'smoothness.txt')
    try:
        s = json.loads(sm); rough = s['rough']; sm = f"{s['fps']} frames a second; rough moments: camera {len(rough['camera'])}, zoom {len(rough['zoom'])}, Orbin on screen {len(rough['orbin on screen'])} {rough['orbin on screen'][:4]}, Orbin in the world {len(rough['orbin in the world'])}; take-offs and landings on the beat: {s['on the beat (take-offs, landings)']}; on-beat impacts: {len(s['impacts'])}"
    except Exception:
        sm = 'not measured'
    links = f'<p>The level\'s own pages: <code>{folder}/0 the plan.html</code> and its report.</p>' if folder else ''
    return f'''<h2>{name}</h2>{links}
<p><b>Audit:</b> {verdict}<br>{journey}</p><p><b>Tests:</b><br>{tests}</p><p><b>Readability (phone):</b><br>{ready}</p>
<p><b>Frame times (this Mac):</b> {ft}</p><p><b>Smoothness:</b> {sm}</p>
{png(d / 'smoothness.png')}
<p>Every 3 seconds (phone):</p>{img(d / 'every 3 s.jpg', 260)}<p>Freeze-frames on a wide screen:</p>{img(d / 'freeze-frames, wide.jpg', 420)}
<p>The recording: <code>{d.relative_to(R)}/recording.mp4</code></p>'''

notes = (R / 'final-notes.html').read_text() if (R / 'final-notes.html').exists() else ''
body = notes + ''.join(level(*l) for l in LEVELS)
html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>World 1, complete</title><style>{CSS}</style></head><body><main>
<span class="tag">Final report</span><h1>World 1, complete</h1><p class="lede">Every level of World 1 as a journey, the scenes and memories between them, the guardian and the ending, then the refinement: the Ufotable pass on the camera and motion, the map and the menus.</p>
{body}
</main></body></html>'''
out = R / '0 World 1, complete (final report).html'
out.write_text(html)
print('wrote', out)
