#!/usr/bin/env python3
"""Sound written for the first ten minutes (the next pass, step 2). Everything here is synthesised from sines and
noise, as the lullaby is, except the storyboard's bed, which is cut from the first stage's own song.

  python tools/pass2.py            # writes the -src.wav files below into tools/cache/

  nebula      The cold open (51 s, 80 BPM, A flat major: Helion's theme, in the key that sits with Memory Box's
              F minor). Bar 0 a heartbeat; bars 1-8 the theme, whole and warm; bars 9-12 the Stillness: the tune
              comes late, sinks, dulls and loses notes while a soft beat keeps Orbin's time; bar 13 the dark; bars
              14-15 one held note; bar 16 the shockwave, then nothing.
  opening     The storyboard's own pieces, retuned to the first stage's song (F sharp major, 150 BPM, felt at 75):
               0.0  wind, a heartbeat, the far music box losing its last note (22 s; laid over the song's quiet opening)
              24.0  the pulse: four beats, 0.8 s apart, made to go round (3.2 s)
              30.0  the note: one struck note on the first and third of them, made to go round (3.2 s)
              36.0  the chord for the first tap (5 s)
  startedbed  The first stage's song from its first second to where its drums come in (bars 1-16, 25.6 s), made so
              that its last eight bars go round until the tap comes.
  sting1/2    The star collection, for the first stage (F sharp major) and Emberwick (A major, Volcano's relative):
               0.0  the catch: a warm chord, a rising flourish of Helion's theme on the music box, stardust (3.4 s)
               4.0  the star rising: a soft lift of air and glass (1.6 s)
               6.0  the star taking its place at the Landing: two tines, a fifth apart (2.5 s)
  fire0/1     The Landing at rest: fire crackle, night air, a low hum and the music box far off, playing the theme's
              first question. fire0 is an ember (first visit); fire1 a small fire (a star or more home). 24 s loops.
Then cut and encode like any track:  python tools/excerpt.py nebula opening startedbed sting1 sting2 fire0 fire1"""
import json, pathlib
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt
import lullaby as L
import opening as O

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR, BEAT = L.SR, L.BEAT
BAR = 4 * BEAT
rng = np.random.default_rng(57)
UP, DOWN = 2 ** (6 / 12), 2 ** (-6 / 12)   # D major -> A flat major: the tune goes up, the harmony down
lowpass = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x, axis=0)
bandpass = lambda x, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x, axis=0)
NAMES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
hz = lambda name: 440.0 * 2 ** ((NAMES[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)
level = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
O.N.update(NAMES)  # (the opening's own table knows flats only)


def room(dry, secs=0.42, wet=0.02):
    n = int(secs * 3.8 * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / secs)[:, None]; ir[:int(0.012 * SR)] = 0
    return dry + np.stack([fftconvolve(dry[:, c], ir[:, c])[:len(dry)] for c in range(2)], axis=1) * wet


def hum(chord, dur, k=DOWN):
    """lullaby's hum, transposed"""
    n = int((dur + 1.6) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for name, amp in zip(chord, (1.0, 0.6, 0.75)):
        f = L.hz(name) * k
        for det in (-0.6, 0.7): out += amp * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6.28))
        out += 0.12 * amp * np.sin(2 * np.pi * 2 * f * t)
    env = np.clip(t / 0.9, 0, 1) * np.clip((dur + 1.6 - t) / 1.5, 0, 1)
    return out * env * (1 + 0.06 * np.sin(2 * np.pi * 0.21 * t)) * 0.045


def theme_bar(dry, t0, b, vel=1.0, left=True, humming=True):
    """One bar of the theme as a memory hears it: the hum, the rocking left hand, the tune."""
    chord = L.CH[L.CHORDS[b]]
    if humming: L.place(dry, t0, hum(chord, BAR) * vel)
    if left:
        for q, name in enumerate((chord[0], chord[2], chord[1], chord[2])):
            up = name[:-1] + str(int(name[-1]) + 1)
            L.place(dry, t0 + q * BEAT, L.tine(L.hz(up) * DOWN * 2, BEAT, 0.3 * vel), pan=-0.3 + 0.12 * q)
    at = 0.0
    for name, beats in L.TUNE[b]:
        L.place(dry, t0 + at * BEAT, L.tine(L.hz(name) * UP, beats * BEAT, (1.0 if at == 0 else 0.86) * vel), pan=0.18)
        at += beats


def nebula():
    total = 17 * BAR + 1.0
    dry = np.zeros((int(total * SR), 2))
    for at, v in ((0.0, 0.5), (0.32, 0.5), (1.5, 0.42), (1.82, 0.42)): L.place(dry, at, O.thump(v))
    for b in range(8): theme_bar(dry, (b + 1) * BAR, b)
    # a soft beat under it from the third bar (where the brothers are on their orbit): Orbin's time. It never wavers.
    for bar in range(3, 13):
        for q in (0, 2): L.place(dry, bar * BAR + q * BEAT, O.thump(0.3 if bar < 9 else 0.34))
    # the Stillness: the tune again (its last, homeward phrase), and it does not get home
    late = [0.04, 0.10, 0.18, 0.30]; cents = [-8, -22, -42, -70]; keep = [9, 3, 2, 2]; cut = [2600, 1700, 1100, 700]; vel = [0.9, 0.75, 0.55, 0.4]
    for k in range(4):
        b = 12 + k; t0 = (9 + k) * BAR; part = np.zeros((int((BAR + 4) * SR), 2))
        chord = L.CH[L.CHORDS[b]]
        if k < 2: L.place(part, 0, hum(chord, BAR) * (1 - 0.45 * k))
        if k == 0:
            for q, name in enumerate((chord[0], chord[2], chord[1], chord[2])):
                L.place(part, q * BEAT, L.tine(L.hz(name[:-1] + str(int(name[-1]) + 1)) * DOWN * 2, BEAT, 0.26), pan=-0.3 + 0.12 * q)
        at = 0.0
        for i, (name, beats) in enumerate(L.TUNE[b]):
            if i < keep[k]:
                f = L.hz(name) * UP * 2 ** (cents[k] / 1200 * (0.6 + 0.4 * i / 3))
                L.place(part, at * BEAT * (1 + 0.5 * late[k]) + late[k] * (0.5 + i * 0.5), L.tine(f, beats * BEAT, vel[k]), pan=0.18 - 0.1 * k)
            at += beats
        part = lowpass(part, cut[k])
        a = int(t0 * SR); dry[a:a + len(part)] += part[:len(dry) - a]
    # the dark: a low breath that comes up under everything and closes
    n = int(8.5 * SR); t = np.arange(n) / SR
    dark = bandpass(rng.standard_normal((n, 2)), 45, 170) * (np.clip(t / 6.0, 0, 1) ** 2 * np.clip((8.5 - t) / 2.2, 0, 1))[:, None] * 0.11
    a = int(11.6 * BAR * SR); dry[a:a + n] += dark
    L.place(dry, 13 * BAR, O.thump(0.3))  # one more beat of his own heart, alone
    # one held note: the fifth, thin, with nothing under it
    held = L.pipe(hz('D#5'), 5.2, 0.34); held *= np.clip((5.7 - np.arange(len(held)) / SR) / 3.0, 0, 1)
    L.place(dry, 14 * BAR, held, pan=0.2)
    L.place(dry, 14 * BAR, L.tine(hz('D#5'), 3.0, 0.5), pan=0.2)
    out = room(dry, 0.42, 0.02)
    out /= np.abs(out).max() / 0.6
    # the shockwave: air rushing in, then one great blow, low, and its dust; then nothing at all
    t16 = 16 * BAR
    n = int(1.4 * SR); t = np.arange(n) / SR
    rush = bandpass(rng.standard_normal((n, 2)), 300, 5000) * ((t / 1.4) ** 3)[:, None] * 0.16
    a = int((t16 - 1.4) * SR); out[a:a + n] += rush
    n = int(2.6 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (34 * t + 60 * (1 - np.exp(-t * 9)) / 9)) * np.exp(-t / 0.55) * 0.8
    dust = lowpass(rng.standard_normal((n, 2)), 2600) * np.exp(-t / 0.3)[:, None] * 0.3
    a = int(t16 * SR); out[a:a + n, 0] += boom; out[a:a + n, 1] += boom; out[a:a + n] += dust
    out[int((t16 + 2.3) * SR):] = 0
    return np.clip(out, -0.97, 0.97)


def coldopen():
    """The cold open as a scene (the owner's brief of 2026-11-25), 46 s, no beat to tap to:
       0-12   calm: Helion's theme on the music box in two voices that answer each other, a warm hum
      12-24   wrongness: one note bends flat; the theme slows, detunes, thins to one voice; a low drone; a slow heartbeat
      24-38   the taking: the heartbeat quickens, the drone swells, the motif once more, breaking on its last note (35.5)
      38      the shockwave: air rushing in, one low blow; then silence to the end (the three lines are read in it)"""
    total = 46.0
    dry = np.zeros((int(total * SR), 2))
    # calm: four bars of the theme; the second voice answers each phrase a beat later, an octave up, from the other side
    for b in range(4):
        theme_bar(dry, b * BAR, b, vel=0.95)
        at = 0.0
        for name, beats in L.TUNE[b]:
            if at in (0.0, 2.0): L.place(dry, b * BAR + (at + 1) * BEAT, L.tine(L.hz(name) * UP * 2, beats * BEAT, 0.42), pan=-0.45)
            at += beats
    # wrongness: the theme again, slower each bar, flatter, and one voice only; the first wrong note bends down
    slow = [1.0, 1.12, 1.28, 1.45]; cents = [0, -35, -60, -95]; cut = [3000, 2000, 1300, 800]; vel = [0.85, 0.7, 0.55, 0.42]
    for k in range(4):
        b = 4 + k; t0 = 12.0 + sum(BAR * x for x in slow[:k]); part = np.zeros((int((BAR * 2 + 4) * SR), 2))
        chord = L.CH[L.CHORDS[b]]
        L.place(part, 0, hum(chord, BAR * slow[k]) * (0.8 - 0.2 * k))
        at = 0.0
        for i, (name, beats) in enumerate(L.TUNE[b]):
            if k >= 2 and i == len(L.TUNE[b]) - 1: break  # it starts to lose its last notes
            f = L.hz(name) * UP * 2 ** (cents[k] / 1200)
            sig = L.tine(f, beats * BEAT * slow[k], vel[k])
            if k == 0 and i == 1:  # the wrong note: it bends flat as it rings
                n = len(sig); bend = 2 ** (-np.linspace(0, 1.4, n) ** 2 / 12)
                ph = np.cumsum(bend) / n
                idx = np.clip((np.arange(n) * bend).astype(int), 0, n - 1); sig = sig[idx]
            L.place(part, at * BEAT * slow[k], sig, pan=0.18)
            at += beats
        part = lowpass(part, cut[k])
        a = int(t0 * SR); dry[a:a + len(part)] += part[:len(dry) - a]
    # the drone: low, felt more than heard, from 14 s, swelling to the shockwave
    n = int(24.5 * SR); t = np.arange(n) / SR
    env = np.clip(t / 8.0, 0, 1) ** 1.6 * (0.6 + 0.4 * np.clip((t - 10) / 12, 0, 1)) * np.clip((24.5 - t) / 0.3, 0, 1)
    drone = (np.sin(2 * np.pi * 41.2 * t) + 0.6 * np.sin(2 * np.pi * 43.6 * t) + 0.3 * np.sin(2 * np.pi * 82.4 * t + 1)) * env * 0.07
    noise = bandpass(rng.standard_normal((n, 2)), 50, 190) * (env * 0.09)[:, None]
    a = int(14.0 * SR); dry[a:a + n, 0] += drone; dry[a:a + n, 1] += drone; dry[a:a + n] += noise
    # the heartbeat: slow at first (1.1 s), quickening through the taking (to 0.55 s), stopping before the blow
    at = 16.0; gap = 1.1
    while at < 37.2:
        L.place(dry, at, O.thump(0.34 + 0.2 * min(1, (at - 16) / 20))); L.place(dry, at + 0.3 * min(1, gap), O.thump(0.24 + 0.15 * min(1, (at - 16) / 20)))
        at += gap; gap = max(0.55, gap * (0.97 if at < 24 else 0.94))
    # the taking: the motif once more, alone, and it breaks on its last note (at 35.5): the note stops dead, and a
    # cluster a semitone apart rings in its place
    motif = [('A4', 1), ('B4', 1), ('D5', 2), ('C#5', 2)]; at = 29.0
    for i, (name, beats) in enumerate(motif):
        f = L.hz(name) * UP * 2 ** (-40 / 1200)
        if i < len(motif) - 1:
            L.place(dry, at, L.tine(f, beats * BEAT * 1.3, 0.62), pan=0.1)
        else:
            sig = L.tine(f, 2.6, 0.62); cutn = int(0.5 * SR); sig[cutn:] *= np.exp(-np.arange(len(sig) - cutn) / (0.012 * SR))[:, None] if sig.ndim == 2 else np.exp(-np.arange(len(sig) - cutn) / (0.012 * SR))
            L.place(dry, 35.0, sig, pan=0.1)
            for c in (1.0, 2 ** (1 / 12), 2 ** (-1 / 12)): L.place(dry, 35.5, L.tine(f * c * 0.5, 2.2, 0.32), pan=-0.2)
        at += beats * BEAT * 1.3
    out = room(dry, 0.5, 0.03)
    out /= np.abs(out).max() / 0.6
    # the shockwave at 38: air rushing in, one great blow, low, and its dust; then nothing at all
    t16 = 38.0
    n = int(1.4 * SR); t = np.arange(n) / SR
    rush = bandpass(rng.standard_normal((n, 2)), 300, 5000) * ((t / 1.4) ** 3)[:, None] * 0.16
    a = int((t16 - 1.4) * SR); out[a:a + n] += rush
    n = int(2.6 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (34 * t + 60 * (1 - np.exp(-t * 9)) / 9)) * np.exp(-t / 0.55) * 0.8
    dust = lowpass(rng.standard_normal((n, 2)), 2600) * np.exp(-t / 0.3)[:, None] * 0.3
    a = int(t16 * SR); out[a:a + n, 0] += boom; out[a:a + n, 1] += boom; out[a:a + n] += dust
    out[int((t16 + 2.3) * SR):] = 0
    return np.clip(out, -0.97, 0.97)


def coldfilm():
    """The cold open as a short film (the owner's brief of 2026-11-25, approved with seven beats), in three parts the
    scene plays separately, because the struggle in the middle lasts as long as the player makes it:
       0-20   A, the film: play (the duet on the music box, a chime at every crossing, Helion's laugh at 1.6), the omen
              (8.4 a note missing, 9.0 the loop skips, stars swallowed at 10.5 and 12.0, a low tone rising, stutters
              at 12.8 and 13.4), the strike (14.0 total silence, 14.5 the impact, the rush, stars crackling out, the
              pad bending down like a tape stopping, a rumble)
      20-30   the bed for the struggle, made to go round: the rumble, the headwind, everything slowed and muffled
              (the heartbeat, the swell, the heaves and the notes are played live, from the hold and the taps)
      30-42   B, from the moment his hand slips: the Stillness's groan, Helion's call (two falling notes, his bell
              voice) at 0.4, their song once more broken, the shockwave at 3.2 (a whump, white noise, a ringing), true
              silence, a low soft tone as each line appears (4.4, 6.0, 7.6)"""
    total = 42.0
    out = np.zeros((int(total * SR), 2))
    # ---------------- A: the film
    a = np.zeros((int(22 * SR), 2))
    # play: the theme in two voices trading phrases (Orbin a glassy bell, Helion a warmer one), the hum under it
    for b in range(3):
        t0 = b * BAR
        L.place(a, t0, hum(L.CH[L.CHORDS[b]], BAR) * (0.9 if b < 2 else 0.6))
        at = 0.0
        for i, (name, beats) in enumerate(L.TUNE[b]):
            when = t0 + at * BEAT
            if 8.2 < when < 8.9: at += beats; continue  # the omen: one note of their song does not come
            if when < 9.0:
                L.place(a, when, L.tine(L.hz(name) * UP, beats * BEAT, 0.9), pan=0.25)                 # Orbin's voice
                L.place(a, when + BEAT * 0.5, L.tine(L.hz(name) * UP * 2, beats * BEAT, 0.34), pan=-0.4)  # Helion answers, higher and warmer
            at += beats
    # a chime where their trails cross, and Helion's laugh: a quick bright rising run
    for k, when in enumerate((0.75, 2.25, 3.75, 5.25, 6.75)): L.place(a, when, L.tine(L.hz('E6') * UP * (1.0 if k % 2 else 1.26), 0.4, 0.22), pan=(-0.5 if k % 2 else 0.5))
    for i, n in enumerate(('C5', 'E5', 'G5', 'C6', 'E6')): L.place(a, 1.6 + i * 0.055, L.tine(L.hz(n) * UP / 2 ** (6 / 12) * 2 ** (8 / 12), 0.25, 0.3 - i * 0.03), pan=-0.35)
    # warm wind under the play
    w = O.wind(14.0) * 1.4; a[:len(w)] += w
    # the omen: the loop skips like a scratched record, then thins, slower and flatter, to one voice
    frag = L.tine(L.hz('F#4') * UP, 0.22, 0.8); frag = frag[:int(0.2 * SR)] * np.linspace(1, 0.2, int(0.2 * SR))
    for k in range(3): L.place(a, 9.0 + k * 0.24, frag, pan=0.2)
    at = 9.75
    for i, (name, beats) in enumerate(L.TUNE[3] + L.TUNE[4]):
        if at > 13.9: break
        sig = L.tine(L.hz(name) * UP * 2 ** (-45 / 1200), beats * BEAT * 1.25, 0.55)
        if abs(at - 12.8) < 0.45 or abs(at - 13.4) < 0.3:  # the stutters: the note stops dead
            cut = int(0.11 * SR); sig[cut:] = 0
        L.place(a, at, lowpass(sig[:, None].repeat(2, 1), 1800)[:, 0] if False else sig, pan=0.15)
        at += beats * BEAT * 1.25
    for when in (10.5, 12.0):  # a star goes out: a high tine swallowed into a low gulp
        L.place(a, when, L.tine(L.hz('B6'), 0.2, 0.25), pan=0.5)
        n = int(0.5 * SR); t = np.arange(n) / SR; gulp = np.sin(2 * np.pi * (300 * t - 220 * t * t)) * np.exp(-t / 0.12) * 0.18
        L.place(a, when + 0.12, gulp, pan=0.4)
    n = int(4.2 * SR); t = np.arange(n) / SR; env = (t / 4.2) ** 2
    tone = (np.sin(2 * np.pi * 41.2 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * env * 0.12
    a[int(9.8 * SR):int(9.8 * SR) + n, 0] += tone; a[int(9.8 * SR):int(9.8 * SR) + n, 1] += tone
    a = room(a, 0.5, 0.025)
    a[int(14.0 * SR):] = 0  # half a second of total silence: even the wind stops
    # the strike at 14.5: a sub-bass impact, a roar of rushing ink, stars crackling out, the pad bending down, a rumble
    T = 14.5
    n = int(0.12 * SR); t = np.arange(n) / SR
    pre = bandpass(rng.standard_normal((n, 2)), 400, 6000) * ((t / 0.12) ** 4)[:, None] * 0.25; a[int((T - 0.12) * SR):int(T * SR)] += pre[:int(0.12 * SR)]
    n = int(3.0 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (30 * t + 70 * (1 - np.exp(-t * 7)) / 7)) * np.exp(-t / 0.8) * 0.9
    rush = bandpass(rng.standard_normal((n, 2)), 120, 3000) * (np.exp(-t / 0.9) * 0.5)[:, None]
    i0 = int(T * SR); a[i0:i0 + n, 0] += boom; a[i0:i0 + n, 1] += boom; a[i0:i0 + n] += rush
    for k in range(40):  # the crackle of stars going out, a cascade
        when = T + 0.1 + 1.8 * (k / 40) ** 0.7 + rng.uniform(0, 0.05)
        m = int(0.03 * SR); click = bandpass(rng.standard_normal((m, 2)), 2000, 9000) * np.exp(-np.arange(m) / (0.004 * SR))[:, None] * rng.uniform(0.1, 0.3)
        j = int(when * SR); a[j:j + m] += click
    padv = O.pad(['Ab3', 'Eb4', 'Ab4', 'C5', 'Eb5'], 2.6) * 0.12  # the pad, bending down like a tape stopping
    nn = len(padv); bend = np.cumsum(np.clip(1 - (np.arange(nn) / nn) ** 1.6 * 0.85, 0.1, 1)); idx = np.clip(bend.astype(int), 0, nn - 1)
    padv = padv[idx] * np.linspace(1, 0, nn)[:, None]; a[i0:i0 + nn] += padv
    n = int(6.6 * SR); t = np.arange(n) / SR
    rum = (np.sin(2 * np.pi * 36.7 * t) + 0.6 * np.sin(2 * np.pi * 38.9 * t)) * np.clip(t / 0.6, 0, 1) * 0.16
    a[i0:i0 + n, 0] += rum; a[i0:i0 + n, 1] += rum
    a[i0:i0 + n] += lowpass(rng.standard_normal((n, 2)), 160) * (np.clip(t / 0.6, 0, 1) * 0.35)[:, None]
    a *= 10 ** ((-24 - level(a[:int(8 * SR)])) / 20)  # the play at about -24 dB; the rest of the film in proportion
    out[:int(20 * SR)] = a[:int(20 * SR)]
    # ---------------- the bed, 20-30, made to go round
    n = int(11 * SR); t = np.arange(n) / SR
    bed = np.zeros((n, 2))
    r1 = (np.sin(2 * np.pi * 36.7 * t) + 0.6 * np.sin(2 * np.pi * 38.9 * t)) * 0.16; bed[:, 0] += r1; bed[:, 1] += r1
    bed += lowpass(rng.standard_normal((n, 2)), 160) * 0.35
    howl = bandpass(rng.standard_normal((n, 2)), 250, 900) * (0.06 + 0.035 * np.sin(2 * np.pi * t / 5.5))[:, None]
    bed += lowpass(howl, 1200)
    x = int(1.0 * SR); ramp = np.linspace(0, 1, x)[:, None]
    bed10 = bed[:int(10 * SR)].copy(); bed10[:x] = bed[int(10 * SR):int(10 * SR) + x] * (1 - ramp) + bed10[:x] * ramp
    bed10 *= 10 ** ((-30 - level(bed10)) / 20)
    out[int(20 * SR):int(30 * SR)] = bed10
    # match the film's last second into the bed (no seam at 20)
    # ---------------- B, from the slip
    b = np.zeros((int(12 * SR), 2))
    n = int(1.6 * SR); t = np.arange(n) / SR
    groan = np.tanh(2.5 * np.sin(2 * np.pi * (80 * t - 14 * t * t))) * np.exp(-t / 0.9) * np.clip(t / 0.15, 0, 1) * 0.16
    b[:n, 0] += lowpass(groan[:, None], 400)[:, 0]; b[:n, 1] += lowpass(groan[:, None], 400)[:, 0]
    b[:n] += lowpass(rng.standard_normal((n, 2)), 120) * (np.exp(-t / 1.0) * 0.4)[:, None]
    call = np.zeros((int(3 * SR), 2))
    L.place(call, 0.0, L.tine(L.hz('C6'), 0.35, 0.7), pan=0.45); L.place(call, 0.32, L.tine(L.hz('A5'), 0.6, 0.7), pan=0.5)  # "Orbin!": two falling notes
    b[int(0.4 * SR):int(0.4 * SR) + len(call)] += O.room(call, 1.4, 0.15)[:len(b) - int(0.4 * SR)]
    at = 1.0
    for i, (name, beats) in enumerate(L.TUNE[0] + L.TUNE[1]):  # their song once more, broken: detuned, notes missing
        if i in (2, 5): at += beats * BEAT * 0.6; continue
        if at > 3.0: break
        L.place(b, at, L.tine(L.hz(name) * UP * 2 ** (-70 / 1200), beats * BEAT * 0.6, 0.45), pan=-0.1)
        at += beats * BEAT * 0.6
    S = 3.2
    n = int(0.9 * SR); t = np.arange(n) / SR
    b[int((S - 0.9) * SR):int(S * SR)] += bandpass(rng.standard_normal((n, 2)), 300, 5000) * ((t / 0.9) ** 3 * 0.2)[:, None]
    n = int(2.8 * SR); t = np.arange(n) / SR
    whump = np.sin(2 * np.pi * (32 * t + 60 * (1 - np.exp(-t * 9)) / 9)) * np.exp(-t / 0.6) * 3.0
    blast = rng.standard_normal((n, 2)) * (np.exp(-t / 0.25) * 0.6)[:, None]
    i0 = int(S * SR); b[i0:i0 + n, 0] += whump; b[i0:i0 + n, 1] += whump; b[i0:i0 + n] += lowpass(blast, 7000)
    b = room(b, 0.6, 0.03)
    b[int(4.2 * SR):int(4.3 * SR)] *= np.linspace(1, 0, int(0.1 * SR))[:, None]; b[int(4.3 * SR):] = 0
    n = int(3.2 * SR); t = np.arange(n) / SR
    ring = np.sin(2 * np.pi * 3150 * t) * np.exp(-t / 0.9) * np.clip(t / 0.05, 0, 1) * 0.035
    b[i0:i0 + n, 0] += ring; b[i0:i0 + n, 1] += ring
    for when, name in ((4.4, 'Ab2'), (6.0, 'F2'), (7.6, 'Db3')):  # a low soft tone as each line appears
        n = int(2.4 * SR); t = np.arange(n) / SR; f = hz(name.replace('Ab', 'G#').replace('Db', 'C#'))
        tone = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.clip(t / 0.25, 0, 1) * np.exp(-t / 0.9) * 2.4
        j = int(when * SR); b[j:j + n, 0] += tone; b[j:j + n, 1] += tone
    b *= 10 ** ((-21 - level(b[:int(2 * SR)])) / 20)
    out[int(30 * SR):] = b[:int(12 * SR)]
    pk = np.abs(out).max()
    if pk > 0.9: out *= 0.9 / pk
    return np.clip(out, -0.97, 0.97)


MEMFILM = 22.0  # seconds a memory film's part takes in its file (each chapter starts at k * MEMFILM)
def memfilms():
    """The four memories of Helion as short films (the owner's brief of 2026-11-25: no tapping; a chapter of the
    brothers' story for each world restored), each about 20 s of Helion's theme on the music box, arranged for its chapter:
       0  Emberwick, the joy of it: the theme whole and warm, two voices answering each other, the hum, chimes
      22  Cirra, their bond: Orbin's voice drifts late and thins; Helion's waits for it, and they come back together
      44  Glassmere, the Stillness arriving: the theme, then one note skips like a scratched record, and it thins to one
          voice over a low tone
      66  Verdance, the dark closing: slower, muffled, the harmony turned minor, one voice and a heartbeat"""
    out = np.zeros((int(4 * MEMFILM * SR), 2))
    def part(k):
        a = np.zeros((int((MEMFILM + 3) * SR), 2))
        return a
    def put(k, a, gain_db):
        a = a[:int(MEMFILM * SR)]
        a *= 10 ** ((gain_db - level(a[:int(16 * SR)])) / 20)
        n = int(1.5 * SR); a[-n:] *= np.linspace(1, 0, n)[:, None]
        out[int(k * MEMFILM * SR):int(k * MEMFILM * SR) + len(a)] += a
    # 0: joy
    a = part(0)
    for b in range(6):
        theme_bar(a, 0.6 + b * BAR, b, vel=0.95)
        at = 0.0
        for name, beats in L.TUNE[b]:
            L.place(a, 0.6 + b * BAR + (at + 0.5) * BEAT, L.tine(L.hz(name) * UP * 2, beats * BEAT, 0.36), pan=-0.45); at += beats
    for k2 in range(10): L.place(a, 1.2 + k2 * 1.8, L.tine(L.hz('E6') * UP * (1.26 if k2 % 2 else 1.0), 0.4, 0.18), pan=0.5 if k2 % 2 else -0.5)
    put(0, room(a, 0.5, 0.03), -24)
    # 1: bond. Orbin's voice (the lower) drifts later each phrase and thins; Helion's (above) holds back to wait; together again
    a = part(1)
    late = [0, 0.06, 0.16, 0.3, 0.12, 0.0]; Ov = [0.9, 0.8, 0.55, 0.35, 0.7, 0.95]
    for b in range(6):
        t0 = 0.6 + b * BAR; L.place(a, t0, hum(L.CH[L.CHORDS[b]], BAR) * 0.8)
        at = 0.0
        for name, beats in L.TUNE[b]:
            L.place(a, t0 + (at + late[b] * 4) * BEAT, L.tine(L.hz(name) * UP, beats * BEAT, Ov[b]), pan=0.3)
            L.place(a, t0 + (at + 0.5 + late[b] * 2) * BEAT, L.tine(L.hz(name) * UP * 2, beats * BEAT, 0.34), pan=-0.4)
            at += beats
    put(1, room(a, 0.6, 0.04), -25)
    # 2: the Stillness arriving: the theme; at 9 s a note skips three times; after it one voice, flatter, over a low tone
    a = part(2)
    for b in range(3):
        theme_bar(a, 0.6 + b * BAR, b, vel=0.85, humming=True)
    frag = L.tine(L.hz('B4') * UP, 0.22, 0.8)[:int(0.2 * SR)]
    for k2 in range(3): L.place(a, 9.6 + k2 * 0.24, frag * np.linspace(1, 0.25, len(frag)), pan=0.2)
    at = 10.6
    for name, beats in L.TUNE[3] + L.TUNE[4] + L.TUNE[5]:
        if at > 19.5: break
        L.place(a, at, L.tine(L.hz(name) * UP * 2 ** (-40 / 1200), beats * BEAT * 1.2, 0.5), pan=0.15); at += beats * BEAT * 1.2
    n = int(11 * SR); t = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * 41.2 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * np.clip(t / 4, 0, 1) * 0.12
    a[int(10 * SR):int(10 * SR) + n, 0] += tone; a[int(10 * SR):int(10 * SR) + n, 1] += tone
    put(2, room(a, 0.6, 0.04), -26)
    # 3: the dark closing: slower, minor, muffled, one voice; a heartbeat under it
    a = part(3)
    MIN = {'D': ('D3', 'F3', 'A3'), 'Bm': ('B2', 'D3', 'F#3'), 'G': ('G2', 'A#2', 'D3'), 'A': ('A2', 'C3', 'E3')}
    at = 0.8
    for b in range(4):
        ch = MIN.get(L.CHORDS[b], L.CH[L.CHORDS[b]]); L.place(a, at, hum(ch, BAR * 1.35) * 0.7)
        q = 0.0
        for name, beats in L.TUNE[b]:
            L.place(a, at + q * BEAT * 1.35, L.tine(L.hz(name) * UP * 2 ** (-30 / 1200), beats * BEAT * 1.35, 0.62), pan=0.1); q += beats
        at += BAR * 1.35
    t1 = 1.0
    while t1 < 20.5: L.place(a, t1, O.thump(0.5)); L.place(a, t1 + 0.3, O.thump(0.32)); t1 += 1.05
    a = lowpass(a, 1500)
    put(3, room(a, 0.9, 0.06), -27)
    pk = np.abs(out).max()
    if pk > 0.9: out *= 0.9 / pk
    return np.clip(out, -0.97, 0.97)


def helion_far(notes, beat=0.6):
    """Helion's moment in a level: his music-box motif from far away (low-passed, in a large room), in the song's key."""
    buf = np.zeros((int((sum(b for _, b in notes) * beat + 5) * SR), 2)); at = 0.0
    for name, b in notes: L.place(buf, at, L.tine(hz(name), b * beat * 1.6, 0.9), pan=-0.25); at += b * beat
    out = O.room(lowpass(buf, 1500), 2.2, 0.22) * 0.55
    return np.clip(out / max(1e-9, np.abs(out).max()) * 0.5, -0.97, 0.97)


def opening_parts():
    """See the top of the file. The same shapes as before; only the notes and the pulse's pace are the new song's."""
    out = np.zeros((int(44 * SR), 2))
    w = O.wind(21.0); out[:len(w)] += w
    for at, v in ((10.0, 0.45), (10.32, 0.45), (12.0, 0.3), (12.32, 0.3)): L.place(out, at, O.thump(v))
    # the far music box, in the song's own key (F sharp major): the theme's first phrase, losing its last note
    notes = [('A#4', 1), ('C#5', 1), ('F#5', 2), ('D#5', 2), ('C#5', 1), ('A#4', 1)]
    buf = np.zeros((int((sum(b for _, b in notes) * 0.75 + 6) * SR), 2)); at = 0.0
    for name, b in notes: L.place(buf, at, L.tine(hz(name), b * 0.75, 0.9), pan=0.1); at += b * 0.75
    box = O.room(lowpass(buf, 900), 1.6, 0.12) * 0.5 * 0.55
    n0 = int(4.5 * SR); n1 = int(5.1 * SR); box[n0:n1] *= np.linspace(1, 0, n1 - n0)[:, None]; box[n1:] = 0
    a = int(10.9 * SR); out[a:a + len(box)] += box
    out *= 0.3 / np.abs(out).max()
    step = 0.8  # the pulse: two to a bar of the song (it is felt at half its written speed)
    def loop(at, fill):
        n = int(round(4 * step * SR)); buf = np.zeros((2 * n + SR * 3, 2)); fill(buf)
        a = int(at * SR); m = int(0.12 * SR)
        out[a - m:a + n + m] += buf[n - m:2 * n + m]
    loop(24.0, lambda b: [L.place(b, k * step, O.thump(0.55 if k % 2 == 0 else 0.42)) for k in range(8)])
    def plink(b):
        for k in (0, 2, 4, 6): L.place(b, k * step, L.tine(hz('D#5'), 1.4, 0.5), pan=0.15)
        b[:] = O.room(b, 0.5, 0.02)
    loop(30.0, plink)
    a0, a1 = int(30.0 * SR), int(33.2 * SR); out[a0:a1] *= 0.6
    ch = np.zeros((int(5 * SR), 2))
    c = O.pad(['F#3', 'C#4', 'F#4', 'G#4', 'A#4', 'C#5', 'D#5'], 4.5) * 0.07; ch[:len(c)] += c
    t = np.arange(int(1.2 * SR)) / SR
    L.place(ch, 0, np.sin(2 * np.pi * hz('B1') * t) * np.exp(-t / 0.35) * 0.28)  # the song's own bass note, under it
    sh = bandpass(rng.standard_normal((int(2.5 * SR), 2)), 3000, 9000) * np.exp(-np.arange(int(2.5 * SR)) / SR / 0.6)[:, None] * 0.03; ch[:len(sh)] += sh
    a = int(36.0 * SR); out[a:a + len(ch)] += ch * (0.8 / np.abs(ch).max())
    return out


def started_bed():
    cfg = json.load(open(ROOT / 'tools/tracks.json')); t = cfg['tracks']['started']
    y, sr = sf.read(str((ROOT / cfg['sourceDir'] / t['source']).resolve()), dtype='float64', always_2d=True); assert sr == SR
    bar = 240.0 / t['bpm']; at = lambda b: int(round((t['sourceOffset'] + b * bar) * SR))
    a, m, z = at(0), at(8), at(16)
    out = y[a:z].copy(); x = int(0.18 * SR); ramp = np.linspace(0, 1, x)[:, None]
    out[-x:] = out[-x:] * (1 - ramp) + y[m - x:m] * ramp          # its end leans into the bar it will go back to
    out = np.concatenate([out, y[m:m + int(0.4 * SR)]])            # ...and a little of that bar after the seam, for decoders that pad
    n = int(1.5 * SR); out[:n] *= (np.linspace(0, 1, n) ** 1.5)[:, None]  # it arrives out of nothing
    return out


def sting(pad_notes, run, top, low):
    out = np.zeros((int(9 * SR), 2))
    # the catch
    c = O.pad(pad_notes, 3.2, bright=1.2); c *= 0.5 / np.abs(c).max(); out[:len(c)] += c
    t = np.arange(int(1.4 * SR)) / SR
    L.place(out, 0, np.sin(2 * np.pi * hz(low) * t) * np.exp(-t / 0.45) * 0.3)
    for i, name in enumerate(run): L.place(out, 0.02 + i * 0.085, L.tine(hz(name), 0.6, 0.55 + 0.08 * i), pan=-0.2 + 0.13 * i)
    L.place(out, 0.02 + len(run) * 0.085 + 0.03, L.tine(hz(top), 2.2, 0.95), pan=0.12)
    n = int(2.6 * SR); sh = bandpass(rng.standard_normal((n, 2)), 3500, 9500) * np.exp(-np.arange(n) / SR / 0.7)[:, None] * 0.035; out[:n] += sh
    out[:int(3.6 * SR)] = O.room(out[:int(3.6 * SR)], 0.6, 0.02)
    # the star rising: air and glass, lifting
    n = int(1.6 * SR); t = np.arange(n) / SR; a = int(4.0 * SR)
    air = bandpass(rng.standard_normal((n, 2)), 900, 7000) * ((t / 1.6) ** 2 * np.clip((1.6 - t) / 0.12, 0, 1))[:, None] * 0.07
    out[a:a + n] += air
    for i, name in enumerate(run[:3]): L.place(out, 4.0 + 0.35 + i * 0.36, L.tine(hz(name), 0.5, 0.22 + 0.06 * i), pan=0.3 - 0.3 * i)
    # home: the star takes its place
    for name, d, v in ((run[0], 0.0, 0.6), (run[1], 0.11, 0.5)): L.place(out, 6.0 + d, L.tine(hz(name) / 2, 1.8, v), pan=0.1)
    out[int(6.0 * SR):] = O.room(out[int(6.0 * SR):], 0.5, 0.02)
    return out * (0.8 / np.abs(out).max())


def periodic(n, make, xf=0.5):
    """A stretch of something continuous (noise) that goes round with no seam."""
    x = int(xf * SR); buf = make(n + x); ramp = np.linspace(0, 1, x)[:, None]
    out = buf[:n].copy(); out[:x] = buf[:x] * ramp + buf[n:n + x] * (1 - ramp)
    return out


def fire(big):
    n = int(8 * BAR * SR); t = np.arange(n) / SR; out = np.zeros((n, 2))
    # the burn: low, soft, wandering
    def burn(m):
        x = bandpass(rng.standard_normal((m, 2)), 70, 520); k = np.arange(m) / SR
        return x * (0.6 + 0.25 * np.sin(2 * np.pi * 0.31 * k + 1) + 0.15 * np.sin(2 * np.pi * 0.83 * k))[:, None]
    out += periodic(n, burn) * (0.05 if big else 0.022)
    # the night: thin air, far
    out += periodic(n, lambda m: bandpass(rng.standard_normal((m, 2)), 1800, 5200) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * np.arange(m) / SR))[:, None]) * 0.006
    # crackle: small dry snaps, now and then a larger one (kept clear of the loop's edges)
    wrap = np.zeros((n + SR, 2)); rate = 5.5 if big else 2.2; at = 0.2
    while at < 8 * BAR - 0.05:
        dur = rng.uniform(0.001, 0.007); m = int(dur * SR) + 1
        snap = rng.standard_normal(m) * np.linspace(1, 0, m) ** 2
        loud = rng.lognormal(-1.2, 0.7) * (1.0 if big else 0.7)
        if rng.random() < 0.07:  # a pop: with a little body
            m2 = int(0.03 * SR); snap = np.concatenate([snap, rng.standard_normal(m2) * np.exp(-np.arange(m2) / SR / 0.008) * 0.4]); loud *= 1.6
        L.place(wrap, at, snap * min(0.5, loud) * 0.22, pan=rng.uniform(-0.5, 0.5))
        at += rng.exponential(1 / rate)
    crack = bandpass(wrap, 1400, 7500); out += crack[:n]; out[:SR] += crack[n:]
    # the low hum, and the music box far off: the theme's first question, once a turn
    mus = np.zeros((n + 4 * SR, 2))
    for b in (0, 1, 2, 3, 4, 6):
        chord = L.CH[L.CHORDS[b % 4]]; L.place(mus, b * BAR, hum(chord, BAR) * (0.9 if big else 0.6))
    for b in range(4):
        at2 = 0.0
        for name, beats in L.TUNE[b]:
            L.place(mus, (b + (0 if big else 0)) * BAR + at2 * BEAT, L.tine(L.hz(name) * UP, beats * BEAT, 0.5 if big else 0.34), pan=0.2); at2 += beats
    if big:  # with a star home the tune is answered, lower, by the left hand
        for b in range(4, 8):
            chord = L.CH[L.CHORDS[b % 4]]
            for q, name in enumerate((chord[0], chord[2])): L.place(mus, b * BAR + q * 2 * BEAT, L.tine(L.hz(name) * DOWN * 2, 2 * BEAT, 0.22), pan=-0.2)
    mus = O.room(lowpass(mus, 2400 if big else 1500), 1.2, 0.08)
    out += mus[:n]; out[:4 * SR] += mus[n:]
    out *= 0.42 / np.abs(out).max()
    return np.concatenate([out, out[:3 * SR]])  # the first seconds again after the seam, as the hub's themes have


if __name__ == '__main__':
    (ROOT / 'tools/cache').mkdir(exist_ok=True)
    import sys
    want = set(sys.argv[1:])
    made = {'helion1': helion_far([('A#4', 1), ('C#5', 1), ('F#5', 2), ('D#5', 2)], 0.4), 'helion2': helion_far([('A4', 1), ('C#5', 1), ('F#5', 2), ('E5', 2)], 0.6), 'coldopen': coldfilm(), 'memfilm': memfilms(), 'nebula': nebula(), 'opening': opening_parts(), 'startedbed': started_bed(),
            'sting1': sting(['F#3', 'A#3', 'C#4', 'F#4'], ['A#5', 'C#6', 'F#6'], 'A#6', 'B1'),
            'sting2': sting(['A2', 'E3', 'A3', 'C#4', 'E4'], ['C#6', 'E6', 'A6'], 'C#7', 'A1'),
            'fire0': fire(False), 'fire1': fire(True)}
    for name, x in made.items():
        if want and name not in want: continue
        assert np.abs(x).max() < 0.99, (name, np.abs(x).max())
        sf.write(str(ROOT / f'tools/cache/{name}-src.wav'), x, SR, subtype='PCM_16')
        print(f'{name}: {len(x) / SR:.2f} s, peak {np.abs(x).max():.2f}, level {level(x):.1f} dB')
    x = made['nebula']; b = int(BAR * SR)
    print('nebula by bar (dB):', ' '.join(f'{level(x[i * b:(i + 1) * b]):.0f}' for i in range(17)))
    x = made['opening']
    for name, t0, t1 in (('bed', 0, 22), ('pulse', 24, 27.2), ('note', 30, 33.2), ('chord', 36, 41)): print(f'  opening {name}: peak {np.abs(x[int(t0 * SR):int(t1 * SR)]).max():.2f}, level {level(x[int(t0 * SR):int(t1 * SR)]):.1f} dB')
