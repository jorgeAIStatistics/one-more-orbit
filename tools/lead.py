#!/usr/bin/env python3
"""Transcribe the lead line of a stretch of an excerpt: which pitch sounds on every 16th, and where notes start.

  python tools/lead.py skyhigh 26 41          # bars are 1-based, inclusive

Works on pitch, not loudness, so side-chain pumping (the lead ducking under every kick) is not mistaken for notes.
A note start is a change of pitch, or a fresh attack of the same pitch (its own harmonic jumps up).
Writes tools/cache/<id>.lead.json: per bar, 16 slots of {midi pitch, start flag, strength}."""
import json, sys, pathlib
import numpy as np, soundfile as sf, librosa
ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def main(tid, b0, b1, lo='G4', hi='A6'):
    a = json.load(open(ROOT / f'levels/{tid}/audio.json'))
    y, sr = sf.read(str(ROOT / f'tools/cache/{tid}.wav'), dtype='float32', always_2d=True); y = y.mean(1)
    y = librosa.resample(y, orig_sr=sr, target_sr=22050); sr = 22050
    yh = librosa.effects.harmonic(y, margin=4.0)
    fmin = librosa.note_to_hz(lo); nb = int(round(12 * np.log2(librosa.note_to_hz(hi) / fmin))) + 1
    hop = 128
    C = np.abs(librosa.cqt(yh, sr=sr, hop_length=hop, fmin=fmin, n_bins=nb * 3, bins_per_octave=36, filter_scale=0.6))
    C = C.reshape(nb, 3, -1).max(1)                       # one row per semitone
    ft = np.arange(C.shape[1]) * hop / sr
    s16 = 15 / a['bpm']; midi0 = int(round(librosa.hz_to_midi(fmin)))
    L = np.log1p(C / (np.percentile(C, 95) + 1e-9) * 8)
    out = {}
    for bar in range(b0 - 1, b1):
        slots = []
        for i in range(16):
            t = a['offset'] + (bar * 16 + i) * s16
            m = (ft >= t + 0.012) & (ft < t + s16 - 0.01)
            prof = L[:, m].mean(1); p = int(np.argmax(prof)); level = float(prof[p])
            pre = (ft >= t - 0.045) & (ft < t - 0.008); post = (ft >= t + 0.005) & (ft < t + 0.05)
            rise = float(L[p, post].max() - L[p, pre].mean()) if pre.any() and post.any() else 0.0
            slots.append(dict(p=p + midi0, level=level, rise=rise))
        for i, s in enumerate(slots):
            prev = slots[i - 1]['p'] if i else None
            s['start'] = bool(s['level'] > 0.9 and (s['p'] != prev or s['rise'] > 0.55))
        out[bar + 1] = slots
        print(f"bar {bar + 1:2d}  " + ' '.join((NOTE[s['p'] % 12] + str(s['p'] // 12 - 1)).ljust(3) if s['level'] > 0.9 else '.  ' for s in slots))
        print("        " + ' '.join(('^' + str(min(9, int(s['rise'] * 5)))).ljust(3) if s['start'] else ('~' + str(min(9, int(s['rise'] * 5)))).ljust(3) for s in slots))
    (ROOT / 'tools/cache').mkdir(exist_ok=True)
    json.dump(out, open(ROOT / f'tools/cache/{tid}.lead.json', 'w'))

if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), *sys.argv[4:6])
