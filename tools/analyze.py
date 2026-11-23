#!/usr/bin/env python3
"""Measure what can be heard at every grid position of an excerpt.

  python tools/analyze.py skyhigh

Reads tools/cache/<id>.wav + levels/<id>/audio.json, writes tools/cache/<id>.features.npz with one value per
tick (12 ticks per beat, so 16ths are every 3rd tick and swung 16ths sit on ticks 4 and 10):
  kick, snare, lead, full  onset strength (0..1.5, 1 = a strong hit)    lowdb, harmdb  sustained level in dB"""
import json, sys, pathlib
import numpy as np, soundfile as sf, librosa
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from omo_dsp import SR, ER, band, env, novelty
ROOT = pathlib.Path(__file__).resolve().parent.parent

def main(tid):
    a = json.load(open(ROOT / f'levels/{tid}/audio.json'))
    st, _ = sf.read(str(ROOT / f'tools/cache/{tid}.wav'), dtype='float64', always_2d=True); y = st.mean(1)
    T = 60 / a['bpm']; tk = T / 12; off = a['offset']; dur = len(y) / SR
    y22 = librosa.resample(y.astype(np.float32), orig_sr=SR, target_sr=22050)
    yh = librosa.resample(librosa.effects.harmonic(y22, margin=3.0), orig_sr=22050, target_sr=SR).astype(np.float64)[:len(y)]
    yl = band(y, hi=140); ym = band(yh, 400, 5000)
    lay = {'kick': novelty(env(yl, 8), 14), 'snare': novelty(env(band(y, 1500, 9000), 6), 10), 'lead': novelty(env(ym, 8), 14), 'full': novelty(env(band(y, lo=40), 6), 10)}
    nt = int((dur - off) / tk); win = min(0.03, tk * 0.45); out = {}
    for n, v in lay.items():
        v = v / (np.percentile(v, 99.5) + 1e-9); o = np.zeros(nt)
        for i in range(nt):
            t = off + i * tk; s0 = int((t - win) * ER); s1 = int((t + win) * ER) + 1
            if s1 > 0 and s0 < len(v): o[i] = v[max(s0, 0):s1].max()
        out[n] = np.minimum(o, 1.5)
    for n, sig in (('lowdb', yl), ('harmdb', ym)):
        e = env(sig, 8); ref = np.percentile(e, 98) + 1e-12; o = np.full(nt, -80.0)
        for i in range(nt):
            s0 = int((off + i * tk) * ER); s1 = int((off + (i + 1) * tk) * ER)
            if s1 > 0 and s0 < len(e): o[i] = 10 * np.log10(e[max(s0, 0):max(s1, s0 + 1)].mean() / ref + 1e-8)
        out[n] = o
    np.savez(ROOT / f'tools/cache/{tid}.features.npz', bpm=a['bpm'], **out)
    print(tid, 'ticks', nt, 'bars', nt / 48)

if __name__ == '__main__':
    for tid in sys.argv[1:]: main(tid)
