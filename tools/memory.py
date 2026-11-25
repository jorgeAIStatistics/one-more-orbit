#!/usr/bin/env python3
"""A memory of Helion: his theme, heard clearly for once.

  python tools/memory.py            # writes tools/cache/memory1-src.wav

The music box Orbin hears "from the bottom of an ocean" in the present is this tune, far off and dark. In a memory
it is close and whole: the first eight bars of the music-box theme (tools/lullaby.py, voicing a), with a heartbeat
where the old counting taps were, and the home chord rung at the end. 80 BPM, D major. Bar 0 is the heartbeat; the
level is bars 1 to 8, and a ninth bar lets the last chord ring.
Then cut and encode like any track:  python tools/excerpt.py memory1"""
import pathlib
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve
import lullaby as L

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR, BEAT = L.SR, L.BEAT
rng = np.random.default_rng(31)


def thump(vel=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (52 * t + 30 * (1 - np.exp(-t * 30)) / 30)) * np.exp(-t / 0.09) * vel


def render():
    bars = 8
    total = (bars + 2) * 4 * BEAT + 2.0
    dry = np.zeros((int(total * SR), 2))
    for at, v in ((0.0, 0.5), (0.32, 0.5), (1.5, 0.42), (1.82, 0.42)): L.place(dry, at, thump(v))  # thump-thump: his, and close now
    for b in range(bars):
        t0 = (b + 1) * 4 * BEAT
        chord = L.CH[L.CHORDS[b]]
        L.place(dry, t0, L.hum(chord, 4 * BEAT))
        for q, name in enumerate((chord[0], chord[2], chord[1], chord[2])):  # the left hand rocks
            up = name[:-1] + str(int(name[-1]) + 1)
            L.place(dry, t0 + q * BEAT, L.tine(L.hz(up), BEAT, 0.34), pan=-0.3 + 0.12 * q)
        at = 0.0
        for name, beats in L.TUNE[b]:
            L.place(dry, t0 + at * BEAT, L.tine(L.hz(name), beats * BEAT, 1.0 if at == 0 else 0.86), pan=0.18)
            at += beats
    t9 = (bars + 1) * 4 * BEAT
    L.place(dry, t9, L.hum(L.CH['D'], 4 * BEAT))
    for name in ('D4', 'A4', 'F#5'): L.place(dry, t9, L.tine(L.hz(name), 2.0, 0.6), pan=0.1)  # home
    n = int(1.6 * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.42)[:, None]; ir[:int(0.012 * SR)] = 0
    wet = np.stack([fftconvolve(dry[:, c], ir[:, c])[:len(dry)] for c in range(2)], axis=1)
    out = dry + wet * 0.02
    return out / (np.abs(out).max() / 0.7)


if __name__ == '__main__':
    out = render()
    path = ROOT / 'tools/cache/memory1-src.wav'
    sf.write(str(path), out, SR, subtype='PCM_16')
    print(f'memory1: {len(out) / SR:.1f} s, peak {np.abs(out).max():.2f}, level {20 * np.log10(np.sqrt(np.mean(out ** 2))):.1f} dB -> {path.name}')
