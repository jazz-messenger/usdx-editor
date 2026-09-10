#!/usr/bin/env python3
"""Generates the demo song's .txt, audio and cover into public/demo.

Everything here is written for this project — the artist and song do not
exist, the lyrics are original, the audio is synthesised and the cover is
drawn programmatically. See public/demo/README.md.

    python3 scripts/generate-demo-song.py [output-dir]

The video is a separate step: scripts/generate-demo-video.mjs
"""
import math, os, struct, sys, wave

try:
    from PIL import Image, ImageDraw, ImageFont
except ModuleNotFoundError:
    sys.exit(
        "Pillow is required for the cover art.\n"
        "  pip install Pillow   (or run with an interpreter that has it, e.g. /usr/bin/python3)"
    )

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/demo"
os.makedirs(OUT, exist_ok=True)

BPM = 320            # USDX ticks/min -> 46.875 ms per tick
MS_PER_TICK = 15000 / BPM
GAP = 1200           # ms of intro before the first note

# (beat, length, pitch, syllable) — original lyrics, written for this demo
P1 = [
    [(0, 2, 0, "Neon "), (2, 2, 2, "sky"), (4, 2, 4, "line "), (6, 2, 2, "o"), (8, 4, 0, "ver "), (12, 4, -1, "town")],
    [(16, 2, 0, "Ev'"), (18, 2, 2, "ry "), (20, 2, 4, "win"), (22, 2, 5, "dow "), (24, 4, 4, "burn"), (28, 4, 2, "ing")],
    [(32, 2, 4, "We "), (34, 2, 5, "were "), (36, 3, 7, "young "), (39, 3, 5, "and "), (42, 6, 4, "loud")],
    [(48, 2, 0, "Head"), (50, 2, 2, "lights "), (52, 2, 4, "drift"), (54, 2, 2, "ing "), (56, 6, 0, "slow")],
]
P2 = [
    [(16, 2, 4, "Hold "), (18, 2, 5, "the "), (20, 2, 7, "night "), (22, 2, 9, "a "), (24, 8, 7, "while")],
    [(32, 2, 7, "Fill "), (34, 2, 9, "the "), (36, 3, 11, "qui"), (39, 3, 9, "et "), (42, 6, 7, "air")],
    [(48, 2, 4, "Let "), (50, 2, 5, "the "), (52, 2, 7, "cit"), (54, 2, 5, "y "), (56, 6, 4, "go")],
]


def render_track(phrases, golden=()):
    """USDX note lines for one player, with a line break before each phrase."""
    out = []
    for pi, notes in enumerate(phrases):
        for beat, length, pitch, syl in notes:
            kind = "*" if (pi, beat) in golden else ":"
            out.append(f"{kind} {beat} {length} {pitch} {syl}")
        if pi < len(phrases) - 1:
            out.append(f"- {phrases[pi + 1][0][0]}")
    return out


lines = [
    "#TITLE:Neon Skyline",
    "#ARTIST:The Midnight Owls",
    "#LANGUAGE:English",
    "#GENRE:Synthpop",
    "#YEAR:2024",
    "#EDITION:Demo Session",
    "#CREATOR:USDX Editor Demo",
    f"#BPM:{BPM}",
    f"#GAP:{GAP}",
    "#AUDIO:Neon Skyline.wav",
    "#VIDEO:Neon Skyline.webm",
    "#VIDEOGAP:1.8",
    "#TAGS:Party, Synthwave, Duett",
    "#COVER:Neon Skyline [CO].png",
    "#P1:Mara",
    "#P2:Jonas",
    "P1",
    *render_track(P1, golden={(2, 36)}),
    "P2",
    *render_track(P2, golden={(1, 36)}),
    "E",
    "",
]
with open(os.path.join(OUT, "Neon Skyline.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

# ── Audio ────────────────────────────────────────────────────────────────────
RATE = 22050   # plenty for a 4 s demo clip — halves the download
total_ticks = 66
dur = GAP / 1000 + total_ticks * MS_PER_TICK / 1000 + 0.5
n = int(RATE * dur)
buf = [0.0] * n


def midi(p):            # USDX pitch 0 == C4-ish
    return 261.63 * (2 ** (p / 12))


def add(freq, t0, length, amp, wave_fn):
    s0, s1 = int(t0 * RATE), min(n, int((t0 + length) * RATE))
    for i in range(s0, s1):
        x = (i - s0) / RATE
        env = min(1.0, x / 0.02) * min(1.0, (s1 - i) / RATE / 0.08)
        buf[i] += amp * env * wave_fn(2 * math.pi * freq * x)


sine = math.sin


def saw(p):
    return 2 * ((p / (2 * math.pi)) % 1.0) - 1.0


# intro pad + backing chords across the whole song
for bar in range(0, 6):
    t0 = bar * 16 * MS_PER_TICK / 1000
    root = [0, 0, -5, -3, 0, -5][bar % 6]
    for interval in (0, 7, 12):
        add(midi(root + interval) / 2, t0, 0.9, 0.06, saw)
    add(midi(root) / 4, t0, 0.45, 0.16, sine)
    add(midi(root) / 4, t0 + 0.6, 0.3, 0.11, sine)

# the sung melody — one sine per note plus a quiet octave on top
for notes in P1 + P2:
    for beat, length, pitch, _ in notes:
        t0 = GAP / 1000 + beat * MS_PER_TICK / 1000
        add(midi(pitch), t0, length * MS_PER_TICK / 1000 * 0.92, 0.22, sine)
        add(midi(pitch) * 2, t0, length * MS_PER_TICK / 1000 * 0.5, 0.05, sine)

peak = max(abs(v) for v in buf) or 1.0
with wave.open(os.path.join(OUT, "Neon Skyline.wav"), "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(b"".join(struct.pack("<h", int(v / peak * 0.85 * 32767)) for v in buf))

# ── Cover ────────────────────────────────────────────────────────────────────
S = 600
img = Image.new("RGB", (S, S), (14, 12, 26))
d = ImageDraw.Draw(img)
for y in range(S):
    k = y / S
    d.line([(0, y), (S, y)], fill=(int(14 + 40 * k), int(12 + 14 * k), int(26 + 60 * (1 - k))))
for i in range(14):
    y = int(S * 0.62 + i * 14)
    d.line([(0, y), (S, y)], fill=(255, 138, 46), width=1)
for i in range(-8, 9):
    d.line([(S / 2 + i * 44, S * 0.62), (S / 2 + i * 260, S)], fill=(190, 90, 200), width=1)
d.ellipse([S * 0.28, S * 0.16, S * 0.72, S * 0.60], fill=(255, 150, 60))
d.rectangle([0, S * 0.62, S, S], fill=(20, 14, 40))
for i in range(14):
    y = int(S * 0.62 + i * 14)
    d.line([(0, y), (S, y)], fill=(255, 138, 46))
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Futura.ttc", 46)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Futura.ttc", 24)
except OSError:
    font = small = ImageFont.load_default()
d.text((S / 2, S * 0.74), "NEON SKYLINE", font=font, fill=(255, 255, 255), anchor="mm")
d.text((S / 2, S * 0.83), "THE MIDNIGHT OWLS", font=small, fill=(255, 190, 140), anchor="mm")
img.save(os.path.join(OUT, "Neon Skyline [CO].png"))
print("written to", OUT)
