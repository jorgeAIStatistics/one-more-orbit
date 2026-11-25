#!/usr/bin/env python3
"""Sound sketches for the opening (the owner's storyboard), to judge by ear before anything is built on them.

  python tools/opening.py     # writes tools/cache/helion-src.wav, openinga-src.wav, openingb-src.wav

  helion    Helion's signal: thump-thump, then a music box "from the bottom of an ocean" (the lullaby's first phrase,
            far off, dark, slow to arrive). 16 s.
  openinga  The opening's sound as written: a hollow wind, the heartbeat, the far music box, a bass pulse at the
            song's tempo, a single piano-like note, and at the first tap A SYNTHESISED CHORD with Heroes Tonight
            starting under it. 32 s.
  openingb  The same, but the first tap goes straight into Heroes Tonight with only a soft impact: no chord. 32 s.
Everything but the song is made here from sines and noise. The chord is a synth pad: warm, not an orchestra.
Then cut and encode like any track:  python tools/excerpt.py helion openinga openingb"""
import pathlib
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt
import lullaby as L

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = L.SR
rng = np.random.default_rng(23)
N = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
hz = lambda name: 440.0 * 2 ** ((N[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)
lowpass = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x, axis=0)
bandpass = lambda x, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x, axis=0)


def room(dry, secs, wet):
    n = int(secs * 2.6 * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / secs)[:, None]; ir[:int(0.012 * SR)] = 0
    return dry + np.stack([fftconvolve(dry[:, c], ir[:, c])[:len(dry)] for c in range(2)], axis=1) * wet


def thump(vel=1.0):
    """One beat of a heart: a low soft thud."""
    n = int(0.5 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (52 * t + 30 * (1 - np.exp(-t * 30)) / 30)) * np.exp(-t / 0.09) * vel


def wind(secs):
    n = int(secs * SR); t = np.arange(n) / SR
    x = bandpass(rng.standard_normal((n, 2)), 120, 520)
    return x * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t + 1))[:, None] * np.clip(t / 1.5, 0, 1)[:, None] * np.clip((secs - t) / 2.5, 0, 1)[:, None] * 0.05


def far_box(notes, beat):
    """The music box, far off: the same tines as the lullaby, then dark and drowned."""
    buf = np.zeros((int((sum(b for _, b in notes) * beat + 6) * SR), 2)); at = 0.0
    for name, b in notes:
        L.place(buf, at, L.tine(hz(name), b * beat, 0.9), pan=0.1); at += b * beat
    return room(lowpass(buf, 900), 1.6, 0.12) * 0.5


def pad(names, secs, bright=1.0):
    """The chord: each note a few detuned voices with a soft top, opening quickly and settling. A synth pad, plainly."""
    n = int(secs * SR); t = np.arange(n) / SR; out = np.zeros((n, 2))
    for name in names:
        f = hz(name)
        for det, pan in [(-0.35, -0.6), (0.0, 0.0), (0.4, 0.6), (0.12, -0.2)]:
            ph = 2 * np.pi * f * (1 + det / 100) * t + rng.uniform(0, 6.28); v = np.zeros(n)
            for h in range(1, 11): v += np.sin(h * ph) / h ** (1.9 - 0.5 * bright) * np.exp(-t * (0.12 * h))  # the upper partials fall away first
            out[:, 0] += v * np.sqrt(0.5 * (1 - pan)); out[:, 1] += v * np.sqrt(0.5 * (1 + pan))
    env = np.clip(t / 0.035, 0, 1) * (0.55 + 0.45 * np.exp(-t / 0.5)) * np.clip((secs - t) / (secs * 0.55), 0, 1)
    return room(out * env[:, None], 1.2, 0.05)


def song(secs, fade=2.5):
    """Heroes Tonight from the level's first beat (the excerpt's file starts one bar earlier)."""
    x, sr = sf.read(str(ROOT / 'tools/cache/heroes.wav')); assert sr == SR
    a = int(1.875 * SR); x = x[a:a + int(secs * SR)].copy()
    x[-int(fade * SR):] *= np.linspace(1, 0, int(fade * SR))[:, None]
    return x


def helion():
    out = np.zeros((int(16 * SR), 2))
    for at in (1.0, 1.32, 3.0, 3.32): L.place(out, at, thump(0.5 if at < 2 else 0.4))
    box = far_box([('C5', 1), ('Eb5', 1), ('Ab5', 2), ('F5', 2), ('Eb5', 1), ('C5', 1), ('Db5', 2), ('C5', 1), ('Bb4', 1), ('Bb4', 4)], 0.75)
    a = int(3.8 * SR); out[a:a + len(box)] += box[:len(out) - a]
    out[-int(2 * SR):] *= np.linspace(1, 0, int(2 * SR))[:, None]
    return out / np.abs(out).max() * 0.5


def opening(chord):
    total, tap, beat = 32.0, 15.75, 60 / 128
    out = np.zeros((int(total * SR), 2))
    w = wind(13.5); out[:len(w)] += w
    for at in (6.0, 6.32): L.place(out, at, thump(0.45))
    box = far_box([('C5', 1), ('Eb5', 1), ('Ab5', 2), ('F5', 2), ('Eb5', 1), ('C5', 1)], 0.75) * 0.55
    a = int(6.9 * SR); out[a:a + len(box)] += box[:len(out) - a]
    for k in range(8):  # the bass pulse, at the song's own tempo: the song will come in on its ninth beat
        L.place(out, tap - (8 - k) * beat, thump(0.5 + 0.04 * k))
    for k in (4, 6): L.place(out, tap - (8 - k) * beat, L.tine(hz('Eb5'), 1.2, 0.5), pan=0.15)  # plink
    s = song(total - tap - 0.6)
    a = int(tap * SR); out[a:a + len(s)] += s * 0.85
    if chord:
        c = pad(['Ab2', 'Eb3', 'Ab3', 'C4', 'Eb4', 'Bb4', 'C5'], 4.5) * 0.07
        out[a:a + len(c)] += c
        L.place(out, tap, np.sin(2 * np.pi * 51.9 * np.arange(int(1.2 * SR)) / SR) * np.exp(-np.arange(int(1.2 * SR)) / SR / 0.35) * 0.28)  # a low swell under it
        sh = bandpass(rng.standard_normal((int(2.5 * SR), 2)), 3000, 9000) * np.exp(-np.arange(int(2.5 * SR)) / SR / 0.6)[:, None] * 0.03; out[a:a + len(sh)] += sh  # stardust
    else:
        L.place(out, tap, thump(0.9))
    return out


if __name__ == '__main__':
    a, b = opening(True), opening(False)
    k = 0.9 / max(np.abs(a).max(), np.abs(b).max())  # one level for both, so the two can be compared fairly
    for name, x in (('helion', helion()), ('openinga', a * k), ('openingb', b * k)):
        path = ROOT / f'tools/cache/{name}-src.wav'
        sf.write(str(path), x, SR, subtype='PCM_16')
        print(f'{name}: {len(x) / SR:.1f} s, peak {np.abs(x).max():.2f}, level {20 * np.log10(np.sqrt(np.mean(x ** 2))):.1f} dB -> {path.name}')
