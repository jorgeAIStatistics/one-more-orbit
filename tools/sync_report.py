#!/usr/bin/env python3
"""Sync audit: how far are the real kick and snare hits from the beat grid?

  python tools/sync_report.py skyhigh            # audit the cut excerpt against levels/<id>/audio.json
  python tools/sync_report.py --source skyhigh   # measure tempo and bar-1 offset of the original song

Hits are detected with no tempo assumption (energy onsets, refined to the start of each transient).
Target for an excerpt: mean error under 5 ms and the same value in the first, middle and last third."""
import json, sys, pathlib
import numpy as np, soundfile as sf
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from omo_dsp import *
ROOT = pathlib.Path(__file__).resolve().parent.parent

def detect(y):
    """kick and snare hit times (transient starts), found without any tempo assumption"""
    click = np.abs(band(y, 1000, 8000)); snr_b = np.abs(band(y, 1500, 9000))
    def refine(tp, sig, back, fwd):
        s0 = int((tp - back) * SR); n = int((back + fwd) * SR)
        if s0 < 0 or s0 + n >= len(sig): return None
        e = np.convolve(sig[s0:s0 + n], np.ones(44) / 44, mode='same')
        pre = e[44:int(0.012 * SR)].mean(); pk = e.max()
        if pk < 4 * pre: return None
        return (s0 + int(np.argmax(e > pre + 0.25 * (pk - pre)))) / SR
    nl = novelty(env(band(y, hi=140), 8), 14); tk, wk = peaks(nl, 80)
    ns = novelty(env(band(y, 1500, 9000), 6), 10); ts, ws = peaks(ns, 60)
    kick = [refine(t, click, 0.045, 0.02) for t, w in zip(tk, wk) if w > 0.35 * np.percentile(wk, 95)]
    snare = [refine(t, snr_b, 0.03, 0.02) for t, w in zip(ts, ws) if w > 0.45 * np.percentile(ws, 95)]
    return np.array([t for t in kick if t is not None]), np.array([t for t in snare if t is not None])

def comb(t, bpm, sub=2, sigma=0.004):
    T = 60 / bpm / sub; best = (-1, 0)
    for p in np.arange(0, T, 0.0005):
        d = np.mod(t - p + T / 2, T) - T / 2
        s = np.exp(-(d / sigma) ** 2).mean()
        if s > best[0]: best = (s, p)
    return best

def resid(t, bpm, off, grid, tol=0.02):
    """signed distance (ms) of each hit to its nearest grid line; grid = lines per beat, or tuple of tick positions (of 12) for swing"""
    T = 60 / bpm
    if isinstance(grid, tuple):
        lines = np.array(sorted(grid)) / 12 * T
        ph = np.mod(t - off, T); d = ph[:, None] - np.concatenate([lines, [T]])[None, :]
        r = d[np.arange(len(t)), np.argmin(np.abs(d), 1)]
    else:
        g = T / grid; r = np.mod(t - off + g / 2, g) - g / 2
    m = np.abs(r) < tol
    return t[m], r[m] * 1000, m.mean()

def report(name, t, bpm, off, grid, t0=None, t1=None):
    if t0 is not None: t = t[(t >= t0) & (t < t1)]
    tt, r, frac = resid(t, bpm, off, grid)
    if len(r) < 8: print(f"    {name}: too few sharp hits ({len(r)})"); return
    sl = np.polyfit(tt / 60, r, 1)[0]
    th = np.array_split(np.argsort(tt), 3)
    print(f"    {name}: n={len(r)} ({frac*100:.0f}% of detected hits within 20 ms of a grid line)  mean {r.mean():+.1f} ms  median {np.median(r):+.1f}  sd {r.std():.1f}  "
          f"thirds {' / '.join(f'{r[i].mean():+.1f}' for i in th)}  trend {sl:+.2f} ms/min")

def main(argv):
    source = '--source' in argv; ids = [a for a in argv if not a.startswith('--')]
    cfg = json.load(open(ROOT / 'tools/tracks.json'))
    for tid in ids:
        t = cfg['tracks'][tid]
        if source:
            y, sr = sf.read(str((ROOT / cfg['sourceDir'] / t['source']).resolve()), dtype='float64', always_2d=True); bpm = t['bpm']; off = None
        else:
            a = json.load(open(ROOT / f'levels/{tid}/audio.json')); y, sr = sf.read(str(ROOT / f'tools/cache/{tid}.wav'), dtype='float64', always_2d=True); bpm = a['bpm']; off = a['offset']
        y = y.mean(1); kick, snare = detect(y); allh = np.sort(np.concatenate([kick, snare]))
        print(f"== {tid} ({'source song' if source else 'excerpt'}): {len(kick)} kick + {len(snare)} snare/clap transients")
        scan = sorted(((comb(allh, b)[0], b) for b in np.arange(bpm - 2, bpm + 2.001, 0.01)), reverse=True)
        score, ph = comb(allh, bpm)
        print(f"    tempo scan {bpm-2}-{bpm+2} in 0.01 steps: best {scan[0][1]:.2f} BPM (score {scan[0][0]:.3f}; at {bpm}: {score:.3f})")
        T = 60 / bpm
        if off is None:
            off = ph; print(f"    beat phase {ph*1000:.1f} ms (bar 1 is this plus a whole number of beats; first sound at {np.argmax(np.abs(y) > 0.02)/SR*1000:.1f} ms)")
        else:
            print(f"    free phase fit is {(np.mod(ph - off + T/4, T/2) - T/4)*1000:+.1f} ms from the grid in audio.json")
        grid = tuple(t['ticks']) if 'ticks' in t else 2
        report('kick  vs grid', kick, bpm, off, grid); report('snare vs grid', snare, bpm, off, grid)

if __name__ == '__main__':
    main(sys.argv[1:])
