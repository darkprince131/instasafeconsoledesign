"""
Tray sprites, drawn rather than shipped.

Windows asks for the tray icon at whatever size the current DPI wants, and a
single 16x16 PNG stretched to 20 or 24 is the blurry icon everybody
recognises. Drawing them means every state comes out crisp at every scale,
and the four states stay visually related because they are the same shape
with one thing changed.

The four states, and why each reads the way it does:

  connected     solid shield, full colour  - the resting state, confident
  disconnected  outline only, grey         - present but doing nothing
  connecting    outline with a gap         - unmistakably mid-flight
  error         solid, coral, with a slash - the only one that uses alarm red

Colour alone never carries the state: the silhouette differs too, so the icon
still reads for somebody who cannot separate the hues, and at 16px where hue
is mostly lost anyway.
"""
from PIL import Image, ImageDraw

# Brand, from the measured logo. Violet is the interactive colour; coral is
# reserved for attention and is the only place red appears.
VIOLET = (91, 79, 209)
GREEN = (46, 170, 125)
GREY = (138, 142, 155)
CORAL = (216, 88, 68)
AMBER = (224, 160, 70)


def _shield(draw, box, fill, outline, width):
    """A shield, as a polygon plus an arc, so it scales without a font."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    pts = [
        (x0 + w * 0.5, y0),
        (x1, y0 + h * 0.20),
        (x1, y0 + h * 0.55),
        (x0 + w * 0.5, y1),
        (x0, y0 + h * 0.55),
        (x0, y0 + h * 0.20),
    ]
    draw.polygon(pts, fill=fill, outline=outline, width=width)


def make(state: str, size: int = 64) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = size * 0.14
    box = (pad, pad * 0.7, size - pad, size - pad * 0.7)
    line = max(2, int(size * 0.07))

    if state == "connected":
        _shield(d, box, fill=GREEN, outline=None, width=0)
        # a tick, because the colour is not allowed to carry it alone
        cx, cy, s = size * 0.5, size * 0.52, size * 0.15
        d.line([(cx - s, cy), (cx - s * 0.2, cy + s * 0.7), (cx + s, cy - s * 0.6)],
               fill=(255, 255, 255), width=max(2, int(size * 0.09)), joint="curve")

    elif state == "connecting":
        # an open shield: the gap says "not finished" at any size
        _shield(d, box, fill=None, outline=AMBER, width=line)
        d.ellipse([size * 0.42, size * 0.42, size * 0.58, size * 0.58], fill=AMBER)

    elif state == "error":
        _shield(d, box, fill=CORAL, outline=None, width=0)
        a, b = size * 0.36, size * 0.64
        d.line([(a, a), (b, b)], fill=(255, 255, 255), width=max(2, int(size * 0.09)))
        d.line([(b, a), (a, b)], fill=(255, 255, 255), width=max(2, int(size * 0.09)))

    else:  # disconnected
        _shield(d, box, fill=None, outline=GREY, width=line)

    return img


def save_all(folder):
    """Also writes a multi-size .ico, which is what the window frame wants."""
    import os
    os.makedirs(folder, exist_ok=True)
    for state in ("connected", "disconnected", "connecting", "error"):
        make(state, 64).save(os.path.join(folder, f"{state}.png"))
    base = make("connected", 256)
    base.save(os.path.join(folder, "app.ico"),
              sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    return folder


if __name__ == "__main__":
    import sys
    print(save_all(sys.argv[1] if len(sys.argv) > 1 else "assets"))
