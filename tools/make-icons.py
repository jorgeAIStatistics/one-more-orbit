"""Draws the app icon, the PWA icons, the iOS launch images and the share preview.

    python3 tools/make-icons.py

Needs Pillow. Everything is drawn from code (the ring-and-ball mark of the wordmark's O), so the art can be
changed here and regenerated. Output: public/icons/, public/splash/, release/app-icon-1024.png.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

ROOT = Path(__file__).resolve().parent.parent
INK = (5, 6, 15)
DEEP = (16, 22, 64)
TEXT = (244, 246, 255)
CYAN = (25, 227, 255)
PINK = (255, 79, 139)
FONT = ROOT / 'node_modules/@fontsource/unbounded/files/unbounded-latin-900-normal.woff'
FONT7 = ROOT / 'node_modules/@fontsource/unbounded/files/unbounded-latin-700-normal.woff'


def backdrop(w, h, cx, cy, reach):
    """Ink with a deep-blue glow around (cx, cy)."""
    small = Image.new('RGB', (max(2, w // 8), max(2, h // 8)), INK)
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            d = math.hypot(x * 8 - cx, y * 8 - cy) / reach
            k = max(0.0, 1 - d) ** 1.6
            px[x, y] = tuple(round(INK[i] + (DEEP[i] - INK[i]) * k) for i in range(3))
    return small.resize((w, h), Image.BICUBIC)


def mark(size, pad=0.2):
    """The mark on a transparent square: thin outer rings, the white O, and the ball riding it."""
    s = size * 4
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = s / 2
    R = s * (0.5 - pad)
    for k, a in ((1.0, 70), (0.8, 110)):
        r = R * k
        d.ellipse([c - r, c - r, c + r, c + r], outline=CYAN + (a,), width=max(2, round(s * 0.008)))
    r = R * 0.56
    wdt = round(R * 0.2)
    d.ellipse([c - r, c - r, c + r, c + r], outline=TEXT + (255,), width=wdt)
    # the ball, up and to the left on the outer ring, with a glow
    ang = math.radians(-128)
    bx, by = c + math.cos(ang) * R * 0.8, c + math.sin(ang) * R * 0.8
    br = R * 0.13
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([bx - br * 2, by - br * 2, bx + br * 2, by + br * 2], fill=PINK + (150,))
    im = Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(br * 0.9)))
    ImageDraw.Draw(im).ellipse([bx - br, by - br, bx + br, by + br], fill=PINK + (255,))
    return im.resize((size, size), Image.LANCZOS)


def icon(size, pad):
    bg = backdrop(size, size, size / 2, size / 2, size * 0.75).convert('RGBA')
    return Image.alpha_composite(bg, mark(size, pad)).convert('RGB')


def splash(w, h):
    bg = backdrop(w, h, w / 2, h * 0.46, max(w, h) * 0.6).convert('RGBA')
    m = round(min(w, h) * 0.5)
    bg.alpha_composite(mark(m, 0.12), ((w - m) // 2, round(h * 0.46 - m / 2)))
    return bg.convert('RGB')


def spaced(d, xy, text, font, fill, track):
    """Text with letter spacing, centred on xy[0]."""
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + track * (len(text) - 1)
    x = xy[0] - total / 2
    for ch, wd in zip(text, widths):
        d.text((x, xy[1]), ch, font=font, fill=fill)
        x += wd + track


def share(w=1200, h=630):
    bg = backdrop(w, h, w * 0.76, h * 0.5, w * 0.6).convert('RGBA')
    m = 520
    bg.alpha_composite(mark(m, 0.1), (round(w * 0.76 - m / 2), round(h / 2 - m / 2)))
    d = ImageDraw.Draw(bg)
    small = ImageFont.truetype(str(FONT7), 34)
    big = ImageFont.truetype(str(FONT), 132)
    tag = ImageFont.truetype(str(FONT7), 30)
    x = 84
    for i, ch in enumerate('ONE MORE'):
        d.text((x, 150), ch, font=small, fill=CYAN)
        x += d.textlength(ch, font=small) + 15
    d.text((78, 205), 'ORBIT', font=big, fill=TEXT)
    d.text((84, 392), 'A one-button rhythm game.', font=tag, fill=(223, 230, 255))
    d.text((84, 436), 'Tap on the beat. Charge the drop.', font=tag, fill=(140, 150, 196))
    return bg.convert('RGB')


def main():
    icons = ROOT / 'public/icons'
    icons.mkdir(parents=True, exist_ok=True)
    icon(192, 0.16).save(icons / 'icon-192.png', optimize=True)
    icon(512, 0.16).save(icons / 'icon-512.png', optimize=True)
    icon(512, 0.26).save(icons / 'maskable-512.png', optimize=True)   # safe zone for round and squircle masks
    icon(180, 0.16).save(icons / 'apple-touch-icon.png', optimize=True)
    icon(32, 0.1).save(icons / 'favicon-32.png', optimize=True)
    share().save(icons / 'share.png', optimize=True)
    (ROOT / 'release').mkdir(exist_ok=True)
    icon(1024, 0.16).save(ROOT / 'release/app-icon-1024.png', optimize=True)   # App Store icon: square, no transparency
    # iOS shows a launch image for a home-screen web app only when one matches the device exactly
    sp = ROOT / 'public/splash'
    sp.mkdir(parents=True, exist_ok=True)
    for cssw, cssh, dpr in SPLASH:
        splash(cssw * dpr, cssh * dpr).save(sp / f'{cssw}x{cssh}@{dpr}.png', optimize=True)
    splash(2732, 2732).save(ROOT / 'release/splash-2732.png', optimize=True)   # the native app's launch image
    print('icons, splash and share image written')


# iPhone screens in CSS points and their pixel ratio (portrait)
SPLASH = [(440, 956, 3), (430, 932, 3), (420, 912, 3), (402, 874, 3), (393, 852, 3), (390, 844, 3), (428, 926, 3),
          (375, 812, 3), (414, 896, 3), (414, 896, 2), (375, 667, 2)]

if __name__ == '__main__':
    main()
