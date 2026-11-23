#!/usr/bin/env python3
"""Listening preview: the level's excerpt with a click on every tap, so a chart can be checked by ear.

  python tools/preview.py skyhigh            # writes ../v4-chart-previews/skyhigh.mp3

Every tap gets a short bright click (accents are louder and lower; ghost gates and spike hops click the same,
because they are taps too). If a click lands where you hear nothing, that tap is wrong."""
import json, sys, subprocess, pathlib
import numpy as np, soundfile as sf, imageio_ffmpeg
ROOT = pathlib.Path(__file__).resolve().parent.parent

def main(tid, out_dir='../v4-chart-previews'):
    a = json.load(open(ROOT / f'levels/{tid}/audio.json')); chart = json.load(open(ROOT / f'levels/{tid}/chart.json'))
    y, sr = sf.read(str(ROOT / f'tools/cache/{tid}.wav'), dtype='float64', always_2d=True)
    y = y * 0.62; spb = 60 / a['bpm']
    t = np.arange(int(0.05 * sr)) / sr
    click = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 110) * 0.55
    accent = (np.sin(2 * np.pi * 1200 * t) + 0.6 * np.sin(2 * np.pi * 2400 * t)) * np.exp(-t * 70) * 0.6
    for n in chart['notes']:
        s0 = int(round((a['offset'] + n['t'] / 12 * spb) * sr)); snd = accent if n.get('a') else click
        e = min(len(y), s0 + len(snd))
        if s0 < len(y): y[s0:e] += snd[:e - s0, None]
    y = np.clip(y, -1, 1)
    out = (ROOT / out_dir).resolve(); out.mkdir(parents=True, exist_ok=True)
    wav = ROOT / f'tools/cache/{tid}.preview.wav'; sf.write(str(wav), y, sr, subtype='PCM_16')
    mp3 = out / f'{tid}.mp3'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', str(wav), '-codec:a', 'libmp3lame', '-b:a', '160k', str(mp3)], check=True)
    print(f"{mp3}  ({len(chart['notes'])} taps clicked over {len(y) / sr:.1f} s)")

if __name__ == '__main__':
    main(*sys.argv[1:3])
