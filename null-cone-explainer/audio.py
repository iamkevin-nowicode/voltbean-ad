"""
Soundtrack, synthesized from scratch with numpy:
a soft music-box + pad score and little sound effects synced to scene cues.
"""
import wave

import numpy as np

from scenes import SFX, TOTAL

SR = 48000
N = int(TOTAL * SR) + SR
rng = np.random.default_rng(3)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_adsr(n, a, r, sr=SR):
    e = np.ones(n)
    na, nr = int(a * sr), int(r * sr)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def add(buf, start, sig, gain=1.0):
    i0 = int(start * SR)
    if i0 >= len(buf):
        return
    sig = sig[: len(buf) - i0]
    buf[i0:i0 + len(sig)] += sig * gain


# ------------------------------------------------------------------ music
BPM = 80
BEAT = 60 / BPM
BAR = 4 * BEAT
# Cmaj9, Am9, Fmaj7(#11-ish), G6/9 -- dreamy and warm
CHORDS = [
    [48, 55, 59, 62, 64],
    [45, 52, 55, 59, 60],
    [41, 48, 52, 57, 59],
    [43, 50, 55, 57, 62],
]
ARP = [0, 2, 3, 4, 3, 2, 4, 1]

L = np.zeros(N)
R = np.zeros(N)


def pad_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for det, pan in ((-0.004, 0), (0.0, 0), (0.0041, 0)):
        ff = f * (1 + det)
        s += np.sin(2 * np.pi * ff * t + rng.uniform(0, 6)) + 0.18 * np.sin(4 * np.pi * ff * t)
    s *= env_adsr(n, 1.4, 1.6)
    s *= 1 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
    return s / 3


def box_note(f, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.exp(-t * 3.2) * np.minimum(1, t / 0.004)
    s = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6) \
        + 0.12 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 9)
    return s * e


def bass_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return s * env_adsr(n, 0.05, 0.6) * np.exp(-t * 0.6)


music_end = TOTAL - 2.0
t = 0.0
bar = 0
while t < music_end:
    ch = CHORDS[(bar // 2) % 4]
    if bar % 2 == 0:
        dur = 2 * BAR + 1.6
        for nn in ch[1:]:
            p = pad_note(midi(nn + 12), dur)
            add(L, t, p, 0.045)
            add(R, t + 0.012, p, 0.045)
        add(L, t, bass_note(midi(ch[0] - 12 + 12), 2 * BAR), 0.10)
        add(R, t, bass_note(midi(ch[0] - 12 + 12), 2 * BAR), 0.10)
    # music box arpeggio (enters after the title builds)
    if t >= BAR * 1:
        for i in range(8):
            idx = ARP[(i + bar * 3) % 8]
            nn = ch[idx] + 24
            if (i + bar) % 7 == 6:
                continue  # breathe
            vel = 0.055 if i % 2 == 0 else 0.04
            pan = 0.5 + 0.35 * np.sin(i * 1.3 + bar)
            note = box_note(midi(nn))
            add(L, t + i * BEAT / 2, note, vel * (1.2 - pan))
            add(R, t + i * BEAT / 2, note, vel * (0.2 + pan))
    t += BAR
    bar += 1

# soft final chord
for nn in CHORDS[0]:
    p = box_note(midi(nn + 24), 4.0)
    add(L, music_end, p, 0.05)
    add(R, music_end + 0.01, p, 0.05)

# ------------------------------------------------------------------ sfx
def sfx(kind, k=0):
    if kind == "pop":
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        f = 300 + 700 * np.exp(-t * 30)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * 0.9
    if kind == "blip":
        n = int(0.11 * SR)
        t = np.arange(n) / SR
        f = 1150 + 150 * (k % 4)
        return np.sin(2 * np.pi * f * t) * np.exp(-t * 40) * 0.5
    if kind == "tink":
        n = int(0.25 * SR)
        t = np.arange(n) / SR
        f = midi(84 + [0, 2, 4, 7, 9][k % 5])
        return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.7 * f * t)) * np.exp(-t * 18) * 0.35
    if kind == "chime":
        n = int(2.2 * SR)
        t = np.arange(n) / SR
        s = np.zeros(n)
        for j, nn in enumerate((84, 88, 91)):
            f = midi(nn)
            d = int(j * 0.07 * SR)
            part = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 4)) \
                * np.exp(-t * 2.2)
            s[d:] += part[: n - d]
        return s * 0.35
    if kind == "whoosh":
        n = int(0.9 * SR)
        t = np.arange(n) / SR
        noise = rng.standard_normal(n)
        # moving-average lowpass with sweeping width = soft airy whoosh
        cs = np.cumsum(noise)
        w = (40 - 32 * np.sin(np.pi * t / 0.9)).astype(int)
        idx = np.arange(n)
        lo = np.clip(idx - w, 0, n - 1)
        s = (cs - cs[lo]) / w
        return s * np.sin(np.pi * t / 0.9) ** 2 * 0.5
    if kind == "boing":
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        f = 330 + 140 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 6) + 120 * t
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) * 0.55
    if kind == "tick":
        n = int(0.06 * SR)
        t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 2400 * t) * 0.6 + rng.standard_normal(n) * 0.2) * np.exp(-t * 120) * 0.6
    if kind == "thud":
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        f = 60 + 90 * np.exp(-t * 20)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12) * 0.8
    if kind == "hop":
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        f = 420 + 900 * t / 0.16
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * 0.4
    if kind == "wobble":
        n = int(1.4 * SR)
        t = np.arange(n) / SR
        f = 170 + 40 * np.sin(2 * np.pi * 5 * t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 1.4) * 0.45
    return np.zeros(10)


counts = {}
for (ts, kind) in sorted(SFX):
    k = counts.get(kind, 0)
    counts[kind] = k + 1
    s = sfx(kind, k)
    pan = 0.5 + 0.25 * np.sin(ts * 1.7)
    add(L, ts, s, 0.22 * (1.2 - pan))
    add(R, ts, s, 0.22 * (0.2 + pan))

# ------------------------------------------------------------------ reverb (FFT convolution)
def reverb(x, seed):
    g = np.random.default_rng(seed)
    n_ir = int(2.4 * SR)
    t = np.arange(n_ir) / SR
    ir = g.standard_normal(n_ir) * np.exp(-t * 2.6)
    ir[0] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n_ir)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return y


wetL, wetR = reverb(L, 1), reverb(R, 2)
L = L + 0.28 * wetL
R = R + 0.28 * wetR

# fades
tt = np.arange(N) / SR
fade = np.clip(tt / 1.5, 0, 1) * np.clip((TOTAL + 0.5 - tt) / 2.5, 0, 1)
L *= fade
R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * 0.89, R / peak * 0.89

out = np.stack([L, R], axis=1)[: int(TOTAL * SR)]
pcm = (out * 32767).astype(np.int16)
import sys
path = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
with wave.open(path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", path, f"{TOTAL:.1f}s", len(SFX), "sfx cues")
