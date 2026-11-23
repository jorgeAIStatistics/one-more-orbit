# Measures how intense each level's excerpt is, to order the setlist: loudness, bass weight, how busy it is,
# tempo, and how hard the drop hits.  Usage: python tools/intensity.py   (reads tools/cache/<id>.wav and levels/<id>/)
import json, pathlib
import numpy as np, soundfile as sf, librosa

ROOT = pathlib.Path(__file__).resolve().parent.parent
rows = []
for tid in ['heroes', 'skyhigh', 'blank', 'invincible']:
    audio = json.load(open(ROOT / f'levels/{tid}/audio.json'))
    chart = json.load(open(ROOT / f'levels/{tid}/chart.json'))
    y, sr = sf.read(ROOT / f'tools/cache/{tid}.wav')
    if y.ndim > 1: y = y.mean(axis=1)
    y = y.astype(np.float32)
    bpm, off, drop, length = audio['bpm'], audio['offset'], audio['dropTime'], audio['length']
    def rms_db(a): return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)
    seg = lambda t0, t1: y[int(max(0, t0) * sr):int(min(length, t1) * sr)]
    bar = 240 / bpm
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)) ** 2
    f = librosa.fft_frequencies(sr=sr, n_fft=2048)
    t = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=512)
    after = (t >= drop) & (t < drop + 8 * bar)
    bass = S[(f < 150)][:, after].sum() / S[:, after].sum()
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
    peaks = librosa.util.peak_pick(onset, pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=0.6 * onset.std(), wait=4)
    pk = t[peaks]
    onsets_drop = ((pk >= drop) & (pk < drop + 8 * bar)).sum() / (8 * bar)
    flux_drop = onset[after].mean()
    notes = [n['t'] / 12 * 60 / bpm for n in chart['notes']]
    dnotes = sum(1 for x in notes if drop - off <= x < drop - off + 8 * bar) / (8 * bar)
    rows.append(dict(id=tid, bpm=bpm, length=round(length, 1), loud_all=rms_db(y), loud_drop=rms_db(seg(drop, drop + 8 * bar)), loud_pre=rms_db(seg(drop - 4 * bar, drop)),
                     jump=rms_db(seg(drop, drop + 2 * bar)) - rms_db(seg(drop - 2 * bar, drop)), bass=bass, onsets=onsets_drop, flux=flux_drop, notes=dnotes))
def z(k):
    v = np.array([r[k] for r in rows], float); return (v - v.mean()) / (v.std() + 1e-9)
score = 0.25 * z('loud_drop') + 0.2 * z('bass') + 0.2 * z('onsets') + 0.15 * z('flux') + 0.1 * z('bpm') + 0.1 * z('jump')
for r, s in zip(rows, score): r['score'] = float(s)
print(f"{'level':11s} {'BPM':>4s} {'len s':>6s} {'loud dB':>8s} {'drop dB':>8s} {'drop jump dB':>12s} {'bass share':>10s} {'hits/s in drop':>14s} {'flux':>6s} {'chart notes/s':>13s} {'intensity':>9s}")
for r in sorted(rows, key=lambda r: r['score']):
    print(f"{r['id']:11s} {r['bpm']:4.0f} {r['length']:6.1f} {r['loud_all']:8.1f} {r['loud_drop']:8.1f} {r['jump']:12.1f} {r['bass']:10.2f} {r['onsets']:14.1f} {r['flux']:6.2f} {r['notes']:13.1f} {r['score']:9.2f}")
json.dump([{k: (v if isinstance(v, str) else float(v)) for k, v in r.items()} for r in rows], open(ROOT / 'tools/cache/intensity.json', 'w'), indent=1)
