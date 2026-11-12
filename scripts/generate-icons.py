#!/usr/bin/env python3
"""Generate the real Hoo Browser icon set from the SVG master.

Electron (BrowserWindow icon) and electron-builder (linux/win/mac) all need
raster icons. The repo previously shipped only an SVG, so every build fell
back to the default Electron icon in the taskbar/dock.

Outputs (in src/renderer/assets/branding/):
  hoo-app-icon.png      512x512 RGBA  (linux + window icon)
  hoo-app-icon.ico      multi-size    (windows)
  hoo-app-icon.icns     512 base      (macos)
  icons/hoo-<size>.png  16..512       (linux packaging sets)
"""
import os
import cairosvg
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "src", "renderer", "assets", "branding")
SVG = os.path.join(BRAND, "hoo-app-icon.svg")
SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

def main():
    os.makedirs(BRAND, exist_ok=True)
    icons_dir = os.path.join(BRAND, "icons")
    os.makedirs(icons_dir, exist_ok=True)

    # Render the master 512px RGBA once, then downscale with Pillow (Lanczos).
    master_path = os.path.join(BRAND, "hoo-app-icon.png")
    cairosvg.svg2png(url=SVG, write_to=master_path, output_width=512, output_height=512)
    master = Image.open(master_path).convert("RGBA")
    assert master.size == (512, 512), f"unexpected master size {master.size}"

    for size in SIZES:
        out = os.path.join(icons_dir, f"hoo-{size}.png")
        master.resize((size, size), Image.LANCZOS).save(out, format="PNG")
        print(f"wrote {os.path.relpath(out, ROOT)}")

    # Windows ICO with the full size ladder embedded.
    ico_path = os.path.join(BRAND, "hoo-app-icon.ico")
    master.save(ico_path, format="ICO",
                sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    print(f"wrote {os.path.relpath(ico_path, ROOT)}")

    # macOS ICNS (512 base; Pillow embeds the required variants).
    icns_path = os.path.join(BRAND, "hoo-app-icon.icns")
    master.save(icns_path, format="ICNS")
    print(f"wrote {os.path.relpath(icns_path, ROOT)}")

if __name__ == "__main__":
    main()
