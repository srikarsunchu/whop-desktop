#!/usr/bin/env python3
"""Generate src-tauri/icons/tray-template.png: a black+alpha macOS menu-bar
template icon derived from the white glyph in src-tauri/icons/icon.png.
Requires Pillow."""
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
src = Image.open(root / "icon.png").convert("RGBA")
w, h = src.size
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
sp, op = src.load(), out.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = sp[x, y]
        white = min(r, g, b)  # how white the pixel is
        alpha = int(a * (max(0, white - 150) / 105))  # threshold out the orange tile
        op[x, y] = (0, 0, 0, alpha)
bbox = out.getbbox()
if not bbox:
    sys.exit("no white glyph found")
glyph = out.crop(bbox)
size = 36  # 2x of 18pt, the standard menu-bar glyph height
scale = size / max(glyph.size)
glyph = glyph.resize((max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))), Image.LANCZOS)
canvas = Image.new("RGBA", (44, 44), (0, 0, 0, 0))
canvas.paste(glyph, ((44 - glyph.width) // 2, (44 - glyph.height) // 2), glyph)
canvas.save(root / "tray-template.png")
print("wrote", root / "tray-template.png", canvas.size)
