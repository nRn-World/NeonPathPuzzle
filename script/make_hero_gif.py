"""
Renders the title-screen animation (the board drawing its own solution) as an
animated GIF for the README: docs/hero.gif.

    python script/make_hero_gif.py

The board comes from client/src/lib/heroBoard.ts, so the README always matches
the game's front page. Needs Pillow.
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "client/src/lib/heroBoard.ts").read_text(encoding="utf8")
GRID = int(re.search(r"gridSize:\s*(\d+)", SOURCE).group(1))
SOLUTION = [(int(x), int(y)) for x, y in re.findall(r"\[(\d+),\s*(\d+)\]", SOURCE)]

BG = (10, 15, 30)
PRIMARY = (0, 243, 255)
WHITE = (255, 255, 255)
DIM = (62, 70, 88)  # white at 22% over the background

SIZE = 560          # output edge in pixels
SS = 2              # supersampling for smooth circles and lines
FPS = 20
DRAW_SPEED = 13     # nodes per second, same as the game
HOLD_S = 1.8
FADE_S = 0.9

PAD = 34
STRIP = 30  # caption strip under the board


def blend(color, alpha):
    return tuple(round(BG[i] + (color[i] - BG[i]) * alpha) for i in range(3))


def font(size):
    for name in ("consola.ttf", "DejaVuSansMono.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def frame(t, draw_s):
    w = SIZE * SS
    image = Image.new("RGB", (w, w), BG)
    d = ImageDraw.Draw(image)
    board = w - 2 * PAD * SS
    top = PAD * SS
    cell = board / GRID
    count = len(SOLUTION)

    def center(x, y):
        return (PAD * SS + x * cell + cell / 2, top + y * cell + cell / 2)

    progress = min(1.0, t / draw_s) * (count - 1)
    fade = 1.0 if t <= draw_s + HOLD_S else max(0.0, 1 - (t - draw_s - HOLD_S) / FADE_S)
    ring = max(2, round(cell * 0.035))

    # Corner ticks
    tick = 16 * SS
    x0, y0, x1, y1 = PAD * SS - 14 * SS, top - 14 * SS, PAD * SS + board + 14 * SS, top + board + 14 * SS
    for cx, cy, sx, sy in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        d.line([(cx, cy), (cx + sx * tick, cy)], fill=PRIMARY, width=3 * SS)
        d.line([(cx, cy), (cx, cy + sy * tick)], fill=PRIMARY, width=3 * SS)

    # Nodes
    for index, (x, y) in enumerate(SOLUTION):
        cx, cy = center(x, y)
        reached = index <= progress
        radius = cell * 0.13
        color = blend(PRIMARY, fade) if reached else DIM
        d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=color, width=ring)

    # Line: thick cyan stroke with a thin dark core, like the game
    whole = int(progress)
    part = progress - whole
    points = [center(*SOLUTION[i]) for i in range(whole + 1)]
    if whole < count - 1:
        ax, ay = center(*SOLUTION[whole])
        bx, by = center(*SOLUTION[whole + 1])
        head = (ax + (bx - ax) * part, ay + (by - ay) * part)
        points.append(head)
    else:
        head = points[-1]
    line = blend(PRIMARY, fade)
    core = blend(BG, 1)
    if len(points) > 1 and fade > 0:
        d.line(points, fill=line, width=round(cell * 0.2), joint="curve")
        for px, py in points:
            r = cell * 0.1
            d.ellipse([px - r, py - r, px + r, py + r], fill=line)
        d.line(points, fill=core, width=round(cell * 0.07), joint="curve")

    # Reached nodes keep a bright centre
    for index, (x, y) in enumerate(SOLUTION):
        if index <= progress and fade > 0:
            cx, cy = center(x, y)
            r = cell * 0.06
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=blend(WHITE, fade))

    # Head
    if t <= draw_s + HOLD_S:
        hx, hy = head
        r1, r2 = cell * 0.27, cell * 0.14
        d.ellipse([hx - r1, hy - r1, hx + r1, hy + r1], outline=WHITE, width=max(2, round(cell * 0.04)))
        d.ellipse([hx - r2, hy - r2, hx + r2, hy + r2], fill=WHITE)

    board_image = image.resize((SIZE, SIZE), Image.LANCZOS)
    out = Image.new("RGB", (SIZE, SIZE + STRIP), BG)
    out.paste(board_image, (0, 0))
    label = ImageDraw.Draw(out)
    f = font(13)
    y = SIZE + 2
    label.text((PAD, y), f"{GRID}x{GRID}  /  {count} NODES", font=f, fill=(140, 150, 170))
    text = "TRAIN YOUR BRAIN"
    width = label.textlength(text, font=f)
    label.text((SIZE - PAD - width, y), text, font=f, fill=(140, 150, 170))
    return out


def main():
    draw_s = len(SOLUTION) / DRAW_SPEED
    total = draw_s + HOLD_S + FADE_S
    frames = [frame(i / FPS, draw_s) for i in range(int(total * FPS))]
    target = ROOT / "docs"
    target.mkdir(exist_ok=True)
    out = target / "hero.gif"
    frames[0].save(
        out,
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / FPS),
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"{out} {out.stat().st_size / 1024:.0f} KB, {len(frames)} frames")


if __name__ == "__main__":
    main()
