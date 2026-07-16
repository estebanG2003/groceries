"""Generate the app icons: a green rounded square with a white checkmark.
Run once (or after changing the design): python make_icons.py
"""
from PIL import Image, ImageDraw

GREEN = (22, 163, 74, 255)
WHITE = (255, 255, 255, 255)


def rounded(size, radius_frac, bg, margin_frac=0.0):
    """Green rounded-square tile at `size`, optional margin (for maskable safe zone)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = int(size * margin_frac)
    r = int((size - 2 * m) * radius_frac)
    d.rounded_rectangle([m, m, size - m - 1, size - m - 1], radius=r, fill=bg)
    return img, d, m


def draw_check(d, size, m):
    """White checkmark centred in the tile."""
    inner = size - 2 * m
    w = max(4, int(inner * 0.09))          # stroke width
    # three points of the check, as fractions of the inner box
    pts = [(0.28, 0.53), (0.44, 0.69), (0.72, 0.34)]
    xy = [(m + int(px * inner), m + int(py * inner)) for px, py in pts]
    d.line(xy, fill=WHITE, width=w, joint="curve")
    # round the stroke ends/joint with dots
    for (x, y) in xy:
        d.ellipse([x - w // 2, y - w // 2, x + w // 2, y + w // 2], fill=WHITE)


def make(path, size, margin_frac=0.0, radius_frac=0.22):
    img, d, m = rounded(size, radius_frac, GREEN, margin_frac)
    draw_check(d, size, m)
    img.save(path)
    print("wrote", path)


if __name__ == "__main__":
    make("icon-192.png", 192)
    make("icon-512.png", 512)
    make("icon-180.png", 180)                         # apple-touch (no transparency needed)
    # maskable: keep art inside the ~80% safe zone -> add margin
    make("icon-maskable-512.png", 512, margin_frac=0.14, radius_frac=0.30)
