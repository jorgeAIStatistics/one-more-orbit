"""Lays the sound under a recording made by rec5.mjs and encodes it.
   python mux.py <recDir> <out.mp4> level <audio file> <offset>        (a level: its song, from the clock's first frame)
   python mux.py <recDir> <out.mp4> cold <coldopen-src.wav>           (the cold open: the film, the bed until the slip,
                                                                       the loss from it, and the live sounds of the hold and the heaves)"""
import json, os, sys, shutil, subprocess
import numpy as np, soundfile as sf
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
rec, out, kind = sys.argv[1], sys.argv[2], sys.argv[3]
J = json.load(open(f'{rec}/frames.json')); F = J['frames']
t0, t1 = F[0]['song'], F[-1]['song']
seq = f'{rec}/seq'; shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
k = 0; n = 0
while True:
    T = t0 + n / 30
    if T > t1: break
    while k + 1 < len(F) and F[k + 1]['song'] <= T: k += 1
    os.link(f"{rec}/{F[k]['name']}", f'{seq}/s{n:05d}.jpg'); n += 1
dur = n / 30
SR = 44100
if kind == 'level':
    src, off = sys.argv[4], float(sys.argv[5])
    subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', f'{off + t0:.3f}', '-t', f'{dur:.3f}', '-i', src, '-ar', str(SR), '-ac', '2', f'{rec}/a.wav'], check=True)
else:
    x, sr = sf.read(sys.argv[4]); assert sr == SR
    ev = J['ev']; scene = [e[1] for e in ev if e[0] == 'scene'][0]
    slip, touch, heaves = scene['slip'], scene['touch'], scene['heaves']
    total = slip + 11.6
    a = np.zeros((int(total * SR), 2))
    a[:int(20 * SR)] = x[:int(20 * SR)]
    bed = x[int(20 * SR):int(30 * SR)]; i = int(20 * SR)
    while i < int(slip * SR): m = min(len(bed), int(slip * SR) - i); a[i:i + m] = bed[:m]; i += m
    fade = int(0.6 * SR); a[int(slip * SR):int(slip * SR) + fade] *= np.linspace(1, 0, fade)[:, None]
    b = x[int(30 * SR):int(42 * SR)]; j = int(slip * SR); m = min(len(b), len(a) - j); a[j:j + m] += b[:m]
    # the live sounds, as the game makes them
    def place(t, sig, g=1.0):
        j = int(t * SR)
        if j < 0 or j >= len(a): return
        m = min(len(sig), len(a) - j); a[j:j + m, 0] += sig[:m] * g; a[j:j + m, 1] += sig[:m] * g
    def thud(f0, f1, dur, g):
        t = np.arange(int(dur * SR)) / SR; f = f0 * (f1 / f0) ** (t / dur); ph = 2 * np.pi * np.cumsum(f) / SR
        return np.sin(ph) * np.minimum(1, t / 0.008) * np.exp(-t / (dur / 5)) * g
    def pluck(midi, g):
        t = np.arange(int(0.26 * SR)) / SR; w = 2 * np.pi * 440 * 2 ** ((midi - 69) / 12)
        return (np.sin(w * t) * 0.6 + np.sin(2 * w * t) * 0.25 * np.exp(-t * 20) + np.sin(3 * w * t) * 0.12 * np.exp(-t * 30)) * np.minimum(1, t / 0.003) * np.exp(-t * 15) * 0.55 * g
    rng = np.random.default_rng(3)
    def hiss(dur, g, lo, hi):
        from scipy.signal import butter, sosfilt
        nn = rng.standard_normal(int(dur * SR)); y = sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), nn)
        return y * np.exp(-np.arange(len(y)) / SR / (dur / 4)) * g
    downs = [e for e in ev if e[0] in ('down', 'up')]
    held = lambda t: any(d[0] == 'down' and d[1] <= t and not any(u[0] == 'up' and d[1] < u[1] <= t for u in downs) for d in downs)
    # the heartbeat, quickening with the hold and the closeness; steady and fast in the pull; it stops at the slip
    t = 20.0; gap = 1.0
    while t < slip:
        close = min(1, max(0, (t - 20) / max(0.1, touch - 20)))
        rate = 0.5 if t > touch else (0.45 + 0.55 * (1 - close)) if held(t) else 0.8
        place(t, thud(70, 38, 0.22, 0.55)); place(t + 0.26 * min(1, rate), thud(64, 36, 0.22, 0.36)); t += rate
    # the swell: a rising string-like tone while he reaches (louder and brighter while held), ending at the touch
    from scipy.signal import butter, sosfilt
    nS = int((touch - 20) * SR); ts = np.arange(nS) / SR
    close = np.clip(ts / max(0.1, touch - 20), 0, 1)
    hz = 98 * (1 + 0.5 * close); ph = 2 * np.pi * np.cumsum(hz) / SR
    saw = sum(np.sin(k2 * ph) / k2 for k2 in range(1, 9)) + 0.6 * sum(np.sin(k2 * ph * 1.505) / k2 for k2 in range(1, 6))
    gain = np.array([0.025 + 0.06 * c if held(20 + q / SR) else 0.012 + 0.02 * c for q, c in zip(range(0, nS), close)]) if nS < 2e6 else 0
    sw = sosfilt(butter(2, 1200, 'low', fs=SR, output='sos'), saw * gain) * 1.6
    place(20.0, sw)
    for q in np.arange(20.0, touch, 0.09):
        if held(q): place(q, hiss(0.08, 0.035, 3000, 8000))
    place(touch, pluck(80, 0.6)); place(touch, pluck(92, 0.25))
    notes = [72, 75, 80]
    for i, h in enumerate(heaves):
        place(h, thud(82, 42, 0.3, 0.7)); place(h + 0.02, hiss(0.32, 0.12, 380, 900))
        if i < 3: place(h, pluck(notes[i], 0.5 + 0.15 * i)); place(h, pluck(notes[i] + 12, 0.18 + 0.06 * i))
        else: place(h, hiss(0.02, 0.25, 1800, 4000))
    if len(heaves) >= 3:
        h3, h4 = heaves[2], heaves[3]; nH = int((h4 - h3) * SR); th = np.arange(nH) / SR
        chord = sum(np.sin(2 * np.pi * 440 * 2 ** ((m2 - 69) / 12) * th) for m2 in (68, 72, 75, 80)) * 0.05 * (1 - np.exp(-th / 0.35))
        place(h3, chord)
    a = a[int(t0 * SR):int((t0 + dur) * SR)]
    pk = np.abs(a).max()
    if pk > 0.95: a *= 0.95 / pk
    sf.write(f'{rec}/a.wav', a, SR)
subprocess.run([FF, '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{seq}/s%05d.jpg', '-i', f'{rec}/a.wav', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-vf', 'scale=390:844', '-c:a', 'aac', '-b:a', '160k', '-shortest', out], check=True)
print(out, f'{dur:.1f} s from clock {t0:.2f}', os.path.getsize(out) // 1024, 'KB')
