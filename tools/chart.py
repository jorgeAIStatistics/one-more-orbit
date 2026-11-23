#!/usr/bin/env python3
"""Compose the NORMAL / HARD / INSANE charts for a level from its layout and the measured audio.

  python tools/chart.py skyhigh

Reads levels/<id>/level.json (segments + 'gen' rules) and tools/cache/<id>.features.npz (from analyze.py).
Writes levels/<id>/normal.json, hard.json, insane.json. Every note sits on a grid position where that bar
really has a hit in the layer it follows: cyan/left = low sounds (kick, bass), pink/right = high sounds
(clap, snare, lead, arpeggio), hold arcs = runs of fast notes (press on the first, release on the last).

Note format (positions in ticks, 12 per beat, counted from bar 1):
  {"t": tick, "k": "t"}                  tap     ("h": "L" | "R" | "A" = which side; A = either)
  {"t": tick, "k": "h", "d": ticks}      hold    (press at t, release at t + d)
  {"t": tick, "k": "z", "lane": 0 | 1}   hazard  (dodge sections: be in the other lane at t)
  {"t": tick, "k": "s", "d": ticks, "n": taps}   spinner"""
import json, sys, pathlib
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parent.parent
GRID = {4: 12, 8: 6, 16: 3}
NAMES = {'N': 'normal', 'H': 'hard', 'I': 'insane'}
STAR_BASE = {'N': 0.0, 'H': 0.6, 'I': 1.2}

def bonus(t, pen=0.08):
    if t % 48 == 0: return 0.25
    if t % 12 == 0: return 0.12
    if t % 6 == 0: return 0.05
    return -pen

def greedy(strength, cand, k, gap, run, taken, thr):
    """strongest-first pick of up to k ticks, keeping a minimum gap and capping bursts at grid speed"""
    sel = list(taken); out = []
    def chain_ok(t):
        pts = sorted(set(sel + [t])); best = cur = 1
        for a, b in zip(pts[:-1], pts[1:]):
            cur = cur + 1 if b - a <= gap else 1
            best = max(best, cur)
        return best <= run
    for t in sorted(cand, key=lambda q: -(strength[q] + bonus(q))):
        if len(out) >= k: break
        if strength[t] < thr: continue
        if any(abs(t - s) < gap for s in sel): continue
        if not chain_ok(t): continue
        sel.append(t); out.append(t)
    return out

def select(strength, t0, t1, grid, n, run=1, thr=0.3, first=0, blocked=(), force=()):
    step = GRID[grid]; chosen = [t0 + f for f in force]
    for b in range((t1 - t0 + 47) // 48):
        if b < first: continue
        k = int(n) + (1 if (n % 1 >= 0.5 and b % 2 == 1) or (0 < n % 1 < 0.5 and b % 4 == 3) else 0)
        cand = [t for t in range(t0 + b * 48, min(t0 + (b + 1) * 48, t1)) if t % step == 0 and t < len(strength)
                and not any(a <= t <= c for a, c in blocked)]
        chosen += greedy(strength, cand, k - sum(1 for f in chosen if t0 + b * 48 <= f < t0 + (b + 1) * 48), step, run, chosen, thr)
    return sorted(set(chosen))

def runs(strength, t0, t1, min_run, thr=0.33, max_len=24):
    """stretches of consecutive 16th-note hits: these become hold arcs"""
    out = []; t = t0
    while t < min(t1, len(strength)):
        if strength[t] >= thr:
            e = t
            while e + 3 < min(t1, len(strength)) and strength[e + 3] >= thr and e + 3 - t <= max_len - 3: e += 3
            if (e - t) // 3 + 1 >= min_run:
                out.append((t, e)); t = e + 12; continue
            t = e + 3
        else: t += 3
    return out

def two_hand(seg, g, t0, t1, F, neutral=False):
    low = F['kick']; high = np.maximum(F['snare'], F['lead'])
    if seg.get('swap'): low, high = high, low
    notes = []; blockedR = []
    hold_hand = g.get('hand', 'R')
    if (seg['mode'] == 'hold' or seg.get('holds')) and g.get('minRun'):
        for a, e in runs(high, t0, t1, g['minRun']):
            notes.append({'t': a, 'k': 'h', 'h': 'A' if neutral else hold_hand, 'd': e - a}); blockedR.append((a - 9, e + 9))
    thr = g.get('thr', 0.3); run = g.get('run', 1)
    R = select(high, t0, t1, g['grid'], g.get('nR', g.get('n', 0)), run, thr, g.get('first', 0), blockedR, g.get('forceR', ()))
    L = [] if neutral else select(low, t0, t1, g['grid'], g.get('nL', 0), run, thr, g.get('first', 0), (), g.get('forceL', ()))
    if not g.get('chords'): L = [t for t in L if t not in R or low[t] >= high[t]]; R = [t for t in R if t not in L]
    merged = sorted([(t, 'L') for t in L] + [(t, 'R') for t in R])
    if g.get('alt'):                      # NORMAL: one clear stream, never two things at once
        step = GRID[g['grid']]; keep = []
        for t, h in merged:
            s = (low if h == 'L' else high)[t]
            if any(a <= t <= c for a, c in blockedR): continue
            if keep and t - keep[-1][0] < step:
                if s > keep[-1][2]: keep[-1] = (t, h, s)
                continue
            keep.append((t, h, s))
        merged = [(t, h) for t, h, _ in keep]
    for t, h in merged: notes.append({'t': t, 'k': 't', 'h': 'A' if neutral else h})
    return notes

def m_tap(seg, g, t0, t1, F):
    s = np.maximum.reduce([F['lead'], 0.9 * F['snare'], 0.6 * F['kick'], 0.5 * F['full']])
    return [{'t': t, 'k': 't', 'h': 'A'} for t in select(s, t0, t1, g['grid'], g['n'], g.get('run', 1), g.get('thr', 0.3), g.get('first', 0), (), g.get('force', ()))]

def m_hold(seg, g, t0, t1, F): return two_hand(seg, g, t0, t1, F, neutral=g.get('hand') == 'A')
def m_colour(seg, g, t0, t1, F): return two_hand(seg, g, t0, t1, F)

def m_dodge(seg, g, t0, t1, F):
    s = np.maximum(F['kick'], 0.5 * F['full'])
    ticks = select(s, t0, t1, g['grid'], g['n'], 99, g.get('thr', 0.3), 0, [(t0, t0 + 11)])
    pat = g.get('pattern', '10')
    return [{'t': t, 'k': 'z', 'lane': int(pat[i % len(pat)])} for i, t in enumerate(ticks)]

def m_spinner(seg, g, t0, t1, F, spb):
    d = t1 - t0 - 6
    return [{'t': t0, 'k': 's', 'd': d, 'n': int(round(g['rate'] * d / 12 * spb))}]

def stars(notes, spb, D):
    ts = sorted(n['t'] / 12 * spb for n in notes if n['k'] in 'th')
    if len(ts) < 2: return 1.0
    ts = np.array(ts); peak = max(np.sum((ts >= t) & (ts < t + 4)) for t in ts) / 4
    gaps = np.diff(ts); fast = float(np.mean(gaps < 0.14)); chords = float(np.mean(gaps < 0.01))
    kinds = len({n['k'] for n in notes}) + (1 if any(n.get('h') in 'LR' for n in notes if 'h' in n) else 0)
    return round(float(np.clip(0.55 * peak + 2.2 * fast + 1.5 * chords + 0.15 * kinds + STAR_BASE[D], 1, 10)), 1)

def main(tid):
    level = json.load(open(ROOT / f'levels/{tid}/level.json')); audio = json.load(open(ROOT / f'levels/{tid}/audio.json'))
    F = dict(np.load(ROOT / f'tools/cache/{tid}.features.npz')); spb = 60 / audio['bpm']
    modes = {'tap': m_tap, 'hold': m_hold, 'colour': m_colour, 'dual': m_colour, 'dodge': m_dodge}
    for D, name in NAMES.items():
        notes = []; t0 = 0; per = []
        for seg in level['segments']:
            t1 = t0 + seg['bars'] * 48; g = seg['gen'][D]
            got = m_spinner(seg, g, t0, t1, F, spb) if seg['mode'] == 'spinner' else modes[seg['mode']](seg, g, t0, t1, F)
            got = [n for n in got if (n['t'] + n.get('d', 0)) / 12 * spb < audio['length'] - audio['offset'] - 0.3]
            per.append(f"{seg['id']}:{len(got)}"); notes += got; t0 = t1
        notes.sort(key=lambda n: (n['t'], n.get('h', '')))
        chart = dict(level=tid, difficulty=name, stars=stars(notes, spb, D), notes=notes)
        with open(ROOT / f'levels/{tid}/{name}.json', 'w') as f:
            f.write('{\n  "level": "%s", "difficulty": "%s", "stars": %s,\n  "notes": [\n' % (tid, name, chart['stars']))
            f.write(',\n'.join('    ' + json.dumps(n, separators=(', ', ': ')) for n in notes)); f.write('\n  ]\n}\n')
        kinds = {k: sum(1 for n in notes if n['k'] == k) for k in 'thzs'}
        print(f"{tid} {name}: {len(notes)} notes {kinds}, stars {chart['stars']}  [" + ' '.join(per) + ']')

if __name__ == '__main__':
    for tid in sys.argv[1:]: main(tid)
