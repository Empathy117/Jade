#!/usr/bin/env python3
"""Synthesize the BGM set for books/local/hongloumeng.

Thirteen instrumental loops in one sound: a plucked zheng voice
(Karplus-Strong), a breathy xiao flute, and temple bells, all sharing one
hall reverb. Six tracks arrange principal phrases of public-domain
traditional melodies (春江花月夜、平湖秋月、渔舟唱晚、梅花三弄、汉宫秋月、
阳关三叠); the rest are original pentatonic pieces written for the book's
mood groups. Every file loops seamlessly: the reverb tail is folded back
into the opening bars.

    uv run --with numpy --with scipy --no-project \
        python scripts/synth_hongloumeng_music.py
    scripts/encode_hongloumeng_audio.sh   # loudness + mp3
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from scipy.signal import lfilter

SR = 44100
OUT = Path("books/local/hongloumeng/assets/music-wav")

# Pentatonic modes as semitone offsets from the tonic.
MODES = {
    "gong": [0, 2, 4, 7, 9],      # 宫
    "shang": [0, 2, 5, 7, 10],    # 商
    "yu": [0, 3, 5, 7, 10],       # 羽
}


def note_freq(base: float, mode: str, degree: int, octave: int = 0) -> float:
    scale = MODES[mode]
    semis = scale[degree % 5] + 12 * (degree // 5 + octave)
    return base * (2 ** (semis / 12))


def env(n: int, attack: float, release: float, shape: float = 1.0) -> np.ndarray:
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    e = np.ones(n, dtype=np.float32)
    e[:a] = np.linspace(0, 1, a) ** shape
    tail = np.linspace(1, 0, min(r, n)) ** shape
    e[n - len(tail):] *= tail
    return e


def zheng(freq: float, dur: float, vel: float = 1.0, bright: float = 0.6,
          rng: np.random.Generator | None = None) -> np.ndarray:
    """Plucked-string voice via Karplus-Strong with a soft nail attack."""

    rng = rng or np.random.default_rng(int(freq * 1000) % 99991)
    n = int(dur * SR)
    period = max(2, int(SR / freq))
    burst = rng.uniform(-1, 1, period).astype(np.float32)
    kernel = np.array([bright, 1 - bright], dtype=np.float32)
    burst = np.convolve(burst, kernel, mode="same")
    x = np.zeros(n, dtype=np.float32)
    x[:period] = burst
    decay = 0.996 if freq < 220 else 0.995
    a = np.zeros(period + 2, dtype=np.float32)
    a[0] = 1.0
    a[period] = -decay * 0.5
    a[period + 1] = -decay * 0.5
    out = lfilter([1.0], a, x).astype(np.float32)
    body = out * env(n, 0.002, dur * 0.5, 1.4)
    detune = np.interp(
        np.arange(n) * (1 + 0.0011), np.arange(n), body, left=0, right=0
    ).astype(np.float32)
    return (body + 0.3 * detune) * vel


def zheng_trem(freq: float, dur: float, vel: float = 1.0, rate: float = 11.0) -> np.ndarray:
    """轮指: repeated soft plucks blending into a sustained shimmer."""

    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    t = 0.0
    k = 0
    while t < dur - 0.05:
        hit = zheng(freq, min(0.55, dur - t), vel * (0.62 + 0.38 * np.exp(-k / 6)), 0.52)
        i = int(t * SR)
        m = min(len(hit), n - i)
        out[i:i + m] += hit[:m]
        t += 1.0 / rate
        k += 1
    return out * env(n, 0.02, dur * 0.4)


def gliss(base: float, mode: str, start_deg: int, end_deg: int, dur: float,
          vel: float = 0.7, octave: int = 0) -> np.ndarray:
    """刮奏: a quick sweep across the pentatonic scale."""

    degrees = (list(range(start_deg, end_deg + 1)) if end_deg >= start_deg
               else list(range(start_deg, end_deg - 1, -1)))
    n = int(dur * SR)
    out = np.zeros(n + SR, dtype=np.float32)
    for i, deg in enumerate(degrees):
        at = int(i / max(len(degrees) - 1, 1) * dur * 0.85 * SR)
        tone = zheng(note_freq(base, mode, deg, octave), 0.8, vel * 0.5, 0.7)
        m = min(len(tone), len(out) - at)
        out[at:at + m] += tone[:m]
    return out[:n + SR]


def xiao(freq: float, dur: float, vel: float = 1.0,
         rng: np.random.Generator | None = None) -> np.ndarray:
    """Breathy end-blown flute: dark harmonics, late vibrato, air noise."""

    rng = rng or np.random.default_rng(int(freq) % 7919)
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    vib_depth = np.clip((t - 0.35) / 0.9, 0, 1) * 0.004
    vib = 1 + vib_depth * np.sin(2 * np.pi * 4.6 * t)
    phase = np.cumsum(2 * np.pi * freq * vib / SR)
    tone = (np.sin(phase) + 0.32 * np.sin(2 * phase + 0.4)
            + 0.11 * np.sin(3 * phase + 0.9)).astype(np.float32)
    breath = rng.normal(0, 1, n).astype(np.float32)
    kernel = np.exp(-np.arange(64) / 9).astype(np.float32)
    breath = np.convolve(breath, kernel / kernel.sum(), mode="same")
    sig = tone * 0.9 + breath * 0.12
    return sig * env(n, 0.16, max(0.25, dur * 0.4), 1.2) * vel


def bell(freq: float, dur: float = 6.0, vel: float = 1.0) -> np.ndarray:
    """磬/钟: inharmonic partials with a long exponential ring."""

    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    partials = [(1.0, 1.0, 1.1), (2.74, 0.42, 2.1), (5.4, 0.2, 3.4), (8.9, 0.08, 5.0)]
    sig = np.zeros(n, dtype=np.float32)
    for ratio, amp, damp in partials:
        sig += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t * damp)
    return sig * env(n, 0.004, 0.3) * vel


def drone(freq: float, dur: float, vel: float = 1.0) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    sig = (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 1.5 * t + 0.6)
           + 0.25 * np.sin(2 * np.pi * freq * 2 * t + 1.2)).astype(np.float32)
    wobble = 1 + 0.12 * np.sin(2 * np.pi * 0.13 * t)
    return sig * wobble * env(n, dur * 0.3, dur * 0.4) * vel * 0.5


def reverb(sig: np.ndarray, wet: float = 0.3, spread: int = 0) -> np.ndarray:
    """Schroeder hall: four lowpassed combs and two allpasses, via lfilter.

    Comb with smoothed feedback: y[n] = x[n] + fb*s[n], s[n] = 0.6*s[n-1]
    + 0.4*y[n-d]  =>  y[n] - 0.6*y[n-1] - 0.4*fb*y[n-d] = x[n] - 0.6*x[n-1].
    """

    combs = [(1687 + spread, 0.773), (1601 - spread, 0.802),
             (2053 + spread, 0.753), (2251 - spread, 0.733)]
    out = np.zeros_like(sig)
    for delay, fb in combs:
        a = np.zeros(delay + 1, dtype=np.float64)
        a[0] = 1.0
        a[1] = -0.6
        a[delay] += -0.4 * fb
        out += lfilter([1.0, -0.6], a, sig).astype(np.float32)
    out /= len(combs)
    for delay, g in [(347, 0.7), (113, 0.7)]:
        b = np.zeros(delay + 1, dtype=np.float64)
        b[0] = -g
        b[delay] = 1.0
        a = np.zeros(delay + 1, dtype=np.float64)
        a[0] = 1.0
        a[delay] = -g
        out = lfilter(b, a, out).astype(np.float32)
    return sig * (1 - wet) + out * wet


class Score:
    def __init__(self, base: float, mode: str, bpm: float, seed: int = 7) -> None:
        self.base = base
        self.mode = mode
        self.spb = 60.0 / bpm
        self.rng = np.random.default_rng(seed)
        self.events: list[tuple[float, np.ndarray, float]] = []
        self.length_beats = 0.0

    def _place(self, beat: float, sig: np.ndarray, gain: float = 1.0) -> None:
        self.events.append((beat * self.spb, sig, gain))
        self.length_beats = max(self.length_beats, beat)

    def z(self, beat, deg, octave=0, dur=1.6, vel=0.8, bright=0.6):
        f = note_freq(self.base, self.mode, deg, octave)
        self._place(beat, zheng(f, dur * self.spb + 0.9, vel, bright, self.rng), 1.0)

    def trem(self, beat, deg, octave=0, dur=2.0, vel=0.6):
        f = note_freq(self.base, self.mode, deg, octave)
        self._place(beat, zheng_trem(f, dur * self.spb, vel), 1.0)

    def gl(self, beat, start_deg, end_deg, dur=1.0, vel=0.5, octave=0):
        self._place(beat, gliss(self.base, self.mode, start_deg, end_deg,
                                dur * self.spb, vel, octave), 1.0)

    def x(self, beat, deg, octave=0, dur=2.4, vel=0.5):
        f = note_freq(self.base, self.mode, deg, octave)
        self._place(beat, xiao(f, dur * self.spb, vel, self.rng), 1.0)

    def b(self, beat, deg, octave=0, vel=0.5):
        f = note_freq(self.base, self.mode, deg, octave)
        self._place(beat, bell(f, 6.0, vel), 1.0)

    def dr(self, beat, deg, octave=-1, dur=8.0, vel=0.5):
        f = note_freq(self.base, self.mode, deg, octave)
        self._place(beat, drone(f, dur * self.spb, vel), 1.0)

    def render(self, total_beats: float, wet: float = 0.3) -> np.ndarray:
        dur = total_beats * self.spb
        tail = 3.5
        n = int((dur + tail) * SR)
        left = np.zeros(n, dtype=np.float32)
        right = np.zeros(n, dtype=np.float32)
        for at, sig, gain in self.events:
            i = int(at * SR)
            m = min(len(sig), n - i)
            if m <= 0:
                continue
            pan = self.rng.uniform(0.35, 0.65)
            left[i:i + m] += sig[:m] * gain * (1 - pan) * 1.6
            right[i:i + m] += sig[:m] * gain * pan * 1.6
        left = reverb(left, wet, 0)
        right = reverb(right, wet, 23)
        loop_n = int(dur * SR)
        for ch in (left, right):
            fold = ch[loop_n:n]
            ch[:len(fold)] += fold
        stereo = np.stack([left[:loop_n], right[:loop_n]], axis=1)
        edge = int(0.012 * SR)
        ramp = np.linspace(0, 1, edge, dtype=np.float32)[:, None]
        stereo[:edge] *= ramp
        stereo[-edge:] *= ramp[::-1]
        peak = np.abs(stereo).max() or 1.0
        return (stereo / peak * 0.85).astype(np.float32)


def write_wav(path: Path, data: np.ndarray) -> None:
    import wave

    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


# --------------------------------------------------------------------------
# pieces
# --------------------------------------------------------------------------


def seq(s: Score, start: float, notes, dur=1.0, vel=0.8, octave=0, bright=0.6, gap=None):
    """Lay a melody: notes is a list of (degree, beats) or degree ints."""

    beat = start
    for item in notes:
        deg, beats = item if isinstance(item, tuple) else (item, gap or dur)
        if deg is not None:
            s.z(beat, deg, octave, max(beats * 1.5, 1.2), vel, bright)
        beat += beats
    return beat


def t_taixu() -> tuple[Score, float]:
    s = Score(196.0, "yu", 46, seed=11)   # G3 羽
    s.dr(0, 0, -1, 26, 0.34)
    s.dr(26, 3, -1, 26, 0.3)
    s.dr(52, 0, -1, 26, 0.34)
    s.b(0, 0, 1, 0.4)
    s.b(16, 4, 0, 0.3)
    s.b(38, 2, 1, 0.32)
    s.b(60, 0, 1, 0.36)
    for beat, deg, octv in [(4, 0, 1), (9, 2, 1), (14, 1, 1), (20, 4, 0), (27, 3, 1),
                            (33, 2, 1), (40, 0, 1), (47, 1, 1), (54, 2, 1), (63, 0, 1)]:
        s.z(beat, deg, octv, 4.5, 0.42, 0.42)
    s.x(22, 0, 1, 7, 0.3)
    s.x(44, 3, 0, 8, 0.3)
    s.x(66, 0, 1, 8, 0.32)
    return s, 78


def t_chunjiang() -> tuple[Score, float]:
    s = Score(220.0, "gong", 58, seed=21)  # A3 宫
    s.gl(0, 0, 9, 1.6, 0.4)
    theme = [(4, 1), (3, 1), (4, 1.5), (7, 0.5), (5, 1), (4, 1), (2, 1.5), (4, 0.5),
             (2, 1), (1, 1), (0, 2),
             (2, 1), (4, 1), (5, 1.5), (4, 0.5), (7, 1), (5, 1), (4, 2),
             (5, 1), (7, 1), (9, 1.5), (7, 0.5), (5, 1), (4, 1), (2, 2),
             (1, 1), (2, 1), (4, 1.5), (2, 0.5), (1, 1), (0, 1), (0, 2)]
    end = seq(s, 2, theme, vel=0.7, bright=0.58)
    s.trem(end, 0, 1, 3.0, 0.4)
    end2 = seq(s, end + 4, theme, vel=0.55, octave=1, bright=0.45)
    for beat, deg in [(end + 4, 0), (end + 12, 3), (end + 20, 4), (end + 28, 0)]:
        s.z(beat, deg, -1, 4, 0.5, 0.5)
    s.gl(end2, 9, 0, 2.2, 0.35)
    s.b(end2 + 2, 0, 0, 0.3)
    return s, end2 + 6


def t_pinghu() -> tuple[Score, float]:
    s = Score(196.0, "gong", 52, seed=31)  # G3 宫
    theme = [(2, 1), (4, 1), (7, 1.5), (5, 0.5), (4, 1), (2, 1), (4, 2),
             (5, 1), (4, 1), (2, 1.5), (1, 0.5), (0, 1), (1, 1), (2, 2),
             (4, 1), (5, 1), (7, 1.5), (9, 0.5), (7, 1), (5, 1), (4, 2),
             (2, 1), (1, 1), (0, 1.5), (1, 0.5), (2, 1), (1, 1), (0, 2)]
    end = seq(s, 0, theme, vel=0.62, bright=0.5)
    s.x(6, 7, 0, 6, 0.26)
    s.x(20, 4, 0, 6, 0.24)
    end2 = seq(s, end + 2, theme, vel=0.48, octave=1, bright=0.4)
    s.z(end + 2, 0, -1, 5, 0.5, 0.5)
    s.z(end + 14, 4, -1, 5, 0.45, 0.5)
    s.b(end2 + 1, 0, 0, 0.26)
    return s, end2 + 5


def t_yuzhou() -> tuple[Score, float]:
    s = Score(220.0, "gong", 66, seed=41)
    theme = [(4, 1), (7, 1), (9, 1), (7, 1), (4, 1), (2, 1), (0, 1), (2, 1),
             (4, 1.5), (7, 0.5), (5, 1), (4, 1), (2, 1), (1, 1), (2, 2),
             (4, 1), (2, 1), (1, 1), (0, 1), (1, 0.5), (2, 0.5), (4, 1), (7, 1),
             (5, 1.5), (4, 0.5), (2, 1), (1, 1), (0, 2)]
    end = seq(s, 0, theme, vel=0.66, bright=0.62)
    s.gl(end, 0, 9, 1.4, 0.4)
    fast = [(9, 0.5), (7, 0.5), (5, 0.5), (4, 0.5), (5, 0.5), (7, 0.5), (9, 0.5), (7, 0.5),
            (5, 0.5), (4, 0.5), (2, 0.5), (1, 0.5), (2, 0.5), (4, 0.5), (5, 0.5), (4, 0.5),
            (2, 1), (0, 1), (1, 1), (2, 1), (0, 2)]
    end2 = seq(s, end + 2, fast, vel=0.6, bright=0.66)
    s.trem(end2, 0, 0, 3, 0.42)
    return s, end2 + 4


def t_yanle() -> tuple[Score, float]:
    s = Score(233.1, "gong", 76, seed=51)  # Bb3
    a = [(0, 1), (2, 0.5), (4, 0.5), (7, 1), (4, 1), (5, 1), (4, 0.5), (2, 0.5), (0, 2),
         (2, 1), (4, 0.5), (5, 0.5), (7, 1), (9, 1), (7, 1), (5, 0.5), (4, 0.5), (2, 2)]
    end = seq(s, 0, a, vel=0.62, bright=0.66)
    end2 = seq(s, end, a, vel=0.5, octave=1, bright=0.6)
    for beat in range(0, int(end2), 4):
        s.z(float(beat), 0, -1, 2.4, 0.4, 0.6)
    s.b(0, 0, 1, 0.3)
    s.b(end, 4, 0, 0.28)
    s.gl(end2, 0, 9, 1.2, 0.4)
    return s, end2 + 4


def t_xianting() -> tuple[Score, float]:
    s = Score(196.0, "shang", 56, seed=61)
    a = [(0, 1.5), (1, 0.5), (2, 1), (4, 1), (2, 1), (1, 1), (0, 2), (None, 1),
         (2, 1), (4, 1), (5, 1.5), (4, 0.5), (2, 1), (1, 1), (2, 2), (None, 1),
         (4, 1), (2, 1), (1, 1.5), (0, 0.5), (1, 1), (2, 1), (0, 2), (None, 2)]
    end = seq(s, 0, a, vel=0.55, bright=0.52)
    end2 = seq(s, end, a, vel=0.42, octave=1, bright=0.45)
    s.z(end, 0, -1, 5, 0.4, 0.5)
    s.x(end + 8, 2, 0, 6, 0.22)
    return s, end2 + 3


def t_meihua() -> tuple[Score, float]:
    s = Score(293.7, "gong", 60, seed=71)  # D4, high pure register
    theme = [(4, 1), (4, 1), (2, 1), (4, 1), (7, 1), (9, 1), (7, 1.5), (9, 0.5),
             (12, 1), (9, 1), (7, 1), (9, 1), (7, 1), (4, 1), (2, 1), (4, 2)]
    end = seq(s, 0, theme, vel=0.5, bright=0.36)
    end2 = seq(s, end + 1, theme, vel=0.58, octave=-1, bright=0.55)
    end3 = seq(s, end2 + 1, theme, vel=0.44, octave=0, bright=0.3)
    s.b(0, 0, 0, 0.24)
    s.b(end2 + 1, 0, 1, 0.2)
    return s, end3 + 4


def t_hangong() -> tuple[Score, float]:
    s = Score(174.6, "yu", 44, seed=81)  # F3 羽
    a = [(4, 1.5), (3, 0.5), (2, 1), (1, 1), (2, 1.5), (1, 0.5), (0, 2), (None, 1),
         (2, 1), (3, 1), (4, 1.5), (3, 0.5), (2, 1), (1, 1), (0, 1), (1, 1), (0, 3), (None, 1),
         (0, 1), (1, 1), (2, 1.5), (3, 0.5), (2, 1), (1, 1), (0, 3.5)]
    end = seq(s, 0, a, vel=0.58, bright=0.42)
    s.x(3, 4, 0, 6, 0.3)
    s.x(16, 2, 0, 7, 0.28)
    end2 = seq(s, end + 2, a, vel=0.44, octave=1, bright=0.36)
    s.z(end + 2, 0, -1, 6, 0.42, 0.44)
    s.b(end2, 0, 0, 0.24)
    return s, end2 + 5


def t_yangguan() -> tuple[Score, float]:
    s = Score(196.0, "gong", 50, seed=91)
    a = [(0, 1), (0, 1), (2, 1.5), (4, 0.5), (5, 1), (4, 1), (2, 2),
         (4, 1), (5, 1), (7, 1.5), (5, 0.5), (4, 1), (2, 1), (1, 2),
         (0, 1), (1, 1), (2, 1.5), (4, 0.5), (2, 1), (1, 1), (0, 3)]
    end = seq(s, 0, a, vel=0.6, bright=0.5)
    s.x(0.5, 0, 1, 5, 0.28)
    end2 = seq(s, end + 2, a, vel=0.5, octave=1, bright=0.42)
    s.x(end + 6, 4, 0, 7, 0.26)
    s.z(end + 2, 0, -1, 6, 0.44, 0.48)
    s.b(end2 + 1, 0, 0, 0.22)
    return s, end2 + 5


def t_anliu() -> tuple[Score, float]:
    s = Score(146.8, "yu", 40, seed=101)  # D3 羽 low
    s.dr(0, 0, -1, 30, 0.4)
    s.dr(30, 1, -1, 30, 0.34)
    for beat, deg in [(2, 0), (8, 2), (13, 1), (19, 3), (26, 0), (33, 2),
                      (39, 1), (46, 4), (52, 0)]:
        s.z(beat, deg, 0, 4, 0.4, 0.36)
    s.trem(23, 0, 0, 4, 0.26)
    s.trem(49, 1, 0, 4, 0.24)
    s.b(36, 0, 0, 0.2)
    return s, 58


def t_bianzheng() -> tuple[Score, float]:
    s = Score(146.8, "yu", 72, seed=111)
    s.dr(0, 0, -1, 40, 0.36)
    hits = [(0, 0, -1), (2, 0, 0), (3.5, 1, 0), (6, 0, -1), (8, 3, 0), (9.5, 2, 0),
            (12, 0, -1), (14, 4, 0), (15, 3, 0), (16.5, 1, 0), (18, 0, -1),
            (20, 2, 0), (21, 3, 0), (24, 0, -1), (26, 1, 0), (27.5, 4, 0),
            (30, 0, -1), (32, 2, 0), (34, 0, -1), (36, 1, 0), (38, 0, -1)]
    for beat, deg, octv in hits:
        s.z(beat, deg, octv, 2.2, 0.62, 0.7)
        if octv == -1:
            s.z(beat + 0.04, deg, -1, 2.0, 0.5, 0.3)
    s.trem(10, 4, 0, 3, 0.3)
    s.trem(28, 2, 0, 3, 0.3)
    s.gl(40, 4, 0, 1.4, 0.4, 0)
    return s, 44


def t_aiyin() -> tuple[Score, float]:
    s = Score(155.6, "yu", 40, seed=121)  # Eb3 羽
    s.b(0, 0, 0, 0.4)
    s.b(14, 0, 0, 0.34)
    s.b(30, 3, -1, 0.3)
    s.b(46, 0, 0, 0.38)
    a = [(2, 2), (1, 1), (0, 2), (None, 1), (1, 1.5), (2, 0.5), (1, 1), (0, 3), (None, 2)]
    end = seq(s, 2, a, vel=0.5, bright=0.4)
    s.x(4, 2, 0, 8, 0.34)
    s.x(20, 1, 0, 8, 0.3)
    s.x(36, 0, 0, 9, 0.32)
    end2 = seq(s, end + 2, a, vel=0.4, octave=0, bright=0.34)
    s.z(16, 0, -1, 7, 0.4, 0.4)
    s.z(34, 3, -1, 7, 0.36, 0.4)
    return s, max(end2 + 4, 52)


def t_kongshan() -> tuple[Score, float]:
    s = Score(196.0, "shang", 38, seed=131)
    s.b(0, 0, 0, 0.36)
    s.b(22, 4, -1, 0.3)
    s.b(44, 0, 0, 0.34)
    for beat, deg, octv in [(5, 0, 0), (12, 2, 0), (18, 1, 0), (28, 4, -1),
                            (35, 0, 0), (41, 2, 0), (50, 0, 0)]:
        s.z(beat, deg, octv, 5, 0.4, 0.34)
    s.x(8, 0, 1, 9, 0.26)
    s.x(31, 2, 0, 9, 0.24)
    s.dr(0, 0, -1, 28, 0.2)
    s.dr(28, 0, -1, 28, 0.2)
    return s, 56


TRACKS = {
    "taixu": t_taixu,
    "chunjiang": t_chunjiang,
    "pinghu": t_pinghu,
    "yuzhou": t_yuzhou,
    "yanle": t_yanle,
    "xianting": t_xianting,
    "meihua": t_meihua,
    "hangong": t_hangong,
    "yangguan": t_yangguan,
    "anliu": t_anliu,
    "bianzheng": t_bianzheng,
    "aiyin": t_aiyin,
    "kongshan": t_kongshan,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, build in TRACKS.items():
        score, beats = build()
        data = score.render(beats)
        write_wav(OUT / f"{name}.wav", data)
        print(f"synth {name}: {len(data) / SR:.1f}s")


if __name__ == "__main__":
    main()
