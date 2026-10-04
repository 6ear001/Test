#!/usr/bin/env python3
"""Erzeugt die Tonspur (Effekte + leichter Beat) aus der Effektliste des Videos. Aufruf: make-audio.py sfx.json out.wav"""
import json, sys, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)
spec = json.load(open(sys.argv[1]))
dur = spec["duration"]
n = int((dur + 1) * SR)
mix = np.zeros(n)

def add(t, sig, gain=1.0):
    i = int(t * SR)
    if i >= n: return
    j = min(n, i + len(sig))
    mix[i:j] += sig[: j - i] * gain

def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.003, k=6.0):
    t = tt(d); return np.minimum(t / a, 1) * np.exp(-k * t / d)
def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y
def noise(d): return rng.uniform(-1, 1, int(d * SR))

def pop():
    t = tt(0.11); f = 900 * np.exp(-t * 18) + 250; return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.11, 0.002, 5)
def thud():
    t = tt(0.35); f = 110 * np.exp(-t * 9) + 42; return (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * lowpass(noise(0.35), 600)) * env(0.35, 0.002, 6)
def boom():
    t = tt(1.1); f = 80 * np.exp(-t * 3) + 36; s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(1.1, 0.002, 4); return s + 0.5 * lowpass(noise(1.1), 400) * env(1.1, 0.002, 7)
def whoosh():
    d = 0.5; x = noise(d); t = tt(d); k = np.sin(np.pi * t / d) ** 1.5
    y = lowpass(x, 2500) - lowpass(x, 300); return y * k * 1.6
def riser():
    d = 0.8; t = tt(d); f = 200 + 2200 * (t / d) ** 2; s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 + (lowpass(noise(d), 4000) - lowpass(noise(d), 500)) * 0.6
    return s * (t / d) ** 1.5
def beep():
    d = 0.09; t = tt(d); s = np.sign(np.sin(2 * np.pi * 1900 * t)) * 0.35 + np.sin(2 * np.pi * 3800 * t) * 0.1; return s * np.minimum(t / 0.002, 1) * np.minimum((d - t) / 0.01, 1)
def tick():
    d = 0.05; t = tt(d); return (np.sin(2 * np.pi * 2600 * t) * 0.5 + noise(d) * 0.3) * np.exp(-t * 90)
def click():
    d = 0.06; t = tt(d); return (np.sin(2 * np.pi * 1200 * t) * 0.6 + noise(d) * 0.4) * np.exp(-t * 70)
def ding():
    d = 1.0; t = tt(d); return (np.sin(2 * np.pi * 1318 * t) + 0.45 * np.sin(2 * np.pi * 2637 * t) + 0.2 * np.sin(2 * np.pi * 3951 * t)) * np.exp(-t * 4.5) * 0.5
def kaching():
    a = np.zeros(int(0.9 * SR)); d1 = ding()[: int(0.5 * SR)]; a[: len(d1)] += d1 * 0.6
    t = tt(0.5); b = (np.sin(2 * np.pi * 2093 * t) + 0.5 * np.sin(2 * np.pi * 4186 * t)) * np.exp(-t * 6) * 0.6; a[int(0.09 * SR): int(0.09 * SR) + len(b)] += b
    return a
def pr():
    d = 0.9; out = np.zeros(int(d * SR)); step = int(SR / 28)
    for i in range(0, len(out) - 400, step):
        burst = (lowpass(noise(0.012), 5000) - lowpass(noise(0.012), 1200)) * 2.2; out[i: i + len(burst)] += burst
    return out * np.minimum(tt(d) / 0.05, 1) * np.minimum((d - tt(d)) / 0.1, 1) * 0.8
def drawer():
    d = 0.6; s = (lowpass(noise(d), 1800) - lowpass(noise(d), 200)) * np.minimum(tt(d) / 0.1, 1) * 1.2; s = s * np.exp(-tt(d) * 1.5); return np.concatenate([s, thud()[:int(0.2 * SR)] * 0.7])

BANK = {"pop": (pop, 0.55), "thud": (thud, 0.9), "boom": (boom, 1.0), "whoosh": (whoosh, 0.55), "riser": (riser, 0.5), "beep": (beep, 0.5), "tick": (tick, 0.5),
        "click": (click, 0.6), "ding": (ding, 0.5), "kaching": (kaching, 0.7), "print": (pr, 0.5), "drawer": (drawer, 0.7)}
cache = {}
for t, name in spec["sfx"]:
    if name not in cache: cache[name] = BANK[name][0]()
    add(t, cache[name], BANK[name][1])

# leichter Beat ab spec["music_from"]
m0 = spec.get("music_from")
if m0 is not None:
    bpm = 108; beat = 60 / bpm; t = m0; i = 0
    kick = thud()[: int(0.25 * SR)]; hat = (lowpass(noise(0.05), 9000) - lowpass(noise(0.05), 5000)) * np.exp(-tt(0.05) * 70) * 3
    notes = [82.4, 82.4, 98.0, 110.0]
    while t < dur - 0.2:
        g = min(1, (t - m0) / 1.5 + 0.35) * min(1, (dur - 0.2 - t) / 1.0)
        if i % 1 == 0: add(t, kick, 0.5 * g)
        add(t + beat / 2, hat, 0.25 * g)
        if i % 2 == 1:
            clap = lowpass(noise(0.12), 3500) * np.exp(-tt(0.12) * 35); add(t, clap, 0.35 * g)
        tb = tt(beat * 0.9); f = notes[(i // 2) % 4]; add(t, np.sin(2 * np.pi * f * tb) * np.exp(-tb * 3) * 0.28 * g)
        t += beat; i += 1

fade = np.ones(n); f0 = int((dur - 0.35) * SR); fade[f0:] = np.linspace(1, 0, n - f0)
mix *= fade
mix = np.tanh(mix * 1.2); mix = mix / max(1e-6, np.abs(mix).max()) * 0.85
pcm = (mix[: int(dur * SR)] * 32767).astype("<i2")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("audio ok", dur)
