#!/usr/bin/env python3
"""Generate the static and animated Povvo Poker profile strips."""

from __future__ import annotations

import argparse
import math
import random
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


WIDTH = 900
HEIGHT = 180
SCALE = 3
CARD_WIDTH = 78
CARD_HEIGHT = 122
CARD_X = (WIDTH - CARD_WIDTH) // 2
CARD_Y = 27
PALETTE_COLOURS = 96

REPOSITORY = Path(__file__).resolve().parents[2]
LOGO_PATH = REPOSITORY / "assets" / "logo.png"
DEFAULT_OUTPUT = REPOSITORY / "poker"

BLACK = (5, 7, 6)
FIELD = (244, 246, 241)
INK = (5, 7, 6)
CYAN = (110, 157, 178)
INVERSE = (216, 236, 248)
GHOST = (20, 34, 39)
MICRO = (139, 176, 190)

FONT_CANDIDATES = {
    "display": [
        "C:/Windows/Fonts/arialbi.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-BoldItalic.ttf",
    ],
    "display_regular": [
        "C:/Windows/Fonts/arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ],
    "micro": [
        "C:/Windows/Fonts/consolab.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf",
    ],
}


def scaled(value: float) -> int:
    return round(value * SCALE)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease_out_quint(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 5


def ease_in_cubic(value: float) -> float:
    value = clamp(value)
    return value**3


@lru_cache(maxsize=32)
def font(role: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES[role]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, scaled(size))
    raise SystemExit(f"No usable system font found for role: {role}")


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    value: str,
    *,
    role: str,
    size: int,
    fill: tuple[int, int, int, int] | tuple[int, int, int],
    anchor: str = "lt",
) -> None:
    draw.text(
        (scaled(xy[0]), scaled(xy[1])),
        value,
        font=font(role, size),
        fill=fill,
        anchor=anchor,
    )


def tracked_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    value: str,
    *,
    fill: tuple[int, int, int, int] | tuple[int, int, int] = MICRO,
    size: int = 8,
    tracking: float = 0.9,
    anchor: str = "left",
) -> None:
    value = value.upper()
    active_font = font("micro", size)
    widths = [draw.textlength(character, font=active_font) for character in value]
    advance = scaled(tracking)
    total = sum(widths) + advance * max(0, len(value) - 1)
    x = scaled(xy[0])
    y = scaled(xy[1])
    if anchor == "center":
        x -= round(total / 2)
    elif anchor == "right":
        x -= round(total)
    for character, width in zip(value, widths):
        draw.text((x, y), character, font=active_font, fill=fill, anchor="lt")
        x += round(width + advance)


def alpha_scale(mask: Image.Image, opacity: float) -> Image.Image:
    opacity = clamp(opacity)
    return mask.point(lambda value: round(value * opacity))


def centre_scaled(mask: Image.Image, width_factor: float) -> Image.Image:
    width = max(1, round(mask.width * width_factor))
    resized = mask.resize((width, mask.height), Image.Resampling.LANCZOS)
    result = Image.new("L", mask.size, 0)
    result.paste(resized, ((mask.width - width) // 2, 0))
    return result


@lru_cache(maxsize=1)
def p_mask() -> Image.Image:
    source = Image.open(LOGO_PATH).convert("RGBA")
    background = Image.new("RGBA", source.size, (*FIELD, 255))
    background.alpha_composite(source)
    mask = background.convert("L").point(lambda value: 255 if value < 90 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise SystemExit(f"Povvo mark could not be extracted from {LOGO_PATH}")
    mark = mask.crop(bounds)
    mark.thumbnail((scaled(64), scaled(50)), Image.Resampling.LANCZOS)
    result = Image.new("L", (scaled(CARD_WIDTH), scaled(CARD_HEIGHT)), 0)
    result.paste(
        mark,
        ((result.width - mark.width) // 2, (result.height - mark.height) // 2 - scaled(1)),
    )
    return result


@lru_cache(maxsize=1)
def ace_mask() -> Image.Image:
    result = Image.new("L", (scaled(CARD_WIDTH), scaled(CARD_HEIGHT)), 0)
    draw = ImageDraw.Draw(result)
    draw.text(
        (scaled(8), scaled(5)),
        "A",
        font=font("display_regular", 18),
        fill=255,
        anchor="lt",
    )
    draw.text(
        (scaled(12), scaled(28)),
        "\u2660",
        font=font("display_regular", 12),
        fill=255,
        anchor="mm",
    )
    draw.text(
        (scaled(CARD_WIDTH / 2), scaled(CARD_HEIGHT / 2 + 5)),
        "\u2660",
        font=font("display_regular", 54),
        fill=255,
        anchor="mm",
    )

    corner = Image.new("L", result.size, 0)
    corner_draw = ImageDraw.Draw(corner)
    corner_draw.text(
        (scaled(8), scaled(5)),
        "A",
        font=font("display_regular", 18),
        fill=255,
        anchor="lt",
    )
    corner_draw.text(
        (scaled(12), scaled(28)),
        "\u2660",
        font=font("display_regular", 12),
        fill=255,
        anchor="mm",
    )
    result = ImageChops.lighter(result, corner.rotate(180))
    return result


def draw_static_field() -> Image.Image:
    image = Image.new("RGBA", (scaled(WIDTH), scaled(HEIGHT)), (*BLACK, 255))
    draw = ImageDraw.Draw(image)

    rng = random.Random(20260713)
    for _ in range(520):
        x = rng.randrange(scaled(WIDTH))
        y = rng.randrange(scaled(HEIGHT))
        value = rng.choice((8, 9, 10, 11, 12, 14))
        draw.point((x, y), fill=(value, value + 2, value + 1, 255))

    draw.rectangle(
        (scaled(12), scaled(12), scaled(WIDTH - 12), scaled(HEIGHT - 12)),
        outline=(*CYAN, 255),
        width=scaled(0.5),
    )
    draw.line(
        (scaled(12), scaled(90), scaled(WIDTH - 12), scaled(90)),
        fill=(*GHOST, 255),
        width=scaled(0.5),
    )
    for x in range(24, WIDTH - 23, 24):
        tick = 7 if x % 120 == 0 else 3
        draw.line(
            (scaled(x), scaled(12), scaled(x), scaled(12 + tick)),
            fill=(*CYAN, 255),
            width=scaled(0.5),
        )
        draw.line(
            (scaled(x), scaled(168 - tick), scaled(x), scaled(168)),
            fill=(*CYAN, 255),
            width=scaled(0.5),
        )

    draw.text(
        (scaled(WIDTH / 2), scaled(92)),
        "POVVO",
        font=font("display", 74),
        fill=(*BLACK, 255),
        stroke_width=scaled(0.65),
        stroke_fill=(*GHOST, 255),
        anchor="mm",
    )

    for x in (350, 550):
        draw.line(
            (scaled(x), scaled(28), scaled(x), scaled(152)),
            fill=(*GHOST, 255),
            width=scaled(0.5),
        )

    tracked_text(draw, (32, 35), "POVVO / PRIVATE TABLE", fill=CYAN, size=8)
    draw_text(draw, (32, 53), "POKER / 1V1", role="display", size=27, fill=INVERSE)
    draw.line(
        (scaled(32), scaled(91), scaled(284), scaled(91)),
        fill=(*CYAN, 255),
        width=scaled(0.5),
    )
    tracked_text(draw, (32, 108), "J < Q < K / ANTE 01", fill=MICRO, size=8)
    tracked_text(draw, (32, 132), "DCFR / 10,000", fill=MICRO, size=8)

    tracked_text(draw, (868, 35), "TABLE OPEN / POVVO", fill=CYAN, size=8, anchor="right")
    draw_text(
        draw,
        (868, 53),
        "ENTER TABLE",
        role="display",
        size=27,
        fill=INVERSE,
        anchor="rt",
    )
    draw.line(
        (scaled(616), scaled(91), scaled(868), scaled(91)),
        fill=(*CYAN, 255),
        width=scaled(0.5),
    )
    tracked_text(draw, (868, 108), "PLAY A HAND / 01", fill=MICRO, size=8, anchor="right")
    tracked_text(draw, (868, 132), "NO ACCOUNT / NO STAKES", fill=MICRO, size=8, anchor="right")

    for x, y in ((24, 90), (876, 90), (350, 90), (550, 90)):
        draw.line(
            (scaled(x - 5), scaled(y), scaled(x + 5), scaled(y)),
            fill=(*CYAN, 255),
            width=scaled(0.5),
        )
        draw.line(
            (scaled(x), scaled(y - 5), scaled(x), scaled(y + 5)),
            fill=(*CYAN, 255),
            width=scaled(0.5),
        )

    return image


def draw_pulse(image: Image.Image, phase: float) -> None:
    if phase < 0 or phase > 1:
        return
    phase = clamp(phase)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    opacity = round(255 * (1 - phase))
    expansion_x = 18 + 68 * phase
    expansion_y = 10 + 24 * phase
    draw.rounded_rectangle(
        (
            scaled(CARD_X - expansion_x),
            scaled(CARD_Y - expansion_y),
            scaled(CARD_X + CARD_WIDTH + expansion_x),
            scaled(CARD_Y + CARD_HEIGHT + expansion_y),
        ),
        radius=scaled(4),
        outline=(*FIELD, opacity),
        width=scaled(1),
    )
    reach = 48 + 118 * ease_out_quint(phase)
    y = scaled(HEIGHT / 2)
    draw.line(
        (scaled(WIDTH / 2 - reach), y, scaled(CARD_X - 12), y),
        fill=(*FIELD, opacity),
        width=scaled(1.25),
    )
    draw.line(
        (scaled(CARD_X + CARD_WIDTH + 12), y, scaled(WIDTH / 2 + reach), y),
        fill=(*FIELD, opacity),
        width=scaled(1.25),
    )
    image.alpha_composite(overlay)


def draw_card(image: Image.Image, progress: float) -> None:
    progress = clamp(progress)
    draw = ImageDraw.Draw(image)
    box = (
        scaled(CARD_X),
        scaled(CARD_Y),
        scaled(CARD_X + CARD_WIDTH),
        scaled(CARD_Y + CARD_HEIGHT),
    )
    draw.rounded_rectangle(box, radius=scaled(4), fill=(*FIELD, 255))
    draw.rounded_rectangle(
        (
            scaled(CARD_X + 4),
            scaled(CARD_Y + 4),
            scaled(CARD_X + CARD_WIDTH - 4),
            scaled(CARD_Y + CARD_HEIGHT - 4),
        ),
        radius=scaled(2),
        outline=(*CYAN, 255),
        width=scaled(0.5),
    )

    p_content = centre_scaled(p_mask(), 1 - 0.45 * progress)
    ace_content = centre_scaled(ace_mask(), 0.55 + 0.45 * progress)
    combined = ImageChops.lighter(
        alpha_scale(p_content, 1 - progress),
        alpha_scale(ace_content, progress),
    )
    ink_layer = Image.new("RGBA", combined.size, (*INK, 255))
    image.paste(ink_layer, (scaled(CARD_X), scaled(CARD_Y)), combined)

    if 0 < progress < 1:
        scan_x = CARD_X + 5 + (CARD_WIDTH - 10) * progress
        opacity = round(220 * math.sin(math.pi * progress))
        draw.line(
            (scaled(scan_x), scaled(CARD_Y + 5), scaled(scan_x), scaled(CARD_Y + CARD_HEIGHT - 5)),
            fill=(*CYAN, opacity),
            width=scaled(1),
        )


def render_frame(progress: float, pulse_phases: tuple[float, ...] = ()) -> Image.Image:
    image = draw_static_field()
    for phase in pulse_phases:
        draw_pulse(image, phase)
    draw_card(image, progress)
    return image.convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def save_gif(path: Path, frames: list[Image.Image], durations: list[int]) -> None:
    sample_indices = sorted(
        {0, len(frames) // 3, 2 * len(frames) // 3, len(frames) - 1}
    )
    samples = [frames[index] for index in sample_indices]
    sheet = Image.new("RGB", (WIDTH * len(samples), HEIGHT), BLACK)
    for index, sample in enumerate(samples):
        sheet.paste(sample, (index * WIDTH, 0))
    palette = sheet.convert("P", palette=Image.Palette.ADAPTIVE, colors=PALETTE_COLOURS)
    quantized = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    quantized[0].save(
        path,
        save_all=True,
        append_images=quantized[1:],
        duration=durations,
        optimize=True,
        disposal=1,
    )


def generate(output: Path) -> tuple[Path, Path]:
    frames: list[Image.Image] = []
    durations: list[int] = []

    def add(progress: float, duration: int, *pulse_phases: float) -> None:
        frames.append(render_frame(progress, tuple(pulse_phases)))
        durations.append(duration)

    add(0, 650)
    for index in range(1, 13):
        linear = index / 12
        add(ease_out_quint(linear), 30, (linear - 0.08) / 0.76, (linear - 0.48) / 0.50)
    add(1, 500)
    for index in range(1, 10):
        linear = index / 9
        add(1 - ease_in_cubic(linear), 28, (linear - 0.16) / 0.80)
    add(0, 360)
    for index in range(1, 13):
        linear = index / 12
        add(ease_out_quint(linear), 30, (linear - 0.08) / 0.76, (linear - 0.48) / 0.50)
    for index in range(1, 7):
        add(1, 40, index / 6)
    add(1, 2000)

    output.mkdir(parents=True, exist_ok=True)
    gif_path = output / "profile-strip.gif"
    static_path = output / "profile-strip.png"
    save_gif(gif_path, frames, durations)
    frames[-1].save(static_path, optimize=True)

    total_duration = sum(durations)
    if total_duration > 5000:
        raise SystemExit(f"Animation must stop within five seconds; got {total_duration}ms")
    if gif_path.stat().st_size > 10_000_000:
        raise SystemExit(
            f"Animated strip exceeds GitHub's 10MB image limit: {gif_path.stat().st_size}"
        )

    return gif_path, static_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    gif_path, static_path = generate(args.output)
    with Image.open(gif_path) as animation:
        frame_count = animation.n_frames
        loop = animation.info.get("loop")
    print(
        f"Generated {gif_path.name} ({gif_path.stat().st_size / 1024:.1f} KiB, "
        f"{frame_count} frames, loop={loop}) and {static_path.name} "
        f"({static_path.stat().st_size / 1024:.1f} KiB)"
    )


if __name__ == "__main__":
    main()
