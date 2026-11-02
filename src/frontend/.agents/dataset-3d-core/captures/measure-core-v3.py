#!/usr/bin/env python3
"""Reproducible metrics for core v3 (Issue Constellation).

Usage (from src/frontend):
  python3 .agents/dataset-3d-core/captures/measure-core-v3.py
Writes captures/measurements.json and prints a summary.
"""
import colorsys
import json
from pathlib import Path

from PIL import Image, ImageChops

OUT = Path(__file__).resolve().parent
PLAN_CROP = (590, 420, 125, 180)
BODY_CROP = (585, 500, 140, 120)
PATH_CROP = (700, 430, 330, 220)
TIER_CROPS = {
    "base": (520, 640, 160, 50),
    "tower": (770, 390, 45, 80),
    "core": BODY_CROP,
}


def luminance(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def region_stats(image, box):
    crop = image.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    width, height = crop.size
    pixels = crop.load()
    lum = []
    hues = []
    clipped_upper = 0
    clipped_lower = 0
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            value = luminance(r, g, b)
            lum.append(value)
            if value >= 250:
                if box[1] + y < 480:
                    clipped_upper += 1
                else:
                    clipped_lower += 1
            if max(r, g, b) - min(r, g, b) > 25 and max(r, g, b) > 45:
                hues.append(colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0] * 360)
    lum.sort()
    hues.sort()
    total = len(lum)
    return {
        "mean": round(sum(lum) / total, 1),
        "p95": round(lum[int(total * 0.95)], 1),
        "clippedPct": round((clipped_upper + clipped_lower) / total * 100, 2),
        "clippedArcs": clipped_upper,
        "clippedBelowArcs": clipped_lower,
        "hueMedian": round(hues[len(hues) // 2], 1) if hues else None,
    }


def cyan_stats(image, box):
    crop = image.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    width, height = crop.size
    pixels = crop.load()
    total = width * height
    cyan = 0
    hues = []
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            if b > 60 and g > r * 1.08 and b >= g * 0.85:
                cyan += 1
                hue, sat, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if sat > 0.20:
                    hues.append(hue * 360)
    hues.sort()
    return {
        "cyanSharePct": round(cyan / total * 100, 1),
        "hueP25": round(hues[len(hues) // 4], 1) if hues else None,
        "hueP50": round(hues[len(hues) // 2], 1) if hues else None,
        "hueP75": round(hues[3 * len(hues) // 4], 1) if hues else None,
    }


def amber_count(image, box):
    crop = image.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    width, height = crop.size
    pixels = crop.load()
    count = 0
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            if max(r, g, b) < 50:
                continue
            hue, sat, value = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 10 <= hue * 360 <= 60 and sat > 0.25 and value > 0.28:
                count += 1
    return count


def main():
    before = Image.open(OUT / "before-attached.png").convert("RGB")
    after = Image.open(OUT / "after-attached.png").convert("RGB")
    width, height = after.size

    reduced_a = Image.open(OUT / "after-reduced-a.png").convert("RGB")
    reduced_b = Image.open(OUT / "after-reduced-b.png").convert("RGB")
    diff = ImageChops.difference(reduced_a, reduced_b).convert("L")
    histogram = diff.histogram()
    changed = sum(histogram[3:])
    total = width * height

    report = {
        "size": [width, height],
        "before": {
            "planCrop": region_stats(before, PLAN_CROP),
            "bodyCrop": region_stats(before, BODY_CROP),
        },
        "after": {
            "planCrop": region_stats(after, PLAN_CROP),
            "bodyCrop": region_stats(after, BODY_CROP),
            "cyan": cyan_stats(after, BODY_CROP),
            "amberPx": {
                "pathCrop": amber_count(after, PATH_CROP),
                "pathCropBefore": amber_count(before, PATH_CROP),
                "fullFrame": amber_count(after, (0, 0, width, height)),
            },
            "tiers": {
                name: region_stats(after, box)["mean"]
                for name, box in TIER_CROPS.items()
            },
        },
        "reducedMotionChangedPct": round(changed / total * 100, 3),
        "reducedMotionMaxDiff": max(i for i, v in enumerate(histogram) if v),
    }
    (OUT / "measurements.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
