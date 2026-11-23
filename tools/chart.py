#!/usr/bin/env python3
"""Pattern composer: builds a level's charts from the song's motifs, then compiles them for the game.

  python tools/chart.py skyhigh                 # compose (keeps hand-edited bars), compile, validate
  python tools/chart.py skyhigh --explain hard 26 41   # bar-by-bar: pattern used and what each note follows
  python tools/chart.py skyhigh --motifs        # print the motifs it found

How it works
  1. MOTIFS. Sections that share a "motif" name in level.json are one musical idea (e.g. the four drop phrases).
     For each voice the tool finds the figure that repeats every `cycle` bars: a 16th-note position belongs to
     the motif when most repeats have a hit there.
  2. VOICES -> GATES, always the same:  cyan (left, inner)  = bass / kick      pink (right, outer) = lead / arpeggio / clap
     white = the melody while it is the only voice (either hand).   hold arc = a run of fast notes.
     hazard = kick (dodge sections).   accent (bigger gate, impact sound) = a marked big hit.
  3. PATTERNS. Each bar's plan in level.json names how each voice is played, from a small vocabulary:
       beat   motif notes that fall on beats           8     motif notes on the 8th-note grid
       16     the whole motif                          all   every measured hit (ornaments included: streams)
       half   8th-grid motif notes in beats 1-3        tail  8th-grid motif notes in beats 3-4 (the riff's tail)
       off    off-beat 8ths                            hold  runs of 4+ sixteenths become one hold arc
       -      rest
     plus "acc" (accent on beat 1), "stack" (both hands accent beat 1), "solo" (never two hands at once).
     A bar's plan is e.g. "C=16 P=beat stack" and is recorded with the bar, so the chart reads as named shapes.
  4. SHEET. The result is levels/<id>/sheet.json: one line per bar per difficulty, in a notation you can edit:
       x tap   X accent   [ - ] hold start / body / release   . rest      lanes: W white, C cyan, P pink, Z hazards (0/1)
     Change a bar, set its "by" to "hand", and re-running this tool will never overwrite it.
  5. COMPILE. The sheet becomes normal.json / hard.json / insane.json. Every note is checked against the audio and
     the tool reports any note with no measured sound under it."""
import json, sys, pathlib
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = {'N': 'normal', 'H': 'hard', 'I': 'insane'}
STAR_BASE = {'N': 0.3, 'H': 0.9, 'I': 1.5}
THR = 0.33     # a 16th counts as "hit" in a layer at this strength
MOTIF_THR = 0.6  # ...and as part of a motif when it is this strong in most repeats
SOUND = {'kick': 'kick/bass', 'snare': 'clap/arpeggio', 'lead': 'lead', 'full': 'full mix'}

def load(tid):
    level = json.load(open(ROOT / f'levels/{tid}/level.json')); audio = json.load(open(ROOT / f'levels/{tid}/audio.json'))
    F = dict(np.load(ROOT / f'tools/cache/{tid}.features.npz'))
    S = {k: F[k][::3] for k in ('kick', 'snare', 'lead', 'full')}       # one value per 16th
    return level, audio, S

def seg_bars(level):
    out = []; bar = 0
    for s in level['segments']:
        out.append((s, bar, bar + s['bars'])); bar += s['bars']
    return out

def voice_layers(seg):
    """which measured layer each voice follows in this section"""
    return {'C': seg.get('cyan', 'kick'), 'P': seg.get('pink', 'lead'), 'W': seg.get('white', 'snare')}

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

def runs(pos, min_run):
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
    live = {i for i in m if actual[i] >= 0.25}          # a motif note only plays in bars where it really sounds
    if kind.startswith('@'):                             # an explicit shape: kept wherever the bar really has that sound
        tpl = list(kind[1:].ljust(16, '.'))
        for i, ch in enumerate(tpl):
            if ch in 'xX' and actual[i] < 0.15: tpl[i] = '.'
        return ''.join(tpl)
    if kind == '-': pos = set()
    elif kind == 'beat': pos = {i for i in live if i % 4 == 0}
    elif kind == '8': pos = {i for i in live if i % 2 == 0}
    elif kind == '16': pos = set(live)
    elif kind == 'all': pos = live | {i for i in range(16) if actual[i] >= 0.5}
    elif kind == 'half': pos = {i for i in live if i % 2 == 0 and i <= 8}
    elif kind == 'tail': pos = {i for i in live if i % 2 == 0 and i >= 10}
    elif kind == 'off': pos = {i for i in (2, 6, 10, 14) if max(actual[max(0, i - 1):i + 2]) >= 0.25}
    elif kind == 'hold': pos = set(live)
    else: raise ValueError(f'unknown pattern "{kind}"')
    row = ['.'] * 16
    if kind == 'hold':
        for a, e in runs(pos, opts.get('minRun', 4)):
            e = min(e, a + opts.get('maxHold', 8))
            row[a] = '['; row[e] = ']'
            for i in range(a + 1, e): row[i] = '-'
            pos -= set(range(a - 1, e + 3))
        pos = {i for i in pos if i % 2 == 0}
    cap = opts.get('run', 16); streak = 0
    for i in range(16):
        if i in pos and row[i] == '.':
            streak = streak + 1 if (i > 0 and row[i - 1] == 'x') else 1
            if streak <= cap: row[i] = 'x'
        elif row[i] == '.': streak = 0
    return ''.join(row)

def compose_bar(seg, plan, bar, b_in_motif, motif, S, D):
    row = {'W': '.' * 16, 'C': '.' * 16, 'P': '.' * 16, 'Z': '.' * 16}
    opts = {}; flags = set()
    for tok in plan.split():
        if '=' in tok:
            k, val = tok.split('=');
            if k not in 'WCP': opts[k] = int(val)
        else: flags.add(tok)
    # options written after a voice still apply: recompute once all are known
    for tok in plan.split():
        if '=' in tok and tok[0] in 'WCP': row[tok[0]] = voice_row(tok.split('=')[1], tok[0], seg, bar, b_in_motif, motif, S, opts)
    full = S['full'][bar * 16] if bar * 16 < len(S['full']) else 0
    def put(k, i, ch):
        r = list(row[k]);
        if r[i] in '.x': r[i] = ch
        row[k] = ''.join(r)
    if 'stack' in flags and full >= 0.2: put('C', 0, 'X'); put('P', 0, 'X')
    if 'acc' in flags and full >= 0.2:
        k = 'W' if row['W'].strip('.') else ('C' if row['C'].strip('.') else 'P'); put(k, 0, 'X')
    if 'solo' in flags:      # one thing at a time: where both hands land together keep the accent or the cyan note
        c = list(row['C']); p = list(row['P'])
        for i in range(16):
            if c[i] != '.' and p[i] != '.' and not (c[i] == 'X' and p[i] == 'X'):
                if p[i] in '[-]' or p[i] == 'X': c[i] = '.'
                elif c[i] in 'xX': p[i] = '.'
            # and never a tap on one hand in the 16th right next to a tap on the other
            if i > 0 and c[i] == 'x' and p[i - 1] == 'x': c[i] = '.'
            if i > 0 and p[i] == 'x' and c[i - 1] == 'x': p[i] = '.'
        row['C'] = ''.join(c); row['P'] = ''.join(p)
    return row

def compose_dodge(seg, plan, bar, S, first, lane_state):
    opts = dict(t.split('=') for t in plan.split() if '=' in t)
    grid = int(opts.get('grid', 4)); pat = opts.get('lanes', '10'); k = S['kick'][bar * 16:bar * 16 + 16]
    row = ['.'] * 16
    for i in range(0, 16, 16 // grid):
        if first and i < 4: continue
        if k[i] >= float(opts.get('thr', 0.3)):
            row[i] = pat[lane_state[0] % len(pat)]; lane_state[0] += 1
    return ''.join(row)

def compose(tid, level, audio, S, old):
    motifs = find_motifs(level, S); sheet = {}
    for D, name in NAMES.items():
        rows = []; prev = {r['bar']: r for r in old.get(name, [])}
        for seg, b0, b1 in seg_bars(level):
            plans = seg.get('plan', {}).get(D, ['-']); motif = motifs.get(seg.get('motif')); lane_state = [0]
            for bar in range(b0, b1):
                keep = prev.get(bar + 1)
                if keep and keep.get('by') == 'hand': rows.append(keep); continue
                plan = plans[(bar - b0) % len(plans)]
                r = {'bar': bar + 1, 'sec': seg['id'], 'pat': plan}
                if seg['mode'] == 'spinner': r.update(W='.' * 16, C='.' * 16, P='.' * 16, Z='.' * 16)
                elif seg['mode'] == 'dodge': r.update(W='.' * 16, C='.' * 16, P='.' * 16, Z=compose_dodge(seg, plan, bar, S, bar == b0, lane_state))
                else:
                    b_in = motif['bars'].index(bar) if motif and bar in motif['bars'] else 0
                    r.update(compose_bar(seg, plan, bar, b_in, motif, S, D))
                r['by'] = 'tool'; rows.append(r)
        sheet[name] = rows
    return sheet, motifs

def write_sheet(tid, sheet):
    with open(ROOT / f'levels/{tid}/sheet.json', 'w') as f:
        f.write('{\n  "_doc": "One line per bar. x tap, X accent, [ - ] hold, . rest. Lanes: W white, C cyan, P pink, Z hazards. Set by to hand after editing a bar; tools/chart.py then leaves it alone.",\n')
        for i, (name, rows) in enumerate(sheet.items()):
            f.write(f'  "{name}": [\n' + ',\n'.join('    ' + json.dumps(r, separators=(', ', ': ')) for r in rows) + '\n  ]' + (',\n' if i < len(sheet) - 1 else '\n'))
        f.write('}\n')

def compile_chart(level, audio, S, rows, D):
    spb = 60 / audio['bpm']; notes = []; warn = []; segs = seg_bars(level); end = audio['length'] - audio['offset'] - 0.3
    for seg, b0, b1 in segs:
        if seg['mode'] == 'spinner':
            d = (b1 - b0) * 48 - 6; notes.append({'t': b0 * 48, 'k': 's', 'd': d, 'n': int(round(seg['rate'][D] * d / 12 * spb))})
    seg_of = {b: seg for seg, b0, b1 in segs for b in range(b0, b1)}
    for r in rows:
        bar = r['bar'] - 1; seg = seg_of[bar]; lay = voice_layers(seg)
        for lane, hand in (('W', 'A'), ('C', 'L'), ('P', 'R')):
            row = r[lane]; i = 0
            while i < 16:
                ch = row[i]; t = bar * 48 + i * 3
                if ch in 'xX':
                    n = {'t': t, 'k': 't', 'h': hand}
                    if ch == 'X': n['a'] = 1
                    notes.append(n)
                elif ch == '[':
                    j = row.index(']', i); notes.append({'t': t, 'k': 'h', 'h': hand, 'd': (j - i) * 3}); i = j
                if ch in 'xX[':
                    idx = bar * 16 + (t - bar * 48) // 3
                    heard = max(S[k][idx] if idx < len(S[k]) else 0 for k in ('kick', 'snare', 'lead', 'full'))
                    if heard < 0.15: warn.append(f"bar {bar + 1} {lane} step {(t - bar * 48) // 3 + 1}")
                i += 1
        for i, ch in enumerate(r['Z']):
            if ch in '01': notes.append({'t': bar * 48 + i * 3, 'k': 'z', 'lane': int(ch)})
    notes = [n for n in notes if (n['t'] + n.get('d', 0)) / 12 * spb < end]
    notes.sort(key=lambda n: (n['t'], n.get('h', '')))
    # ring speed per section: denser passages get faster laps, so neighbouring gates never crowd (22.5 degrees per 16th at most)
    laps = {}
    for seg, b0, b1 in segs:
        ts = sorted({n['t'] for n in notes if b0 * 48 <= n['t'] < b1 * 48 and n['k'] in 'th'})
        gap = min([b - a for a, b in zip(ts[:-1], ts[1:])], default=48)
        fit = 4 if gap <= 3 else 8
        laps[seg['id']] = seg['lap'] if seg.get('lapFixed') else min(seg['lap'], fit) if seg['mode'] != 'dual' else min(seg['lap'], 4)
    return notes, laps, warn

def stars(notes, spb, D):
    ts = np.array(sorted(n['t'] / 12 * spb for n in notes if n['k'] in 'th'))
    if len(ts) < 2: return 1.0
    peak = max(np.sum((ts >= t) & (ts < t + 4)) for t in ts) / 4; avg = len(ts) / (ts[-1] - ts[0])
    gaps = np.diff(ts); fast = float(np.mean((gaps > 0.01) & (gaps < 0.14))); chords = float(np.mean(gaps < 0.01))
    holds = sum(1 for n in notes if n['k'] == 'h') / len(notes)
    return round(float(np.clip(0.32 * peak + 0.25 * avg + 3.0 * fast + 1.2 * chords + 2 * holds + STAR_BASE[D], 1, 10)), 1)

def explain(tid, level, audio, S, sheet, name, a, b):
    seg_of = {bb: seg for seg, b0, b1 in seg_bars(level) for bb in range(b0, b1)}
    print(f"{tid} {name}: bars {a}-{b}   (C cyan/left, P pink/right; 16 steps per bar)")
    for r in sheet[name]:
        if not a <= r['bar'] <= b: continue
        seg = seg_of[r['bar'] - 1]; lay = voice_layers(seg); bar = r['bar'] - 1
        def follows(lane):
            hits = [i for i, ch in enumerate(r[lane]) if ch in 'xX[']
            if not hits: return ''
            layer = lay[lane]; ok = sum(1 for i in hits if S[layer][bar * 16 + i] >= 0.15)
            return f"{SOUND[layer]} ({ok}/{len(hits)} on a measured hit)"
        print(f"  bar {r['bar']:2d} [{seg['id']:6s}] C {r['C']}  P {r['P']}  | {r['pat']:28s} | {r['by']:4s} | C: {follows('C')}; P: {follows('P')}")

def main(argv):
    tid = argv[0]; level, audio, S = load(tid); spb = 60 / audio['bpm']
    path = ROOT / f'levels/{tid}/sheet.json'
    old = json.load(open(path)) if path.exists() else {}
    sheet, motifs = compose(tid, level, audio, S, old)
    if '--motifs' in argv:
        for name, m in motifs.items():
            print(f"motif '{name}' ({m['cycle']}-bar cycle over bars {m['bars'][0] + 1}-{m['bars'][-1] + 1})")
            for v in 'CPW':
                print(f"   {v}: " + '  '.join(''.join('x' if i in row else '.' for i in range(16)) for row in m[v]))
        return
    write_sheet(tid, sheet)
    for D, name in NAMES.items():
        notes, laps, warn = compile_chart(level, audio, S, sheet[name], D)
        st = stars(notes, spb, D); hand = sum(1 for r in sheet[name] if r.get('by') == 'hand')
        with open(ROOT / f'levels/{tid}/{name}.json', 'w') as f:
            f.write('{\n  "level": "%s", "difficulty": "%s", "stars": %s,\n  "laps": %s,\n  "notes": [\n' % (tid, name, st, json.dumps(laps)))
            f.write(',\n'.join('    ' + json.dumps(n, separators=(', ', ': ')) for n in notes)); f.write('\n  ]\n}\n')
        kinds = {k: sum(1 for n in notes if n['k'] == k) for k in 'thzs'}
        print(f"{tid} {name}: {len(notes)} notes {kinds}, accents {sum(1 for n in notes if n.get('a'))}, stars {st}, hand-edited bars {hand}, laps {laps}")
        if warn: print(f"   !! {len(warn)} notes with no measured sound: " + '; '.join(warn[:12]))
    if '--explain' in argv:
        i = argv.index('--explain'); explain(tid, level, audio, S, sheet, argv[i + 1], int(argv[i + 2]), int(argv[i + 3]))

if __name__ == '__main__':
    main(sys.argv[1:])
