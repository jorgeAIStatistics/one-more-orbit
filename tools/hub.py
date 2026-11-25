#!/usr/bin/env python3
"""The Lantern's own theme: what the hub hums while you are at home in it.

  python tools/hub.py            # writes tools/cache/hub0-src.wav and hub1-src.wav

Original music, built on the lullaby's harmony (D major, 80 BPM), synthesised from sines and noise like the lullaby.
It gains a voice with each planet restored. So far:
  hub0  nothing restored: the lamp's low drone, and four faint taps from far up (Marlow, under glass)
  hub1  Emberwick home: Ossa's voice joins, struck metal, low, one slow note a bar
Each is an eight-bar loop (24 s). Nine bars are written: the ninth is the first again, so the loop's seam has the
ring of the bar before it under it. Then cut and encode like any track:  python tools/excerpt.py hub0 hub1"""
import pathlib
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve
import lullaby as L

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR, BEAT = L.SR, L.BEAT
BAR = 4 * BEAT
CHORDS = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D']
# Ossa's line: the lullaby's first phrase, far down and very slow (one note a bar)
OSSA = ['F#2', 'B2', 'G2', 'E2', 'F#2', 'B2', 'G2', 'D2']
rng = np.random.default_rng(11)


def anvil(f, vel=1.0):
    """Struck metal, low: a bar's uneven partials, a hard edge on the strike, a long ring."""
    n = int(4.2 * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for mult, amp, tau in [(1.0, 1.0, 1.9), (2.76, 0.42, 1.1), (5.4, 0.2, 0.6), (8.93, 0.08, 0.3)]:
        out += amp * np.exp(-t / tau) * np.sin(2 * np.pi * f * mult * t + rng.uniform(0, 6.28))
    strike = rng.standard_normal(int(0.012 * SR)) * np.linspace(1, 0, int(0.012 * SR)) ** 2 * 0.25
    out[:len(strike)] += strike
    out[:int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return out * vel * 0.34


def render(voices):
    cycles = 2  # two turns of the loop are written, and the second is kept: it has the first one's ring under it
    total = (8 * cycles + 1) * BAR + 5.0
    dry = np.zeros((int(total * SR), 2))
    for cyc in range(cycles + 1):
        for b in range(8 if cyc < cycles else 1):
            t0 = (cyc * 8 + b) * BAR
            L.rng = np.random.default_rng(100 + b)  # every turn of the loop is the same turn, so its seam cannot be heard
            global rng
            rng = np.random.default_rng(200 + b)
            L.place(dry, t0, L.hum(L.CH[CHORDS[b]], BAR) * 1.5)
            if b in (0, 4):  # four faint taps, far up
                for k in range(4): L.place(dry, t0 + k * BEAT, L.tap(0.22 if k == 0 else 0.16), pan=0.35)
            if voices >= 1:
                L.place(dry, t0, anvil(L.hz(OSSA[b]), 0.9 if b % 4 == 0 else 0.7), pan=-0.3)
    n = int(2.2 * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.6)[:, None]; ir[:int(0.012 * SR)] = 0
    wet = np.stack([fftconvolve(dry[:, c], ir[:, c])[:len(dry)] for c in range(2)], axis=1)
    out = dry + wet * 0.03
    a = int(8 * BAR * SR)
    out = out[a:a + int(9 * BAR * SR) + int(1.0 * SR)]
    out /= np.abs(out).max() / 0.42  # quiet: this is the room's own hum, under everything
    return out


if __name__ == '__main__':
    (ROOT / 'tools/cache').mkdir(exist_ok=True)
    for v in (0, 1):
        out = render(v)
        path = ROOT / f'tools/cache/hub{v}-src.wav'
        sf.write(str(path), out, SR, subtype='PCM_16')
        seam = np.abs(out[:int(0.5 * SR)] - out[int(8 * BAR * SR):int(8 * BAR * SR) + int(0.5 * SR)]).max()
        print(f'hub{v}: {len(out) / SR:.1f} s, peak {np.abs(out).max():.2f}, level {20 * np.log10(np.sqrt(np.mean(out ** 2))):.1f} dB, loop seam difference {seam:.4f} -> {path.name}')
