#!/usr/bin/env python3
"""Audits every generated survival press against the audio: is there a clear sound to press on?

  BASE=1 npx vite-node tools/export-layers.ts     # the generated layers, before any audit
  python tools/audit.py                           # all four levels; writes levels/<id>/audit.json
  npx vite-node tools/export-layers.ts            # the layers again, with the audit applied

For each press it measures the strongest onset (kick band, snare/vocal/hook band, hats at a third weight) within
35 ms of the note, and the same for every grid position within half a beat. A press that is not on a strong sound
moves to a clearly stronger one nearby (half as strong again, at least) if that keeps a beat between presses; a
press on a buried sound with nothing better nearby becomes a flow note. Sections that share a motif are decided together, so the same music keeps the same pattern. It also reports
how far, on average, the audio's own onsets sit from the grid: if that is near zero the chart is not what is late."""
import json, pathlib, sys
import numpy as np, soundfile as sf, librosa

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEAK, BURIED, BETTER, CLEAR = 0.75, 0.25, 1.5, 0.6  # strengths are relative to the track's loudest onsets (98th percentile = 1)

def strength_curve(y, sr):
    hop = 256
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop))
    f = librosa.fft_frequencies(sr=sr, n_fft=1024)
    def flux(lo, hi):
        B = S[(f >= lo) & (f < hi)]
        d = np.maximum(0, np.diff(np.log1p(8 * B), axis=1, prepend=0)).sum(axis=0)
        d = np.convolve(d, np.hanning(5) / np.hanning(5).sum(), mode='same')
        return d / (np.percentile(d, 98) + 1e-9)
    s = np.maximum.reduce([flux(30, 160), flux(160, 2500), 0.35 * flux(2500, 9000)])  # hats alone are not a sound to press on
    return np.clip(s, 0, 1.5), hop

def main(tid):
    audio = json.load(open(ROOT / f'levels/{tid}/audio.json')); level = json.load(open(ROOT / f'levels/{tid}/level.json'))
    base = json.load(open(ROOT / f'tools/cache/{tid}.base.json'))
    y, sr = sf.read(ROOT / f'tools/cache/{tid}.wav')
    if y.ndim > 1: y = y.mean(axis=1)
    s, hop = strength_curve(y.astype(np.float32), sr)
    spb, off = 60 / audio['bpm'], audio['offset']
    fr = lambda beat: (off + beat * spb) * sr / hop
    def val(beat, win=0.035):
        a, b = int(fr(beat) - win * sr / hop), int(fr(beat) + win * sr / hop) + 1
        return float(s[max(0, a):max(1, b)].max()) if a < len(s) else 0.0
    def peak_offset_ms(beat, win=0.06):
        a, b = int(fr(beat) - win * sr / hop), int(fr(beat) + win * sr / hop) + 1
        seg = s[max(0, a):b]
        return None if len(seg) < 3 or seg.max() < 0.5 else (max(0, a) + int(seg.argmax()) - fr(beat)) * hop / sr * 1000
    grid = [0, 4, 6, 10] if level.get('swing') else [0, 3, 6, 9]
    press = sorted(p['beat'] for p in base['survival']); big = {p['beat'] for p in base['survival'] if p['big']}
    segs, b0 = [], 0
    for sg in level['segments']:
        segs.append(dict(id=sg['id'], b0=b0, b1=b0 + sg['bars'] * 4, motif=sg.get('motif') or sg['id'], charge=bool((sg.get('core') or {}).get('charge')), label=sg['label'])); b0 += sg['bars'] * 4
    groups = {}
    for sg in segs: groups.setdefault(sg['motif'], []).append(sg)
    moved, demoted, weak, final = [], [], [], set(press)
    for motif, occ in groups.items():
        if occ[0]['charge']: continue
        length = min(o['b1'] - o['b0'] for o in occ)
        rels = sorted({round(p - occ[0]['b0'], 4) for p in press if occ[0]['b0'] <= p < occ[0]['b0'] + length})
        for rel in rels:
            here = [o for o in occ if round(o['b0'] + rel, 4) in final]
            if not here or any(round(o['b0'] + rel, 4) in big for o in here) or rel < 1e-6 and occ[0]['label'] == 'DROP': continue
            v = float(np.mean([val(o['b0'] + rel) for o in here]))
            if v >= WEAK: continue
            cands = sorted({round(np.floor(rel + d) + g / 12, 4) for d in (-1, 0, 1) for g in grid})
            cands = [c for c in cands if 0 <= c < length and abs(c - rel) <= 0.5 + 1e-6 and abs(c - rel) > 1e-6]
            def free(c):  # a beat clear of every other press, in every occurrence
                return all(all(abs(o['b0'] + c - q) >= 1 - 1e-6 for q in final if abs(q - (o['b0'] + rel)) > 1e-6) for o in here)
            scored = sorted(((float(np.mean([val(o['b0'] + c) for o in here])), -abs(c - rel), c) for c in cands if free(c)), reverse=True)
            if scored and scored[0][0] >= max(CLEAR, BETTER * v):
                top = scored[0][0]; c = max((x for x in scored if x[0] >= 0.9 * top), key=lambda x: x[1])[2]
                for o in here:
                    final.discard(round(o['b0'] + rel, 4)); final.add(round(o['b0'] + c, 4))
                    moved.append(dict(section=o['id'], **{'from': round(o['b0'] + rel, 4), 'to': round(o['b0'] + c, 4)}, was=round(v, 2), now=round(scored[0][0], 2)))
            elif v < BURIED:
                for o in here:
                    final.discard(round(o['b0'] + rel, 4)); demoted.append(dict(section=o['id'], beat=round(o['b0'] + rel, 4), was=round(v, 2)))
            else:
                for o in here: weak.append(dict(section=o['id'], beat=round(o['b0'] + rel, 4), was=round(v, 2)))
    offs = [x for x in (peak_offset_ms(p) for p in sorted(final)) if x is not None]
    tick = lambda b: int(round(b * 12))
    doc = "Written by tools/audit.py: survival presses that sat on a weak or buried sound, and where they were moved. demote/promote are ticks (12 per beat) applied to generated bars only; hand-recorded bars ignore this file."
    out = dict(_doc=doc, onsetVsGridMs=dict(mean=round(float(np.mean(offs)), 1), sd=round(float(np.std(offs)), 1), n=len(offs)), moved=moved, demoted=demoted, weak=weak,
               demote=sorted({tick(m['from']) for m in moved} | {tick(d['beat']) for d in demoted}), promote=sorted({tick(m['to']) for m in moved}))
    json.dump(out, open(ROOT / f'levels/{tid}/audit.json', 'w'), indent=1)
    vals = [val(p) for p in sorted(final)]
    print(f"{tid}: {len(press)} generated presses -> {len(final)} after audit: {len(moved)} moved, {len(demoted)} made flow notes, {len(weak)} weak but kept; "
          f"median press strength {np.median([val(p) for p in press]):.2f} -> {np.median(vals):.2f}; the audio's onsets sit {np.mean(offs):+.1f} ms from the grid (sd {np.std(offs):.1f}, n={len(offs)})")
    by = {}
    for m in moved: by.setdefault(m['section'], []).append(f"{m['from']:g}->{m['to']:g}")
    for d in demoted: by.setdefault(d['section'], []).append(f"{d['beat']:g} to flow")
    for w in weak: by.setdefault(w['section'], []).append(f"{w['beat']:g} weak ({w['was']})")
    for k, v in by.items(): print(f"   {k:8s} " + ', '.join(v[:14]) + (' ...' if len(v) > 14 else ''))

if __name__ == '__main__':
    for t in (sys.argv[1:] or ['heroes', 'skyhigh', 'blank', 'invincible']): main(t)
