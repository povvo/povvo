#!/usr/bin/env python3
"""Build the Povvo profile telemetry reel and publish its static SVG gallery."""

from __future__ import annotations

import argparse
import math
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat


WIDTH = 900
HEIGHT = 220
TRANSITION_MS = 280
TRANSITION_STEP_MS = 40
PALETTE_COLOURS = 192

ROOT = Path(__file__).resolve().parent
DEFAULT_GENERATED = ROOT / "generated"
DEFAULT_PREVIEW = ROOT / "preview"
DEFAULT_OUTPUT = ROOT.parent / "assets" / "widgets"

FIELD = (244, 246, 241)
CYAN = (110, 157, 178)

STATES = (
    ("focus-board", 3000),
    ("contribution-scan", 1800),
    ("repository-index", 1800),
    ("event-rail", 1800),
    ("code-spectrum", 1800),
    ("repository-signal", 1800),
)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease_in_out_cubic(value: float) -> float:
    value = clamp(value)
    return 4 * value**3 if value < 0.5 else 1 - (-2 * value + 2) ** 3 / 2


def wipe_mask(progress: float) -> tuple[Image.Image, float]:
    progress = ease_in_out_cubic(progress)
    softness = 34
    boundary = -softness + (WIDTH + softness * 2) * progress
    slope = 0.22
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    pixels = mask.load()
    midpoint = HEIGHT / 2
    for y in range(HEIGHT):
        edge = boundary + slope * (y - midpoint)
        for x in range(WIDTH):
            pixels[x, y] = round(255 * clamp((edge - x + softness / 2) / softness))
    return mask, boundary


def scan_overlay(image: Image.Image, boundary: float) -> None:
    slope = 0.22
    midpoint = HEIGHT / 2
    top = boundary + slope * (0 - midpoint)
    bottom = boundary + slope * (HEIGHT - midpoint)
    if max(top, bottom) < -8 or min(top, bottom) > WIDTH + 8:
        return

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.line((top, 0, bottom, HEIGHT), fill=(*FIELD, 220), width=1)
    draw.line((top + 4, 0, bottom + 4, HEIGHT), fill=(*CYAN, 255), width=2)
    centre = boundary
    for y in (22, HEIGHT - 22):
        draw.line((centre - 14, y, centre + 14, y), fill=(*FIELD, 230), width=1)
    image.alpha_composite(overlay)


def transition(source: Image.Image, target: Image.Image, progress: float) -> Image.Image:
    mask, boundary = wipe_mask(progress)
    frame = Image.composite(target, source, mask).convert("RGBA")
    scan_overlay(frame, boundary)
    return frame.convert("RGB")


def shared_palette(frames: list[Image.Image]) -> Image.Image:
    columns = 3
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new("RGB", (WIDTH * columns, HEIGHT * rows), FIELD)
    for index, frame in enumerate(frames):
        sheet.paste(frame, ((index % columns) * WIDTH, (index // columns) * HEIGHT))
    return sheet.convert("P", palette=Image.Palette.ADAPTIVE, colors=PALETTE_COLOURS)


def save_gif(path: Path, frames: list[Image.Image], durations: list[int]) -> None:
    palette = shared_palette([frames[index] for index in range(0, len(frames), 7)] + [frames[-1]])
    quantized = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    quantized[0].save(
        path,
        save_all=True,
        append_images=quantized[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=1,
    )


def load_states(preview: Path) -> dict[str, Image.Image]:
    images: dict[str, Image.Image] = {}
    for name, _ in STATES:
        path = preview / f"{name}.png"
        image = Image.open(path).convert("RGB")
        if image.size != (WIDTH, HEIGHT):
            raise SystemExit(f"Unexpected preview dimensions for {path}: {image.size}")
        images[name] = image
    return images


def copy_static_gallery(generated: Path, output: Path) -> None:
    for name, _ in STATES:
        source = generated / f"{name}.svg"
        if not source.exists():
            raise SystemExit(f"Missing generated SVG: {source}")
        shutil.copyfile(source, output / source.name)


def generate(generated: Path, preview: Path, output: Path) -> Path:
    output.mkdir(parents=True, exist_ok=True)
    images = load_states(preview)
    copy_static_gallery(generated, output)

    frames: list[Image.Image] = []
    durations: list[int] = []
    transition_frames = TRANSITION_MS // TRANSITION_STEP_MS
    for index, (name, hold_ms) in enumerate(STATES):
        current = images[name]
        next_name = STATES[(index + 1) % len(STATES)][0]
        frames.append(current.copy())
        durations.append(hold_ms)
        for step in range(1, transition_frames + 1):
            progress = step / transition_frames
            frames.append(transition(current, images[next_name], progress))
            durations.append(TRANSITION_STEP_MS)

    reel_path = output / "telemetry-reel.gif"
    save_gif(reel_path, frames, durations)

    with Image.open(reel_path) as reel:
        reel.seek(0)
        first = reel.convert("RGB").copy()
        reel.seek(reel.n_frames - 1)
        last = reel.convert("RGB").copy()
        seam = max(ImageStat.Stat(ImageChops.difference(first, last)).rms)
        frame_count = reel.n_frames
    if seam > 0.5:
        raise SystemExit(f"Telemetry reel loop seam is not clean: {seam:.3f}")

    print(
        f"Generated {reel_path} ({reel_path.stat().st_size / 1024:.1f} KiB, "
        f"{frame_count} frames, {sum(durations)}ms loop)"
    )
    return reel_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generated", type=Path, default=DEFAULT_GENERATED)
    parser.add_argument("--preview", type=Path, default=DEFAULT_PREVIEW)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate(args.generated, args.preview, args.output)


if __name__ == "__main__":
    main()
