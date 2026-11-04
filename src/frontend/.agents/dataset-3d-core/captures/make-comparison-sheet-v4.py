#!/usr/bin/env python3
"""Build the reference/v3/v4 comparison sheet for the spool core.

Usage (from src/frontend):
  python3 .agents/dataset-3d-core/captures/make-comparison-sheet-v4.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
REFERENCE = OUT.parent / "reference-v4-spool" / "reference.png"
PANEL = (480, 338)
GAP = 16
MARGIN = 24
HEADER = 78
CAPTION = 32
BACKGROUND = (2, 10, 14)
TEXT = (207, 250, 254)
MUTED = (120, 160, 170)
ACCENT = (34, 229, 224)
AMBER = (245, 158, 11)

PANELS = [
    (REFERENCE, "REFERENCE — spool reactor", MUTED),
    (OUT / "v3-baseline-attached.png", "TRƯỚC (v3-constellation)", MUTED),
    (OUT / "after-attached.png", "SAU (v4-spool) — hero 1280×900", ACCENT),
    (OUT / "after-closeup.png", "SAU — close-up chamber / orbits", AMBER),
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

    draw.text((MARGIN, 14), "Dataset 3D — Core v4 · Spool Reactor", font=font(26, True), fill=TEXT)
    draw.text(
        (MARGIN, 46),
        "reference vs v3 baseline vs v4 hero · teal chamber over one opaque backdrop, 4 orbit hoops,"
        " stream + amber sparks · platform r1.55 / orbits r1.20–1.38 inside the tower ring (P26),"
        " nucleus lit by its own pulsing point light (P28)",
        font=font(13),
        fill=MUTED,
    )

    for index, (path, caption, color) in enumerate(PANELS):
        panel = Image.open(path).convert("RGB").resize(PANEL, Image.LANCZOS)
        x = MARGIN + index * (PANEL[0] + GAP)
        y = HEADER
        sheet.paste(panel, (x, y))
        draw.rectangle([x, y, x + PANEL[0] - 1, y + PANEL[1] - 1], outline=(30, 60, 90))
        draw.text((x, y + PANEL[1] + 7), caption, font=font(14, True), fill=color)

    sheet.save(OUT / "comparison-v4.png")
    print(f"wrote {OUT / 'comparison-v4.png'} ({width}×{height})")


if __name__ == "__main__":
    main()
