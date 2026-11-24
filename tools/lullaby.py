#!/usr/bin/env python3
"""The Lantern's lullaby: the prologue's song, the ending's song, and "the quietest song there is".

  python tools/lullaby.py            # writes tools/cache/lullaby-a-src.wav and lullaby-b-src.wav

Original music, written for this game and synthesised here from nothing but sines and noise, so there is no
sample and no licence in it. 80 BPM, 4/4, D major: one bar of four taps (Marlow counting), then 24 bars.
Two voicings of the same tune, to choose between by ear:
  a  a music box over a low hum (the lamp)
  b  a breathy pipe over the same hum, with the music box only rocking underneath
The notes are also printed as beats, so a chart can be written from them by hand.
Then cut and encode like any track:  python tools/excerpt.py lullaby lullabyb"""
import pathlib, sys, json
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 44100
BPM = 80
BEAT = 60 / BPM
N = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
hz = lambda name: 440.0 * 2 ** ((N[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)

# The tune: bar by bar, (note, beats). Bars count from 1; bar 0 is the four taps.
TUNE = [
    [('F#4', 1), ('A4', 1), ('D5', 2)], [('B4', 2), ('A4', 1), ('F#4', 1)], [('G4', 2), ('F#4', 1), ('E4', 1)], [('E4', 4)],          # A: a question
    [('F#4', 1), ('A4', 1), ('D5', 2)], [('B4', 2), ('D5', 1), ('E5', 1)], [('D5', 2), ('B4', 1), ('A4', 1)], [('A4', 4)],            # A again, left open
    [('B4', 1), ('D5', 1), ('E5', 1), ('D5', 1)], [('A4', 2), ('F#4', 2)], [('G4', 1), ('B4', 1), ('E5', 2)], [('C#5', 2), ('A4', 2)],  # B: it wanders
    [('F#4', 1), ('A4', 1), ('D5', 2)], [('B4', 2), ('A4', 1), ('F#4', 1)], [('G4', 1), ('B4', 1), ('A4', 1), ('E4', 1)], [('D4', 4)],  # A: and comes home
    [('F#4', 1), ('A4', 1), ('D5', 1), ('E5', .5), ('D5', .5)], [('B4', 2), ('A4', 1), ('F#4', 1)], [('G4', 2), ('F#4', 1), ('E4', 1)], [('E4', 2), ('A4', 2)],
    [('F#4', 1), ('A4', 1), ('D5', 2)], [('B4', 2), ('A4', 1), ('F#4', 1)], [('G4', 1), ('B4', 1), ('A4', 1), ('E4', 1)], [('D4', 4)],
]
# The harmony under each bar: (root, third, fifth), low
CH = {'D': ('D3', 'F#3', 'A3'), 'Bm': ('B2', 'D3', 'F#3'), 'G': ('G2', 'B2', 'D3'), 'A': ('A2', 'C#3', 'E3'), 'Em': ('E3', 'G3', 'B3')}
CHORDS = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D', 'G', 'D', 'Em', 'A', 'D', 'Bm', 'G', 'D', 'D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D']
BARS = 1 + len(TUNE)
TAIL = 4.0  # seconds for the last chord to ring out
rng = np.random.default_rng(7)


def place(buf, t, sig, pan=0.0):
    i = int(round(t * SR))
    if i >= len(buf): return
    sig = sig[:len(buf) - i]
    buf[i:i + len(sig), 0] += sig * np.sqrt(0.5 * (1 - pan))
    buf[i:i + len(sig), 1] += sig * np.sqrt(0.5 * (1 + pan))


def tine(f, dur, vel=1.0):
    """A music-box tine: a few partials, the upper ones a little sharp and quick to die, a soft click on the strike."""
    n = int((dur + 2.6) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for k, (mult, amp, tau) in enumerate([(1.0, 1.0, 1.5), (2.0, 0.32, 0.9), (3.01, 0.12, 0.5), (5.43, 0.05, 0.22)]):
        out += amp * np.exp(-t / (tau * (0.75 + 0.25 * min(1, 440 / f)))) * np.sin(2 * np.pi * f * mult * t + k)
    click = rng.standard_normal(int(0.006 * SR)) * np.linspace(1, 0, int(0.006 * SR)) ** 2 * 0.08
    out[:len(click)] += click
    out[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return out * vel * 0.5


def pipe(f, dur, vel=1.0):
    """A breathy pipe: a slow attack, a little vibrato once the note has settled, and air."""
    n = int((dur + 0.5) * SR); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 4.8 * t) * np.clip((t - 0.25) / 0.4, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    air = np.convolve(rng.standard_normal(n), np.ones(24) / 24, mode='same') * 0.06
    env = np.clip(t / 0.09, 0, 1) * np.clip((dur + 0.5 - t) / 0.5, 0, 1) * (0.85 + 0.15 * np.exp(-t / 0.6))
    return (tone + air) * env * vel * 0.5


def hum(chord, dur):
    """The lamp: a low, slow chord of pure tones, breathing very slightly."""
    n = int((dur + 1.6) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for name, amp in zip(chord, (1.0, 0.6, 0.75)):
        f = hz(name)
        for det in (-0.6, 0.7):
            out += amp * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6.28))
        out += 0.12 * amp * np.sin(2 * np.pi * 2 * f * t)
    env = np.clip(t / 0.9, 0, 1) * np.clip((dur + 1.6 - t) / 1.5, 0, 1)
    return out * env * (1 + 0.06 * np.sin(2 * np.pi * 0.21 * t)) * 0.045


def tap(vel=1.0):
    """One of Marlow's four taps: a small knock on glass."""
    n = int(0.25 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1240 * t) * np.exp(-t / 0.02) + 0.5 * np.sin(2 * np.pi * 2710 * t) * np.exp(-t / 0.012) + rng.standard_normal(n) * np.exp(-t / 0.004) * 0.3) * vel * 0.2


def render(voicing):
    total = BARS * 4 * BEAT + TAIL
    dry = np.zeros((int(total * SR), 2))
    notes = []  # (beat, name): the melody, for charts
    for k in range(4): place(dry, k * BEAT, tap(0.9 if k == 0 else 0.7), pan=-0.25)
    for b, bar in enumerate(TUNE):
        t0 = (b + 1) * 4 * BEAT
        chord = CH[CHORDS[b]]
        place(dry, t0, hum(chord, 4 * BEAT))
        # the left hand rocks: root, fifth, third, fifth, a quarter each, quiet
        for q, name in enumerate((chord[0], chord[2], chord[1], chord[2])):
            up = name[:-1] + str(int(name[-1]) + 1)
            place(dry, t0 + q * BEAT, tine(hz(up), BEAT, 0.34 if voicing == 'a' else 0.26), pan=-0.3 + 0.12 * q)
        at = 0.0
        for name, beats in bar:
            vel = 1.0 if at == 0 else 0.86
            if voicing == 'a': place(dry, t0 + at * BEAT, tine(hz(name), beats * BEAT, vel), pan=0.18)
            else: place(dry, t0 + at * BEAT, pipe(hz(name), beats * BEAT, vel), pan=0.12)
            notes.append((round((b + 1) * 4 + at, 3), name))
            at += beats
    # the last chord, rung once more and left to die away
    for name in ('D4', 'A4', 'F#5'): place(dry, BARS * 4 * BEAT, tine(hz(name), 2.0, 0.5), pan=0.1)
    # a small room: a second and a half of decaying noise
    n = int(1.6 * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.42)[:, None]; ir[:int(0.012 * SR)] = 0
    wet = np.stack([fftconvolve(dry[:, c], ir[:, c])[:len(dry)] for c in range(2)], axis=1)
    out = dry + wet * (0.016 if voicing == 'a' else 0.022)
    out /= np.abs(out).max() / 0.7
    return out, notes


if __name__ == '__main__':
    (ROOT / 'tools/cache').mkdir(exist_ok=True)
    for v in ('a', 'b'):
        out, notes = render(v)
        path = ROOT / f'tools/cache/lullaby-{v}-src.wav'
        sf.write(str(path), out, SR, subtype='PCM_16')
        rms = 20 * np.log10(np.sqrt(np.mean(out ** 2)))
        print(f'lullaby {v}: {len(out) / SR:.1f} s, peak {np.abs(out).max():.2f}, level {rms:.1f} dB, {len(notes)} melody notes -> {path.name}')
    json.dump({'bpm': BPM, 'bars': BARS, 'notes': notes, 'chords': CHORDS}, open(ROOT / 'tools/cache/lullaby.notes.json', 'w'))
