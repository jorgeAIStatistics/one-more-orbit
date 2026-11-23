#!/usr/bin/env python3
"""Cut a level's excerpt out of the source song on bar lines and encode it.

  python tools/excerpt.py skyhigh

Reads tools/tracks.json. Writes public/audio/<id>.mp3 (128 kbps, with the gapless header so every
decoder returns the same samples), tools/cache/<id>.wav (what the analysis reads) and
levels/<id>/audio.json (length, bar-1 offset, sample count, drop time)."""
import json, sys, subprocess, pathlib
import numpy as np, soundfile as sf, imageio_ffmpeg
ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 44100
PRE = 0.008   # cuts sit 8 ms before the downbeat so no attack is clipped
XF = 0.010    # 10 ms crossfade at each splice

def main(tid):
    cfg = json.load(open(ROOT / 'tools/tracks.json')); t = cfg['tracks'][tid]
    y, sr = sf.read(str((ROOT / cfg['sourceDir'] / t['source']).resolve()), dtype='float64', always_2d=True)
    assert sr == SR, 'expected a 44.1 kHz source'
    bar = 240.0 / t['bpm']; bt = lambda b: t['sourceOffset'] + b * bar
    segs = [[bt(a), bt(b)] for a, b in t['segments']]
    pick = t.get('pickupBars', 0) * bar
    segs[0][0] = max(0.0, segs[0][0] - pick)
    segs[-1][1] = min(len(y) / SR, segs[-1][1] + t.get('tail', 0.0))
    for i in range(len(segs)):                      # move interior cut points just ahead of the downbeat
        if i > 0: segs[i][0] -= PRE
        if i < len(segs) - 1: segs[i][1] -= PRE
    xf = int(XF * SR); parts = []
    for i, (a, b) in enumerate(segs):
        sa = int(round(a * SR)) - (xf // 2 if i > 0 else 0); sb = int(round(b * SR)) + (xf // 2 if i < len(segs) - 1 else 0)
        seg = y[sa:sb].copy()
        if i > 0:
            ramp = np.linspace(0, 1, xf)[:, None]; seg[:xf] *= ramp
            parts[-1][-xf:] = parts[-1][-xf:] * (1 - ramp) + seg[:xf]; seg = seg[xf:]
        parts.append(seg)
    out = np.concatenate(parts)
    if pick > 0: n = int(pick * 0.96 * SR); out[:n] *= (np.linspace(0, 1, n) ** 2)[:, None]
    n = int(t.get('fadeOut', 1.5) * SR); out[-n:] *= (np.linspace(1, 0, n) ** 1.5)[:, None]
    out = np.clip(out / max(1.0, np.abs(out).max() / 0.98), -1, 1)
    def to_ex(src):                                 # source time -> excerpt time
        pos = 0.0
        for a, b in segs:
            if a <= src < b: return pos + (src - a)
            pos += b - a
        raise ValueError('time is not inside the excerpt')
    (ROOT / 'tools/cache').mkdir(exist_ok=True); wav = ROOT / f'tools/cache/{tid}.wav'
    sf.write(str(wav), out, SR, subtype='PCM_16')
    mp3 = ROOT / f'public/audio/{tid}.mp3'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', str(wav), '-codec:a', 'libmp3lame', '-b:a', '128k',
                    '-compression_level', '2', '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0', str(mp3)], check=True)
    dec, _ = sf.read(str(mp3), dtype='float32', always_2d=True)
    assert len(dec) == len(out), f'decoded length {len(dec)} != {len(out)}: gapless header missing?'
    first = int(np.argmax(np.abs(dec.mean(1)) > 0.02))
    meta = dict(file=f'audio/{tid}.mp3', frames=len(out), firstSig=first, bpm=t['bpm'], offset=round(to_ex(bt(t['segments'][0][0])), 4),
                length=round(len(out) / SR, 3), dropTime=round(to_ex(bt(t['dropBar'])), 3),
                source=[[round(a, 3), round(b, 3)] for a, b in segs])
    (ROOT / f'levels/{tid}').mkdir(exist_ok=True)
    json.dump(meta, open(ROOT / f'levels/{tid}/audio.json', 'w'), indent=2)
    print(tid, json.dumps(meta), 'mp3', mp3.stat().st_size, 'bytes')

if __name__ == '__main__':
    for tid in sys.argv[1:]: main(tid)
