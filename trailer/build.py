"""Cuts the recorded frames into the trailers.

    python build.py

CrazyGames versions (no sound, no text, cover as the opening frame, max 20 s):
  ../crazygames-upload/trailer-landscape.mp4 (1920x1080) and trailer-portrait.mp4 (1080x1620)
Social version (captions + nrnworld.one end card): ../crazygames-upload/trailer-social-<format>.mp4
"""
import subprocess
from pathlib import Path

FFMPEG = r"C:\Users\Admin\bin\ffmpeg.exe"
ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "crazygames-upload"
FPS = 30
FADE = 0.2

# (scene, first frame, last frame): picked by eye from the contact sheets.
CUTS = [
    ("campaign", 1, 190),
    ("menu", 1, 75),
    ("chase", 60, 200),
    ("chain", 10, 130),
    ("atmospheres", 1, 72),
]
COVER_SECONDS = 0.6
# Social captions: (png, scene index, seconds into that scene, seconds on screen).
CAPTIONS = [
    ("oneline", 0, 0.3, 1.9),
    ("everynode", 0, 2.4, 1.6),
    ("city", 0, 4.3, 2.0),
    ("current", 2, 0.3, 2.6),
    ("chain", 3, 0.3, 2.6),
]


def run(args):
    subprocess.run([FFMPEG, "-v", "error", "-y", *args], check=True)


def build(fmt, social):
    size = "1920x1080" if fmt == "landscape" else "1080x1620"
    cover = OUT / ("cover-landscape.png" if fmt == "landscape" else "cover-video-portrait.png")
    frames = ROOT / "frames" / fmt
    inputs = ["-loop", "1", "-framerate", str(FPS), "-t", str(COVER_SECONDS), "-i", str(cover)]
    lengths = [COVER_SECONDS]
    for scene, first, last in CUTS:
        count = last - first + 1
        inputs += ["-framerate", str(FPS), "-start_number", str(first), "-i", str(frames / scene / "%04d.jpg")]
        lengths.append(count / FPS)
    if social:
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", "2.0", "-i", str(cover)]
        lengths.append(2.0)

    graph = [f"[{i}:v]scale={size.replace('x', ':')},setsar=1,fps={FPS},format=yuv420p,trim=duration={length:.3f}[v{i}]" for i, length in enumerate(lengths)]
    # Short cross-fades between scenes; never a fade through black.
    starts, offset, last = [0.0], 0.0, "v0"
    for i in range(1, len(lengths)):
        offset += lengths[i - 1] - FADE
        starts.append(offset)
        graph.append(f"[{last}][v{i}]xfade=transition=fade:duration={FADE}:offset={offset:.3f}[x{i}]")
        last = f"x{i}"

    caption_inputs = []
    if social:
        captions = frames / "captions"
        index = len(lengths)
        overlays = [(name, starts[scene + 1] + at, dur) for name, scene, at, dur in CAPTIONS]
        overlays.append(("url", starts[-1] + 0.2, 1.8))
        for name, at, dur in overlays:
            caption_inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{at + dur:.3f}", "-i", str(captions / f"{name}.png")]
            graph.append(f"[{index}:v]format=rgba,fade=t=in:st={at:.3f}:d=0.2:alpha=1,fade=t=out:st={at + dur - 0.25:.3f}:d=0.25:alpha=1[c{index}]")
            graph.append(f"[{last}][c{index}]overlay=0:0:enable='between(t,{at:.3f},{at + dur:.3f})'[o{index}]")
            last = f"o{index}"
            index += 1

    name = f"trailer-social-{fmt}.mp4" if social else f"trailer-{fmt}.mp4"
    run([*inputs, *caption_inputs, "-filter_complex", ";".join(graph), "-map", f"[{last}]",
         "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
         str(OUT / name)])
    total = sum(lengths) - FADE * (len(lengths) - 1)
    print(f"{name}: {total:.2f} s, {(OUT / name).stat().st_size / 1e6:.1f} MB")


for fmt in ("landscape", "portrait"):
    build(fmt, social=False)
    build(fmt, social=True)
