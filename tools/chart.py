#!/usr/bin/env python3
"""Rhythm-first chart composer for a ONE-BUTTON game.

  python tools/chart.py skyhigh                    # compose (keeps hand-edited bars), compile, validate
  python tools/chart.py skyhigh --explain 26 42    # bar by bar: pattern and the sound it follows
  python tools/chart.py skyhigh --motifs           # print the motifs it found

Rules this tool enforces or warns about:
  1. ONE followed sound per section ("follow" in level.json: arp, kick, snare or lead). Voices are never merged.
  2. Same music = same taps. Sections that share a "motif" name are one repeating figure of `cycle` bars; a 16th
     position belongs to the motif when most repeats hit it hard, and every repeat then gets exactly that row.
  3. Only clearly audible notes: the tool lists every tap where the followed sound is weak in that bar.
  4. Repeats charted differently are listed too (a hand-edited bar that departs from its phrase).
Each bar's plan says how the followed voice is played (B = the kick/bass lane, L = the lead/arpeggio/clap lane):
  beat  8  16  all  half  tail  off  -      or an explicit shape  @x.x.xxx.x.x.xxx.
flags:  acc (accent on the bar's first note)   hop (the bar's notes are spike hops)   ghost=B|L (gates fade out)
        late (ghosts fade late: a teaching bar)        options: run=<longest burst of 16ths, default 4>
The lead layer "hook" comes from tools/lead.py (a pitch transcription), which also gives each tap its pitch so the
hitsounds can play the melody. The result is levels/<id>/sheet.json, one line per bar (x tap, X accent, g ghost,
G late ghost, ^ spike hop). Set a bar's "by" to "hand" after editing it and this tool will leave it alone.
Compiling checks the rules above, bakes kick/snare energy for the visuals, and writes levels/<id>/chart.json."""
import json, sys, pathlib
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parent.parent
THR = 0.33     # a 16th counts as "hit" in a layer at this strength
MOTIF_THR = 0.6  # ...and as part of a motif when it is this strong in most repeats
SOUND = {'kick': 'kick/bass', 'snare': 'clap/arpeggio', 'lead': 'lead', 'full': 'full mix', 'hook': 'lead hook (pitch transcription)'}
SCALE_FALLBACK = 72

def load(tid):
    level = json.load(open(ROOT / f'levels/{tid}/level.json')); audio = json.load(open(ROOT / f'levels/{tid}/audio.json'))
    F = dict(np.load(ROOT / f'tools/cache/{tid}.features.npz'))
    S = {k: F[k][::3] for k in ('kick', 'snare', 'lead', 'full')}       # one value per 16th
    # the lead hook, from the pitch transcription: strength of each note start, and the pitch sounding on each 16th
    S['hook'] = np.zeros(len(S['kick'])); S['pitch'] = np.zeros(len(S['kick']), dtype=int)
    lp = ROOT / f'tools/cache/{tid}.lead.json'
    if lp.exists():
        for bar, slots in json.load(open(lp)).items():
            for i, sl in enumerate(slots):
                idx = (int(bar) - 1) * 16 + i
                if idx >= len(S['hook']): continue
                if sl['level'] > 0.9: S['pitch'][idx] = sl['p']
                if sl['start'] and sl['rise'] > 0.3: S['hook'][idx] = min(1.5, 0.45 + sl['rise'] * 0.5)
    return level, audio, S

def seg_bars(level):
    out = []; bar = 0
    for s in level['segments']:
        out.append((s, bar, bar + s['bars'])); bar += s['bars']
    return out

def voice_layers(seg):
    """which measured layer each voice follows in this section"""
    return {'B': seg.get('bass', 'kick'), 'L': seg.get('lead', 'lead')}

def find_motifs(level, S):
    """motif[name][voice] = list (one per bar of the cycle) of sets of 16th positions"""
    groups = {}
    for seg, b0, b1 in seg_bars(level):
        if seg.get('motif'): groups.setdefault(seg['motif'], []).append((seg, b0, b1))
    motifs = {}
    for name, segs in groups.items():
        cyc = segs[0][0].get('cycle', 4); lay = voice_layers(segs[0][0]); bars = [b for _, b0, b1 in segs for b in range(b0, b1)]
        motifs[name] = {'cycle': cyc, 'bars': bars}
        for v, layer in lay.items():
            rows = []
            for j in range(cyc):
                reps = [S[layer][b * 16:b * 16 + 16] for i, b in enumerate(bars) if i % cyc == j and (b + 1) * 16 <= len(S[layer])]
                # in the motif = hit hard in most repeats (a weak or occasional hit is an ornament, not the figure)
                strong = np.mean([r >= MOTIF_THR for r in reps], axis=0) if reps else np.zeros(16)
                rows.append({i for i in range(16) if strong[i] >= 0.6})
            motifs[name][v] = rows
    return motifs

def _unused_runs(pos, min_run):
    out = []; p = sorted(pos); i = 0
    while i < len(p):
        j = i
        while j + 1 < len(p) and p[j + 1] == p[j] + 1: j += 1
        if j - i + 1 >= min_run: out.append((p[i], p[j]))
        i = j + 1
    return out

def voice_row(kind, v, seg, bar, b_in_motif, motif, S, opts):
    """one bar of one voice as 16 chars"""
    layer = voice_layers(seg)[v]; actual = S[layer][bar * 16:bar * 16 + 16]
    if len(actual) < 16: actual = np.pad(actual, (0, 16 - len(actual)))
    heard = {i for i in range(16) if actual[i] >= THR}
    m = motif[v][b_in_motif % motif['cycle']] if motif else heard
    live = set(m)                                       # same music = same taps: every repeat gets the motif exactly
    if kind.startswith('@'):                             # an explicit shape: kept wherever the bar really has that sound
        tpl = list(kind[1:].ljust(16, '.'))
        return ''.join(tpl)
    if kind == '-': pos = set()
    elif kind == 'beat': pos = {i for i in live if i % 4 == 0}
    elif kind == '8': pos = {i for i in live if i % 2 == 0}
    elif kind == '16': pos = set(live)
    elif kind == 'all': pos = live | {i for i in range(16) if actual[i] >= 0.5}
    elif kind == 'half': pos = {i for i in live if i % 2 == 0 and i <= 8}
    elif kind == 'tail': pos = {i for i in live if i % 2 == 0 and i >= 10}
    elif kind == 'off': pos = {i for i in (2, 6, 10, 14) if max(actual[max(0, i - 1):i + 2]) >= 0.25}
    else: raise ValueError(f'unknown pattern "{kind}"')
    row = ['.'] * 16
    cap = opts.get('run', 4); streak = 0
    for i in range(16):
        if i in pos and row[i] == '.':
            streak = streak + 1 if (i > 0 and row[i - 1] == 'x') else 1
            if streak <= cap: row[i] = 'x'
        elif row[i] == '.': streak = 0
    return ''.join(row)

def compose_bar(seg, plan, bar, b_in_motif, motif, S):
    row = {'B': '.' * 16, 'L': '.' * 16}
    opts = {}; flags = set(); ghost = ''
    for tok in plan.split():
        if '=' in tok:
            key, val = tok.split('=')
            if key == 'ghost': ghost = val
            elif key not in 'BL': opts[key] = int(val)
        else: flags.add(tok)
    for tok in plan.split():
        if '=' in tok and tok[0] in 'BL' and tok[1] == '=': row[tok[0]] = voice_row(tok.split('=')[1], tok[0], seg, bar, b_in_motif, motif, S, opts)
    if 'hop' in flags: row['B'] = row['B'].replace('x', '^')
    for lane in ghost:
        row[lane] = row[lane].replace('x', 'G' if 'late' in flags else 'g')
    if 'acc' in flags:
        for lane in 'BL':
            k = next((i for i, ch in enumerate(row[lane]) if ch != '.'), None)
            if k is not None: row[lane] = row[lane][:k] + 'X' + row[lane][k + 1:]; break
    b = list(row['B']); l = list(row['L'])
    row['B'] = ''.join(b); row['L'] = ''.join(l)
    return row

def compose(tid, level, audio, S, old):
    motifs = find_motifs(level, S); rows = []; prev = {r['bar']: r for r in old.get('rows', [])}
    for seg, b0, b1 in seg_bars(level):
        plans = seg.get('plan', ['-']); motif = motifs.get(seg.get('motif'))
        for bar in range(b0, b1):
            keep = prev.get(bar + 1)
            if keep and keep.get('by') == 'hand': rows.append(keep); continue
            plan = plans[(bar - b0) % len(plans)]
            b_in = motif['bars'].index(bar) if motif and bar in motif['bars'] else 0
            r = {'bar': bar + 1, 'sec': seg['id'], 'pat': plan}
            r.update(compose_bar(seg, plan, bar, b_in, motif, S)); r['by'] = 'tool'; rows.append(r)
    return {'rows': rows}, motifs

def write_sheet(tid, sheet):
    with open(ROOT / f'levels/{tid}/sheet.json', 'w') as f:
        f.write('{\n  "_doc": "One line per bar, 16 steps. B = bass/kick voice, L = lead voice. x tap, X accent, g ghost, G late ghost, ^ spike hop, . rest. Set by to hand after editing a bar; tools/chart.py then leaves it alone.",\n  "rows": [\n')
        f.write(',\n'.join('    ' + json.dumps(r, separators=(', ', ': ')) for r in sheet['rows']) + '\n  ]\n}\n')

def compile_chart(level, audio, S, rows):
    spb = 60 / audio['bpm']; notes = []; warn = []; end = audio['length'] - audio['offset'] - 0.3
    seg_of = {b: seg for seg, b0, b1 in seg_bars(level) for b in range(b0, b1)}
    for r in rows:
        bar = r['bar'] - 1; seg = seg_of[bar]; lay = voice_layers(seg)
        used = [lane for lane in 'BL' if r[lane].strip('.')]
        if len(used) > 1: warn.append(f"bar {bar + 1}: two voices in one bar (follow one sound at a time)")
        for lane in used:
            layer = lay[lane]
            for i, ch in enumerate(r[lane]):
                if ch == '.': continue
                idx = bar * 16 + i
                n = {'t': bar * 48 + i * 3, 'k': 'j' if ch == '^' else 't', 'v': seg.get('follow', 'lead')[0]}
                if ch == 'X': n['a'] = 1
                if ch in 'gG': n['g'] = 2 if ch == 'G' else 1
                if lane == 'L' and idx < len(S['pitch']) and S['pitch'][idx] > 0:
                    p = int(S['pitch'][idx]); scale = level.get('scale')
                    if scale and p % 12 not in scale:      # keep hitsounds in the song's key: snap a stray pitch to the nearest scale note
                        p += min((d for d in (-1, 1, -2, 2) if (p + d) % 12 in scale), key=abs)
                    n['p'] = p
                notes.append(n)
                heard = S[layer][idx] if idx < len(S[layer]) else 0
                if heard < THR: warn.append(f"bar {bar + 1} step {i + 1}: {SOUND[layer]} is weak here ({heard:.2f})")
    # same music = same taps: every repeat of a motif must be charted identically
    by_bar = {r['bar'] - 1: r for r in rows}; groups = {}
    for seg, b0, b1 in seg_bars(level):
        if seg.get('motif'): groups.setdefault(seg['motif'], [seg.get('cycle', 4), []])[1].extend(range(b0, b1))
    for name, (cyc, bars) in groups.items():
        for j in range(cyc):
            pats = {}
            for k, bar in enumerate(bars):
                if k % cyc == j: pats.setdefault((by_bar[bar]['B'] + by_bar[bar]['L']).lower().replace('g', 'x'), []).append(bar + 1)
            if len(pats) > 1: warn.append(f"motif '{name}' bar {j + 1} of {cyc} is charted {len(pats)} ways: " + ' vs '.join('bars ' + ','.join(map(str, v)) for v in pats.values()))
    notes = [n for n in notes if n['t'] / 12 * spb < end]
    notes.sort(key=lambda n: n['t'])
    digits = lambda v: ''.join(str(int(min(9, round(x * 7.5)))) for x in v)
    return notes, {'kick': digits(S['kick']), 'snare': digits(S['snare'])}, warn

def stars(notes, spb):
    ts = np.array(sorted(n['t'] / 12 * spb for n in notes))
    peak = max(np.sum((ts >= t) & (ts < t + 4)) for t in ts) / 4; avg = len(ts) / (ts[-1] - ts[0])
    gaps = np.diff(ts); fast = float(np.mean(gaps < 0.14)); extra = sum(1 for n in notes if n.get('g') or n['k'] == 'j') / len(notes)
    return round(float(np.clip(0.5 * peak + 0.45 * avg + 4.0 * fast + 2.5 * extra, 1, 10)), 1)

def explain(tid, level, audio, S, sheet, a, b):
    seg_of = {bb: seg for seg, b0, b1 in seg_bars(level) for bb in range(b0, b1)}
    for r in sheet['rows']:
        if not a <= r['bar'] <= b: continue
        seg = seg_of[r['bar'] - 1]; lay = voice_layers(seg); bar = r['bar'] - 1
        merged = ''.join(bc if bc != '.' else lc.replace('x', 'o') for bc, lc in zip(r['B'], r['L']))
        print(f"  bar {r['bar']:2d} [{seg['id']:6s}] {merged}  | {r['pat']:34s} | {r['by']}   (x bass, o lead: {SOUND[lay['B']]} / {SOUND[lay['L']]})")

def main(argv):
    tid = argv[0]; level, audio, S = load(tid); spb = 60 / audio['bpm']
    path = ROOT / f'levels/{tid}/sheet.json'
    old = json.load(open(path)) if path.exists() else {}
    sheet, motifs = compose(tid, level, audio, S, old)
    if '--motifs' in argv:
        for name, m in motifs.items():
            print(f"motif '{name}' ({m['cycle']}-bar cycle over bars {m['bars'][0] + 1}-{m['bars'][-1] + 1})")
            for v in 'BL': print(f"   {v}: " + '  '.join(''.join('x' if i in row else '.' for i in range(16)) for row in m[v]))
        return
    write_sheet(tid, sheet)
    notes, energy, warn = compile_chart(level, audio, S, sheet['rows'])
    st = stars(notes, spb); hand = sum(1 for r in sheet['rows'] if r.get('by') == 'hand')
    with open(ROOT / f'levels/{tid}/chart.json', 'w') as f:
        f.write('{\n  "level": "%s", "stars": %s,\n  "energy": %s,\n  "notes": [\n' % (tid, st, json.dumps(energy)))
        f.write(',\n'.join('    ' + json.dumps(n, separators=(', ', ': ')) for n in notes)); f.write('\n  ]\n}\n')
    kinds = dict(taps=sum(1 for n in notes if n['k'] == 't' and not n.get('g')), ghosts=sum(1 for n in notes if n.get('g')), hops=sum(1 for n in notes if n['k'] == 'j'), accents=sum(1 for n in notes if n.get('a')))
    print(f"{tid}: {len(notes)} notes {kinds}, rating {st} stars, hand-edited bars {hand}")
    print(f"   {len(warn)} warning(s)" + (':' if warn else ''))
    for w in warn[:40]: print('   !! ' + w)
    if '--explain' in argv:
        i = argv.index('--explain'); explain(tid, level, audio, S, sheet, int(argv[i + 1]), int(argv[i + 2]))

if __name__ == '__main__':
    main(sys.argv[1:])
