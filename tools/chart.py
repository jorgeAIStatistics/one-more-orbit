#!/usr/bin/env python3
"""Pattern composer for a ONE-BUTTON game: builds a level's chart from the song's motifs, then compiles it.

  python tools/chart.py skyhigh                    # compose (keeps hand-edited bars), compile, validate
  python tools/chart.py skyhigh --explain 26 42    # bar by bar: pattern used and what each note follows
  python tools/chart.py skyhigh --motifs           # print the motifs it found

Every note is one tap. Two voices are composed and then merged into a single stream:
  B = bass / kick      L = lead / arpeggio / clap      (gate colour shows the voice; the tap is the same)
Sections that share a "motif" name in level.json are one repeating figure; a 16th position is in the motif when
most repeats hit it hard. Each bar's plan names how each voice is played:
  beat  8  16  all  half  tail  off  -      or an explicit shape  @x.x.xxx.x.x.xxx.
flags:  stack (accent on beat 1)   hop (this bar's B notes are spike hops)   ghost=B|L|BL (those gates fade out)
        late (ghosts fade late: a teaching bar)        options: run=<longest burst of 16ths>
The result is levels/<id>/sheet.json, one line per bar:  x tap  X accent  g ghost  G late ghost  ^ spike hop  . rest
Change a bar, set its "by" to "hand", and re-running this tool will not overwrite it.
Compiling merges the voices (never two taps at once, at most three 16ths in a row), checks every note against
the audio, bakes the kick/snare energy the visuals react to, and writes levels/<id>/chart.json."""
import json, sys, pathlib
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parent.parent
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
    else: raise ValueError(f'unknown pattern "{kind}"')
    row = ['.'] * 16
    cap = opts.get('run', 16); streak = 0
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
    full = S['full'][bar * 16] if bar * 16 < len(S['full']) else 0
    if 'stack' in flags and full >= 0.2:
        row['B'] = 'X' + row['B'][1:]; row['L'] = '.' + row['L'][1:]
    if 'hop' in flags: row['B'] = row['B'].replace('x', '^')
    for lane in ghost:
        row[lane] = row[lane].replace('x', 'G' if 'late' in flags else 'g')
    # one button: never two taps at once (the bass note wins), and never more than `run` sixteenths in a row
    b = list(row['B']); l = list(row['L'])
    for i in range(16):
        if b[i] != '.' and l[i] != '.': l[i] = '.'
    cap = opts.get('run', 3); streak = 0
    for i in range(16):
        if b[i] != '.' or l[i] != '.':
            streak += 1
            if streak > cap:
                if l[i] != '.': l[i] = '.'
                else: b[i] = '.'
                streak = 0
        else: streak = 0
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
        bar = r['bar'] - 1
        for i in range(16):
            for lane, voice in (('B', 'b'), ('L', 'l')):
                ch = r[lane][i]
                if ch == '.': continue
                if notes and notes[-1]['t'] == bar * 48 + i * 3: continue      # one tap per moment
                n = {'t': bar * 48 + i * 3, 'k': 'j' if ch == '^' else 't', 'v': voice}
                if ch == 'X': n['a'] = 1
                if ch in 'gG': n['g'] = 2 if ch == 'G' else 1
                notes.append(n)
                idx = bar * 16 + i
                if max(S[k][idx] if idx < len(S[k]) else 0 for k in ('kick', 'snare', 'lead', 'full')) < 0.15: warn.append(f"bar {bar + 1} step {i + 1}")
    notes = [n for n in notes if n['t'] / 12 * spb < end]
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
    if warn: print(f"   !! {len(warn)} notes with no measured sound: " + '; '.join(warn[:12]))
    if '--explain' in argv:
        i = argv.index('--explain'); explain(tid, level, audio, S, sheet, int(argv[i + 1]), int(argv[i + 2]))

if __name__ == '__main__':
    main(sys.argv[1:])
