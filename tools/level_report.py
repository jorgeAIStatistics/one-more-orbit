#!/usr/bin/env python3
"""A level's one-page report (the owner's final report: plan, set pieces with times, audit, tests, frame times,
recording), from its plan page's pieces and the outputs of tools/check/level.sh. Usage:

    python3 tools/level_report.py <folder> <level id> <checks dir> <out.html> "<title>" [notes.html]
"""
import base64, json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
folder, lid, chk, out, title = sys.argv[1:6]
notes = pathlib.Path(sys.argv[6]).read_text() if len(sys.argv) > 6 else ''
chk = pathlib.Path(chk); out = pathlib.Path(out)
plan = out.parent / '_plan.html'
subprocess.run(['python3', str(ROOT / 'tools/plan_page.py'), folder, str(plan)], check=True, capture_output=True)
ph = plan.read_text(); plan.unlink()
body = ph[ph.index('<h2>Journey map</h2>'):ph.index('</main>')]
lede = re.search(r'<p class="lede">(.*?)</p>', ph, re.S).group(1)
css = (ROOT / 'mockups/plan.css').read_text()
def read(name):
    p = chk / name
    return p.read_text() if p.exists() else ''
audit = read('audit.txt')
def grab(pattern, text=audit):
    return [l.strip() for l in text.splitlines() if re.search(pattern, l)]
aud = '<br>'.join(grab(rf'^{lid}[: (]') + grab(r'^\s+(calm|peak) ') + grab(r'VERDICT|bars above|stacked|turns:') + grab(r'phrase \d+-\d+ +\d+ action'))
tests = read('tests.txt'); tl = '<br>'.join(l for l in tests.splitlines() if re.search(r'FORGIVE|SPAMBOT|PAIRS|Tests|×', l))
ready = '<br>'.join(read('readability.txt').splitlines()[-3:])
ft = read('frame-times.txt')
try:
    d = json.loads([l for l in ft.splitlines() if l.startswith('{')][-1]); ft = f"average {d['avg']} ms, 99th percentile {d['p99']} ms, worst {d['worst']} ms ({d['worstAt'][0]}), frames over 17 ms: {d['over17']} of {d['frames']}"
except Exception:
    ft = ft[-400:]
def img(p):
    p = chk / p
    return 'data:image/jpeg;base64,' + base64.b64encode(p.read_bytes()).decode() if p.exists() else ''
fz, ev = img('freeze-frames, all.jpg'), img('every 3 s.jpg')
html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title><style>{css}</style></head><body><main>
<span class="tag">Built · checks</span><h1>{title}</h1><p class="lede">{lede}</p>
{notes}
{body}
<h2>The whole level, every three seconds</h2><div class="scroll"><img src="{ev}" style="max-width:none;height:360px"></div>
<h2>Freeze-frames: every launch, landing, crossing and cluster</h2><div class="scroll"><img src="{fz}" style="max-width:none;height:600px"></div>
<h2>Audit</h2><p style="font-size:14px">{aud}</p>
<h2>Tests</h2><p style="font-size:14px">{tl}</p>
<h2>Readability over the whole level (phone)</h2><p style="font-size:14px">{ready}</p>
<h2>Frame times (this Mac, Chrome, the whole level)</h2><p>{ft}</p>
<h2>Recording</h2><p>The whole level with its sound: <code>recording.mp4</code> in the checks folder.</p>
</main></body></html>'''
out.write_text(html)
print('wrote', out)
