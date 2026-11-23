# helper for writing level layouts compactly (used by the level definitions below)
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
def seg(id, bars, label, lap, follow, plan, look, **kw):
    d = dict(id=id, bars=bars, label=label, lap=lap, follow=follow); d.update(kw); d['look'] = look; d['plan'] = plan; return d
def write(tid, head, segs):
    doc = json.load(open(ROOT / 'levels/skyhigh/level.json'))['_doc']
    (ROOT / f'levels/{tid}').mkdir(exist_ok=True)
    with open(ROOT / f'levels/{tid}/level.json', 'w') as f:
        f.write('{\n  "_doc": ' + json.dumps(doc, indent=4).replace('\n', '\n  ') + ',\n')
        for k, v in head.items(): f.write(f'  "{k}": {json.dumps(v)},\n')
        f.write('  "segments": [\n'); out = []
        for sg in segs:
            sg = dict(sg); plan = sg.pop('plan'); out.append('    ' + json.dumps(sg)[:-1] + ',\n      "plan": ' + json.dumps(plan) + ' }')
        f.write(',\n'.join(out) + '\n  ]\n}\n')
