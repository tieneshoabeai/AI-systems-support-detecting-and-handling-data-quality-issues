#!/usr/bin/env python3
"""Build the before/after comparison sheet for core v3.

Usage (from src/frontend):
  python3 .agents/dataset-3d-core/captures/make-comparison-sheet.py
"""
from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
PANEL = (620, 436)
GAP = 16
MARGIN = 24
HEADER = 64
CAPTION = 30
BACKGROUND = (4, 1, 10)
TEXT = (215, 237, 255)
MUTED = (120, 160, 190)
ACCENT = (123, 233, 255)

PANELS = [
    ("before-attached.png", "TRƯỚC (v2-tier)", MUTED),
    ("after-attached.png", "SAU (v3-constellation)", ACCENT),
    ("after-closeup.png", "SAU — close-up nucleus / issue lanes", MUTED),
]


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    width = MARGIN * 2 + PANEL[0] * len(PANELS) + GAP * (len(PANELS) - 1)
    height = HEADER + PANEL[1] + CAPTION + MARGIN
    sheet = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)

    measures = json.loads((OUT / "measurements.json").read_text(encoding="utf-8"))
    before_plan = measures["before"]["planCrop"]["mean"]
    after_plan = measures["after"]["planCrop"]["mean"]
    before_body = measures["before"]["bodyCrop"]["mean"]
    after_body = measures["after"]["bodyCrop"]["mean"]
    amber = measures["after"]["amberPx"]["pathCrop"]
    draw.text((MARGIN, 14), "Dataset 3D — Core v3 · Issue Constellation", font=font(26, True), fill=TEXT)
    draw.text(
        (MARGIN, 44),
        f"before / after 1280×900 · core crop mean {before_plan} → {after_plan} (body {before_body} → {after_body}) · amber lane 0 → {amber} px",
        font=font(13),
        fill=MUTED,
    )

    for index, (filename, caption, color) in enumerate(PANELS):
        panel = Image.open(OUT / filename).convert("RGB").resize(PANEL, Image.LANCZOS)
        x = MARGIN + index * (PANEL[0] + GAP)
        y = HEADER
        sheet.paste(panel, (x, y))
        draw.rectangle([x, y, x + PANEL[0] - 1, y + PANEL[1] - 1], outline=(30, 60, 90))
        draw.text((x, y + PANEL[1] + 7), caption, font=font(14, True), fill=color)

    sheet.save(OUT / "comparison-attached.png")
    print(f"wrote {OUT / 'comparison-attached.png'} ({width}×{height})")


if __name__ == "__main__":
    main()
