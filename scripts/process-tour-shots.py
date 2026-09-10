#!/usr/bin/env python3
"""Turns the raw tour screenshots into the .webp files LandingTour.tsx imports.

    node scripts/capture-tour.mjs             # writes /tmp/usdx-tour-shots/de
    LOCALE=en node scripts/capture-tour.mjs   # writes /tmp/usdx-tour-shots/en
    /usr/bin/python3 scripts/process-tour-shots.py

Crops the empty strip below the editor, scales to a retina-friendly width and
encodes WebP — roughly 45 KB per shot instead of ~400 KB of PNG.
"""
import os
import sys

try:
    from PIL import Image
except ModuleNotFoundError:
    sys.exit(
        "Pillow is required.\n"
        "  pip install Pillow   (or run with an interpreter that has it, e.g. /usr/bin/python3)"
    )

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/usdx-tour-shots"
DEST = sys.argv[2] if len(sys.argv) > 2 else "src/assets/tour"

# Captured at 1360x780 with deviceScaleFactor 2 -> 2720x1560. Everything below
# 1400 is empty panel; the media controls bottom out around y=1350.
CROP_H = 1400
TARGET_W = 2000
QUALITY = 82

os.makedirs(DEST, exist_ok=True)
written = 0

for locale in ("de", "en"):
    folder = os.path.join(SRC, locale)
    if not os.path.isdir(folder):
        print(f"skipping {locale} — {folder} not found")
        continue
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".png"):
            continue
        im = Image.open(os.path.join(folder, name)).convert("RGB")
        im = im.crop((0, 0, im.width, min(CROP_H, im.height)))
        im = im.resize((TARGET_W, round(im.height * TARGET_W / im.width)), Image.LANCZOS)
        # "01-overview.png" -> "overview-de.webp"
        slug = name.split("-", 1)[1].removesuffix(".png")
        out = os.path.join(DEST, f"{slug}-{locale}.webp")
        im.save(out, "WEBP", quality=QUALITY, method=6)
        print(f"{out}  {os.path.getsize(out) // 1024} KB  {im.size[0]}x{im.size[1]}")
        written += 1

if written == 0:
    sys.exit(f"no screenshots found under {SRC} — run scripts/capture-tour.mjs first")
