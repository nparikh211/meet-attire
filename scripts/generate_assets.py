#!/usr/bin/env python3
"""Regenerate Meet Attire overlay PNGs, thumbnails, and extension icons."""
from PIL import Image, ImageDraw, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "attire")
THUMB = os.path.join(OUT, "thumbs")
ICON = os.path.join(ROOT, "assets", "icons")
os.makedirs(OUT, exist_ok=True)
os.makedirs(THUMB, exist_ok=True)
os.makedirs(ICON, exist_ok=True)

W, H = 512, 640


def soft_alpha(img, feather=8):
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.split()[-1]
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=max(1, feather // 3)))
    img.putalpha(alpha)
    return img


def torso_mask(w, h, neck_y=80, shoulder_w=0.92, waist_w=0.78):
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    cx = w // 2
    top = neck_y
    sw = int(w * shoulder_w / 2)
    ww = int(w * waist_w / 2)
    pts = [
        (cx - 40, top + 10),
        (cx - sw, top + 50),
        (cx - sw - 30, top + 180),
        (cx - sw + 20, top + 200),
        (cx - ww, h - 20),
        (cx + ww, h - 20),
        (cx + sw - 20, top + 200),
        (cx + sw + 30, top + 180),
        (cx + sw, top + 50),
        (cx + 40, top + 10),
        (cx + 28, top + 55),
        (cx, top + 70),
        (cx - 28, top + 55),
    ]
    d.polygon(pts, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(radius=6))


def draw_polo(base_color, check=False, collar_color=None):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mask = torso_mask(W, H, neck_y=90, shoulder_w=0.88, waist_w=0.75)
    body = Image.new("RGBA", (W, H), (*base_color, 255))
    if check:
        draw = ImageDraw.Draw(body)
        for x in range(0, W, 28):
            draw.line([(x, 0), (x, H)], fill=(40, 30, 20, 90), width=2)
        for y in range(0, H, 28):
            draw.line([(0, y), (W, y)], fill=(40, 30, 20, 90), width=2)
        for x in range(14, W, 28):
            draw.line([(x, 0), (x, H)], fill=(140, 40, 40, 70), width=1)
        for y in range(14, H, 28):
            draw.line([(0, y), (W, y)], fill=(140, 40, 40, 70), width=1)
    body.putalpha(mask)
    img = Image.alpha_composite(img, body)
    d = ImageDraw.Draw(img)
    cc = collar_color or tuple(max(0, c - 30) for c in base_color)
    d.polygon([(W // 2 - 45, 95), (W // 2 - 10, 130), (W // 2 - 35, 155), (W // 2 - 70, 120)], fill=(*cc, 230))
    d.polygon([(W // 2 + 45, 95), (W // 2 + 10, 130), (W // 2 + 35, 155), (W // 2 + 70, 120)], fill=(*cc, 230))
    for by in (170, 210, 250):
        d.ellipse([W // 2 - 6, by, W // 2 + 6, by + 12], fill=(220, 220, 220, 200))
    return soft_alpha(img, feather=8)


def draw_tshirt(base_color):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mask = torso_mask(W, H, neck_y=100, shoulder_w=0.90, waist_w=0.80)
    body = Image.new("RGBA", (W, H), (*base_color, 255))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for i in range(40):
        a = int(8 + i * 0.3)
        sd.ellipse([W // 2 - 120 + i, 200 + i, W // 2 + 120 - i, 520 - i], fill=(0, 0, 0, max(0, a // 4)))
    body = Image.alpha_composite(body, shade)
    body.putalpha(mask)
    img = Image.alpha_composite(img, body)
    d = ImageDraw.Draw(img)
    d.arc([W // 2 - 55, 95, W // 2 + 55, 175], 200, 340, fill=(200, 200, 200, 180), width=4)
    return soft_alpha(img, feather=10)


def draw_button_down(base_color, oxford=False):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mask = torso_mask(W, H, neck_y=85, shoulder_w=0.86, waist_w=0.72)
    body = Image.new("RGBA", (W, H), (*base_color, 255))
    if oxford:
        draw = ImageDraw.Draw(body)
        for y in range(0, H, 4):
            for x in range((y % 8) // 2, W, 4):
                draw.point((x, y), fill=(tuple(max(0, c - 12) for c in base_color) + (40,)))
    body.putalpha(mask)
    img = Image.alpha_composite(img, body)
    d = ImageDraw.Draw(img)
    cc = tuple(max(0, c - 25) for c in base_color)
    d.polygon([(W // 2 - 50, 88), (W // 2 - 8, 140), (W // 2 - 42, 165), (W // 2 - 85, 115)], fill=(*cc, 240))
    d.polygon([(W // 2 + 50, 88), (W // 2 + 8, 140), (W // 2 + 42, 165), (W // 2 + 85, 115)], fill=(*cc, 240))
    d.rectangle([W // 2 - 14, 150, W // 2 + 14, H - 40], fill=(*tuple(max(0, c - 15) for c in base_color), 200))
    for by in range(175, H - 60, 45):
        d.ellipse([W // 2 - 5, by, W // 2 + 5, by + 10], fill=(240, 240, 245, 220))
    d.rounded_rectangle([W // 2 - 110, 230, W // 2 - 50, 300], radius=4, outline=(*cc, 160), width=2)
    return soft_alpha(img, feather=8)


def make_thumb(src_path, name, bg=(40, 44, 52)):
    im = Image.open(src_path).convert("RGBA")
    im.thumbnail((80, 96), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (96, 96), (*bg, 255))
    x = (96 - im.width) // 2
    y = (96 - im.height) // 2 + 4
    canvas.paste(im, (x, y), im)
    canvas.save(os.path.join(THUMB, f"{name}.png"))


def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = max(1, size // 16)
    d.rounded_rectangle(
        [margin, margin, size - margin - 1, size - margin - 1],
        radius=size // 5,
        fill=(32, 36, 44, 255),
    )
    cx, cy = size // 2, size // 2 + size // 16
    s = size * 0.28
    d.polygon(
        [
            (cx - s * 0.5, cy - s * 0.9),
            (cx, cy - s * 0.3),
            (cx + s * 0.5, cy - s * 0.9),
            (cx + s * 0.85, cy - s * 0.5),
            (cx + s * 0.7, cy + s * 1.1),
            (cx - s * 0.7, cy + s * 1.1),
            (cx - s * 0.85, cy - s * 0.5),
        ],
        fill=(100, 160, 220, 255),
    )
    d.line(
        [(cx - s * 0.4, cy), (cx + s * 0.4, cy + s * 0.6)],
        fill=(210, 180, 130, 200),
        width=max(1, size // 32),
    )
    return img


def main():
    draw_polo((210, 185, 140), check=True).save(os.path.join(OUT, "classic-polo.png"))
    draw_tshirt((245, 245, 248)).save(os.path.join(OUT, "white-tshirt.png"))
    draw_button_down((250, 250, 252)).save(os.path.join(OUT, "white-button-down.png"))
    draw_polo((28, 45, 80), collar_color=(20, 35, 65)).save(os.path.join(OUT, "navy-polo.png"))
    draw_button_down((170, 195, 220), oxford=True).save(os.path.join(OUT, "light-blue-oxford.png"))
    for fname, key in [
        ("classic-polo.png", "classic-polo"),
        ("white-tshirt.png", "white-tshirt"),
        ("white-button-down.png", "white-button-down"),
        ("navy-polo.png", "navy-polo"),
        ("light-blue-oxford.png", "light-blue-oxford"),
    ]:
        make_thumb(os.path.join(OUT, fname), key)
    for s in (16, 32, 48, 128):
        make_icon(s).save(os.path.join(ICON, f"icon{s}.png"))
    print("Assets written to", OUT)


if __name__ == "__main__":
    main()
