"""Draws the app icons into ../icons. Run: python3 tools/make-icons.py (needs Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
BG = (21, 19, 16)          # dark brown page background
ACCENT = (255, 148, 51)    # the app's orange (dark-mode shade, same as Page Fright)
CREAM = (240, 235, 227)


def draw(size: int) -> Image.Image:
    s = 1024  # draw large, then shrink for smooth edges
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    # An open, singing mouth (kept inside the safe zone iOS/Android won't crop)
    cx, cy = 400, 512
    d.ellipse([cx - 150, cy - 190, cx + 150, cy + 190], fill=ACCENT)
    d.ellipse([cx - 82, cy - 115, cx + 82, cy + 115], fill=BG)
    # Sound waves coming out of it
    for i, r in enumerate((250, 360, 470)):
        w = 46 - i * 6
        d.arc([cx - r, cy - r, cx + r, cy + r], start=-38, end=38, fill=CREAM, width=w)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    draw(size).save(OUT / name, optimize=True)
    print("wrote", OUT / name)
