import numpy as np, scipy.signal as ss
SR = 44100
HOP = 49            # 900 Hz envelope rate
ER = SR / HOP
WAV = None
def load(k, d):
    y = np.load(f"{d}/{k}.npy")
    return y.mean(1).astype(np.float64)

def band(y, lo=None, hi=None, order=4):
    if lo and hi: sos = ss.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos')
    elif lo: sos = ss.butter(order, lo, 'highpass', fs=SR, output='sos')
    else: sos = ss.butter(order, hi, 'lowpass', fs=SR, output='sos')
    return ss.sosfiltfilt(sos, y)

def env(y, smooth_ms=8.0):
    """energy envelope at 900 Hz, zero-phase smoothed"""
    p = y * y
    w = ss.windows.hann(int(SR * smooth_ms / 1000) | 1); w /= w.sum()
    p = ss.fftconvolve(p, w, mode='same')
    n = len(p) // HOP
    return p[:n * HOP].reshape(n, HOP).mean(1)

def novelty(e, lag_ms=12.0):
    c = np.log1p(e / (np.percentile(e, 95) * 1e-3 + 1e-12))   # compressed
    k = max(1, int(round(lag_ms / 1000 * ER)))
    d = np.zeros_like(c); d[k:] = c[k:] - c[:-k]
    d = np.maximum(d, 0)
    # centre the difference so the peak sits on the steepest point
    return np.roll(d, -(k // 2))

def peaks(nov, min_sep_ms=45, thr=None):
    if thr is None: thr = np.percentile(nov, 90) * 0.5
    idx, pr = ss.find_peaks(nov, height=thr, distance=int(min_sep_ms / 1000 * ER))
    # parabolic refine
    t = []
    for i in idx:
        if 0 < i < len(nov) - 1:
            a, b, c = nov[i - 1], nov[i], nov[i + 1]
            den = a - 2 * b + c
            off = 0.5 * (a - c) / den if den != 0 else 0
        else: off = 0
        t.append((i + off + 0.5) / ER)     # +0.5: block centre
    return np.array(t), pr['peak_heights']

def comb_score(t, w, bpm, sub=1, sigma=0.008):
    """best phase + score for a grid of period 60/bpm/sub"""
    T = 60.0 / bpm / sub
    ph = np.mod(t, T) / T * 2 * np.pi
    # circular mean as phase estimate, then gaussian score
    z = (w * np.exp(1j * ph)).sum()
    phi = (np.angle(z) % (2 * np.pi)) / (2 * np.pi) * T
    d = np.mod(t - phi + T / 2, T) - T / 2
    return float((w * np.exp(-(d / sigma) ** 2)).sum() / w.sum()), phi, abs(z) / w.sum()

def linfit(t, w, T, phi, tol=0.02, iters=6):
    for _ in range(iters):
        n = np.round((t - phi) / T)
        d = t - (phi + n * T)
        m = np.abs(d) < tol
        A = np.vstack([np.ones(m.sum()), n[m]]).T
        W = np.sqrt(w[m])
        sol, *_ = np.linalg.lstsq(A * W[:, None], t[m] * W, rcond=None)
        phi, T = sol
    n = np.round((t - phi) / T); d = t - (phi + n * T); m = np.abs(d) < tol
    return T, phi, m, d
