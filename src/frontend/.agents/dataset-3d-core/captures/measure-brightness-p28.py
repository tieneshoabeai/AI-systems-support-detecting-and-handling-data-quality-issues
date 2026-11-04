#!/usr/bin/env python3
"""Lighting A/B for the v4 spool, measured on the frozen frame.

Compares captures/p28/frozen.png (nucleus.light = 10 / 1.2) against
captures/ab-light-off/frozen.png (the same build with nucleus.light temporarily reverted to
6 / 0.94). Only the light differs, and the frame is the reduced-motion pose, so both states are
byte-stable across runs — the main harness drags/zooms and shoots a live animation phase, which
showed up as per-pixel deltas of +227/255 and swamped the lighting delta entirely.

Region boxes are hand-placed on the hero frame's core. The check that matters is containment: the
tower and background boxes must read 0.0%, because the point light is supposed to stay in the tube.

Usage (from src/frontend):
  python3 .agents/dataset-3d-core/captures/measure-brightness-p28.py
"""
import json
from pathlib import Path

from PIL import Image, ImageChops

OUT = Path(__file__).resolve().parent
STATES = {"off": OUT / "ab-light-off", "p28": OUT / "p28"}

REGIONS = {
    "nucleus glow": (652, 488, 672, 508),
    "chamber pool (centre disc)": (628, 440, 678, 470),
    "chamber wall (lower)": (620, 500, 700, 540),
    "cap top face": (620, 400, 700, 425),
    "orbit rim (dashed)": (600, 428, 720, 440),
    "glass shell (lower left)": (596, 480, 626, 520),
    "tower slab (left)": (470, 440, 520, 520),
    "tower slab (right)": (740, 440, 790, 520),
    "background": (400, 300, 460, 360),
}


def luminance(pixel):
    return 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]


def load(state, suffix=""):
    return Image.open(STATES[state] / f"frozen{suffix}.png").convert("RGB")


def mean_lum(image, box):
    x0, y0, x1, y1 = box
    pixels = image.load()
    values = [luminance(pixels[x, y]) for y in range(y0, y1) for x in range(x0, x1)]
    return round(sum(values) / len(values), 1)


def frozen_spread(image_a, image_b):
    diff = ImageChops.difference(image_a, image_b).convert("L")
    return sum(diff.histogram()[1:])


def main():
    off, on = load("off"), load("p28")
    report = {
        "frozenIsStable": {
            "off": frozen_spread(off, load("off", "-b")),
            "p28": frozen_spread(on, load("p28", "-b")),
        },
        "changedPixels": 0,
        "maxPixelDelta": 0,
        "regions": {},
    }

    frame_diff = ImageChops.difference(off, on).convert("L")
    histogram = frame_diff.histogram()
    report["changedPixels"] = sum(histogram[3:])
    report["maxPixelDelta"] = max(index for index, value in enumerate(histogram) if value)
    report["changedPct"] = round(report["changedPixels"] / (off.size[0] * off.size[1]) * 100, 2)

    for name, box in REGIONS.items():
        before, after = mean_lum(off, box), mean_lum(on, box)
        report["regions"][name] = {
            "lightOff": before, "p28": after,
            "deltaPct": round((after - before) / before * 100, 1) if before else None,
        }

    (OUT / "brightness-p28.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"{'vùng':30} {'OFF':>7} {'P28':>7} {'đổi %':>9}")
    for name, row in report["regions"].items():
        print(f"{name:30} {row['lightOff']:>7} {row['p28']:>7} {str(row['deltaPct']) + '%':>9}")
    print(f"\npixel đổi >2: {report['changedPixels']} ({report['changedPct']}%), max Δ{report['maxPixelDelta']}")
    print("frozen ổn định (0 = pose đóng băng thật):", report["frozenIsStable"])


if __name__ == "__main__":
    main()
