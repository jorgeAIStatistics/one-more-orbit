#!/usr/bin/env python3
"""A journey level's layout and hand bars, from its spec in tools/journeys.py (the owner's brief of 2026-11-26).

    tools/.venv/bin/python tools/journey.py <folder> [--write]
    then: tools/.venv/bin/python tools/chart.py <folder>

Each bar of the spec says its words (the same bar words as level.json: up, sat, mini, pad, vent, hold, x1.5, leap2@2 ...)
and how many taps it has. The taps are picked on the strongest measured sound (kick, snare or lead, from
tools/cache/<folder>.features.npz; 12 ticks a beat, 48 a bar), inside the level's table:
  floor  the shortest gap anywhere (s)
  dbl    gaps under this (s) are doubles: allowed only alone (the gap before and after them at least dbl)
  run    the longest run of quick taps (each under 0.45 s after the one before)
A leap's launch is on its bar beat (leapN@b); `e` taps are placed inside its flight (embers, taps in the air); nothing
in the beat after it lands. Patterns are not repeated from the last four bars where the music allows.
Without --write it only prints the bars it would write.
"""
import itertools, json, pathlib, re, sys
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from journeys import SPECS  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
QUICK = 0.45


def leap_of(words):
    for w in words.split('+'):
        m = re.fullmatch(r'leap(\d)?(?:@(\d))?', w)
        if m: return (int(m.group(1) or 4), int(m.group(2) or 0))
    return None


def build(folder, write):
    S = SPECS[folder]
    F = dict(np.load(ROOT / f'tools/cache/{folder}.features.npz'))
    bpm = float(F['bpm']) if 'bpm' in F else S['bpm']
    spb = 60 / S.get('bpm', bpm)
    tick_s = spb / 12
    nb = len(F['kick']) // 48
    T = S['table']
    grid = [t for t in range(48) if t % T.get('step', 3) == 0]

    def strength(b, t):
        if b >= nb: return 0
        i = b * 48 + t
        return max(F['kick'][i], F['snare'][i], 1.35 * F['lead'][i]) + (0.2 if t % 12 == 0 else 0) + (0.15 if t == 0 else 0)

    rows = [(sid, label, lap, look, flags, enter, r) for (sid, label, lap, look, flags, enter, rs) in S['sections'] for r in [rs]]
    bars = []  # (section index, words, n, opts)
    for si, sec in enumerate(S['sections']):
        for r in sec[6]:
            words, n = r[0], r[1]
            opts = r[2] if len(r) > 2 else {}
            bars.append((si, words, n, opts))
    # forced taps, flights, graces
    forced, flights, graces = {}, [], []
    for b, (si, words, n, opts) in enumerate(bars):
        if opts.get('down') or any(w in ('pad', 'vent', 'throw') for w in words.split('+')): forced[b * 48] = 'down'
        for t in opts.get('fixed', []): forced[b * 48 + t] = 'fixed'
        lp = leap_of(words)
        if lp:
            F_, off = lp
            t0 = b * 48 + off * 12
            forced[t0] = 'launch'
            flights.append((t0, t0 + F_ * 12, opts.get('e', 1)))
            graces.append((t0 + F_ * 12, t0 + F_ * 12 + 12))
    taken = []  # absolute ticks chosen so far (sorted)

    def ok_seq(seq):
        """the table, over a whole sorted list of absolute ticks"""
        gaps = [(seq[i] - seq[i - 1]) * tick_s for i in range(1, len(seq))]
        for i, g in enumerate(gaps):
            if g < T['floor'] - 1e-6: return False
            if g < T['dbl'] - 1e-6 and ((i > 0 and gaps[i - 1] < T['dbl'] - 1e-6) or (i + 1 < len(gaps) and gaps[i + 1] < T['dbl'] - 1e-6)): return False
        run = 1
        for g in gaps:
            run = run + 1 if g < QUICK - 1e-6 else 1
            if run > T['run']: return False
        return True

    hist = []
    out_bars = {}
    for b, (si, words, n, opts) in enumerate(bars):
        lo, hi = b * 48, b * 48 + 48
        fixed = [t for t in forced if lo <= t < hi]
        if 'fixed' in opts:
            ts = [lo + t for t in opts['fixed']]
        else:
            # embers for the flights that start in this bar (inside the flight, not in its last quarter beat)
            ember = []
            for (f0, f1, e) in flights:
                if lo <= f0 < hi and e:
                    cand = [t for t in range(f0 + 3, f1 - 2) if (t - f0) % T.get('step', 3) == 0]
                    best = None
                    for combo in itertools.combinations(cand, e):
                        seq = sorted(taken[-3:] + [f0] + list(combo))
                        if not ok_seq(seq): continue
                        sc = sum(strength(t // 48, t % 48) for t in combo)
                        if best is None or sc > best[0]: best = (sc, list(combo))
                    if best is None: raise SystemExit(f'{folder}: no embers for the flight at bar {b}')
                    ember += best[1]
            blocked = lambda t: any(g0 <= t < g1 for g0, g1 in graces) or any(f0 < t < f1 for f0, f1, _ in flights)
            cand = [lo + t for t in grid if not blocked(lo + t) and lo + t not in fixed]
            want = max(0, n - len(fixed) - len(ember))
            best = None
            for combo in itertools.combinations(cand, want):
                seq = sorted(taken[-4:] + fixed + ember + list(combo) + [t for t in forced if hi <= t < hi + 48])
                if not ok_seq(seq): continue
                rel = [t - lo for t in combo]
                sc = sum(strength(b, t) for t in rel)
                if len(hist) >= 2 and hist[-1] == hist[-2] == rel: sc -= 99
                sc -= 0.6 * sum(1 for h in hist[-4:] if h == rel)
                sc -= 0.25 * sum(1 for h in hist[:-4] if h == rel)
                if best is None or sc > best[0]: best = (sc, list(combo))
            if best is None: raise SystemExit(f'{folder}: no pattern for bar {b} ({words}, {n} taps) within the table; before it {[ (t - lo) for t in taken[-4:]]}, fixed {[t - lo for t in fixed]}')
            ts = sorted(fixed + ember + best[1])
            hist.append([t - lo for t in best[1]])
        taken = sorted(taken + ts)
        out_bars[b] = [t - lo for t in ts]
    if not ok_seq(taken):
        for i in range(2, len(taken) + 1):
            if not ok_seq(taken[max(0, i - 6):i]): print(f'!! the table breaks at bar {taken[i - 1] // 48} tick {taken[i - 1] % 48} (after {[(t // 48, t % 48) for t in taken[max(0, i - 6):i - 1]]})'); break
    # report
    for b, (si, words, n, opts) in enumerate(bars):
        print(f'{folder} bar {b:2d} {S["sections"][si][0]:7s} {words:22s} {out_bars[b]}')
    gaps = [(taken[i] - taken[i - 1]) * tick_s for i in range(1, len(taken))]
    print(f'{folder}: {len(taken)} taps over {len(bars)} bars; shortest gap {min(gaps):.3f} s; audio bars {nb}')
    if not write: return
    # level.json: the head, the places, the set pieces, the segments with each bar's plan
    segs = []
    b = 0
    for (sid, label, lap, look, flags, enter, rs) in S['sections']:
        words, plans = [], []
        for r in rs:
            words.append(r[0]); p = ['.'] * 16
            for t in out_bars[b]: p[t // 3] = 'x'
            plans.append('L=@' + ''.join(p)); b += 1
        seg = {"id": sid, "core": {"bars": words, **flags}, "bars": len(rs), "label": label, "lap": lap, "follow": S.get('follow', 'snare'), "lead": "snare"}
        if enter: seg["enter"] = enter
        seg["look"] = S['looks'][look]; seg["plan"] = plans
        segs.append(seg)
    H = S['head']
    head = {"_doc": [S['doc'], 'Every bar is charted by hand (tools/journey.py from tools/journeys.py, then hand-tuned if need be). The id is the world\'s slot, not the song.', f'then re-run: python tools/chart.py {folder}'], **H}
    lines = ['{'] + [f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},' for k, v in head.items()]
    for key, arr in (('setpieces', S['setpieces']), ('places', S['places']), ('segments', segs)):
        lines.append(f'  "{key}": [')
        lines += ['    ' + json.dumps(x, ensure_ascii=False) + (',' if i < len(arr) - 1 else '') for i, x in enumerate(arr)]
        lines.append('  ]' + (',' if key != 'segments' else ''))
    lines.append('}')
    txt = '\n'.join(lines) + '\n'
    json.loads(txt)
    (ROOT / f'levels/{folder}/level.json').write_text(txt)
    pres = {'_doc': 'Notes by hand (tools/journey.py). Per bar: t = survival presses, as ticks inside the bar (12 per beat).', 'bars': {str(k): {'by': 'hand', 't': v} for k, v in out_bars.items()}}
    (ROOT / f'levels/{folder}/presses.json').write_text(json.dumps(pres, indent=1) + '\n')
    print('written', folder)


if __name__ == '__main__':
    build(sys.argv[1], '--write' in sys.argv)
