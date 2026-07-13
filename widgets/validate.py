#!/usr/bin/env python3
"""Validate the Povvo GitHub profile widget pack."""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageSequence, ImageStat

ROOT = Path(__file__).resolve().parent
GENERATED = ROOT / "generated"
PREVIEW = ROOT / "preview"
PROFILE_ASSETS = ROOT.parent / "assets" / "widgets"
EXPECTED_NAMES = [
    "contribution-scan",
    "focus-board",
    "repository-index",
    "event-rail",
    "code-spectrum",
    "repository-signal",
]
EXPECTED_SVGS = [f"{name}.svg" for name in EXPECTED_NAMES]
EXPECTED_GIFS = [f"{name}.gif" for name in EXPECTED_NAMES]
TELEMETRY_REEL_LOOP_MS = 13_680
ALLOWED_HEX = {
    "#F4F6F1",
    "#DCE4DF",
    "#050706",
    "#D8ECF8",
    "#25343A",
    "#6E9DB2",
    "#0B2B34",
    "#B5A293",
    "#287F76",
    "#B24A32",
}
LOOP_DURATION_MS = 7200
EXPECTED_LOGO_SHA256 = "4a519d9bb147ed834ecc7724118337e417c3de60e29e923477e725167f4b6458"
EXPECTED_IDENTITY_SHA256 = "3dcc64f3a29109f6c5a87b305f12e3f0ac792363f175ef2fe18e1af9c980c857"


def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def relative_luminance(value: str) -> float:
    channels = []
    for channel in rgb(value):
        point = channel / 255
        channels.append(point / 12.92 if point <= 0.04045 else ((point + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast(first: str, second: str) -> float:
    light, dark = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def near(pixel: tuple[int, int, int], target: tuple[int, int, int], tolerance: float) -> bool:
    return math.sqrt(sum((pixel[index] - target[index]) ** 2 for index in range(3))) <= tolerance


def changed_ratio(first: Image.Image, second: Image.Image, threshold: int = 5) -> float:
    difference = ImageChops.difference(first, second).convert("L")
    histogram = difference.histogram()
    return sum(histogram[threshold:]) / (first.width * first.height)


def main() -> int:
    checks: list[dict[str, object]] = []

    def record(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    logo = ROOT.parent / "assets" / "logo.png"
    try:
        logo_image = Image.open(logo)
        logo_sha = hashlib.sha256(logo.read_bytes()).hexdigest()
        record("production logo dimensions", logo_image.size == (160, 160), f"{logo_image.size[0]} x {logo_image.size[1]}")
        record("production logo checksum", logo_sha == EXPECTED_LOGO_SHA256, logo_sha)
    except (FileNotFoundError, OSError) as exc:
        logo_sha = ""
        record("production logo available", False, str(exc))

    identity = ROOT.parent / "assets" / "banner.png"
    try:
        identity_image = Image.open(identity)
        identity_sha = hashlib.sha256(identity.read_bytes()).hexdigest()
        record(
            "identity authority dimensions",
            identity_image.size == (1983, 793),
            f"{identity_image.size[0]} x {identity_image.size[1]}",
        )
        record("identity authority checksum", identity_sha == EXPECTED_IDENTITY_SHA256, identity_sha)
    except (FileNotFoundError, OSError) as exc:
        identity_sha = ""
        record("identity authority available", False, str(exc))

    packaged_fonts = [
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".ttf", ".otf", ".woff", ".woff2"}
    ]
    record(
        "font custody",
        not packaged_fonts,
        "system-font fallbacks only" if not packaged_fonts else f"packaged font files: {packaged_fonts}",
    )

    image_elements: dict[str, int] = {}
    for filename in EXPECTED_SVGS:
        path = GENERATED / filename
        try:
            root = ET.parse(path).getroot()
            valid = root.tag.endswith("svg")
            raw = path.read_text(encoding="utf-8")
            record(f"SVG parse: {filename}", valid, "valid XML")
            record(
                f"SVG accessibility: {filename}",
                "<title" in raw and "<desc" in raw and "aria-labelledby" in raw,
                "title, description, and ARIA binding present",
            )
            colours = set(re.findall(r"#[0-9A-Fa-f]{6}", raw))
            unexpected = sorted(colours - ALLOWED_HEX)
            record(
                f"SVG token palette: {filename}",
                not unexpected,
                "semantic palette only" if not unexpected else f"unexpected {unexpected}",
            )
            image_elements[filename] = raw.count("<image")
        except (ET.ParseError, FileNotFoundError, OSError) as exc:
            record(f"SVG parse: {filename}", False, str(exc))

    expected_images = {filename: (2 if filename == "focus-board.svg" else 1) for filename in EXPECTED_SVGS}
    record(
        "canonical wordmark frequency",
        image_elements == expected_images,
        f"embedded image counts: {image_elements}",
    )

    for filename in EXPECTED_SVGS:
        generated_svg = GENERATED / filename
        profile_svg = PROFILE_ASSETS / filename
        try:
            identical = generated_svg.read_bytes() == profile_svg.read_bytes()
            record(
                f"profile SVG parity: {filename}",
                identical,
                "matches generated source" if identical else "asset copy has drifted",
            )
        except FileNotFoundError as exc:
            record(f"profile SVG parity: {filename}", False, str(exc))

    magick = shutil.which("magick")
    if magick:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            for filename in EXPECTED_SVGS:
                source = GENERATED / filename
                target = temporary / f"{Path(filename).stem}.png"
                result = subprocess.run(
                    [magick, "-background", "none", str(source), str(target)],
                    capture_output=True,
                    text=True,
                    timeout=45,
                    check=False,
                )
                render_ok = result.returncode == 0 and target.exists()
                detail = "render failed"
                if render_ok:
                    rendered = Image.open(target)
                    render_ok = rendered.size == (900, 220)
                    detail = f"{rendered.size[0]} x {rendered.size[1]}"
                elif result.stderr:
                    detail = result.stderr.strip().splitlines()[-1][:180]
                record(f"SVG raster render: {filename}", render_ok, detail)

    total_gif_bytes = 0
    for filename in EXPECTED_GIFS:
        path = GENERATED / filename
        try:
            animation = Image.open(path)
            frames: list[Image.Image] = []
            durations: list[int] = []
            disposals: list[int | None] = []
            for index in range(animation.n_frames):
                animation.seek(index)
                frames.append(animation.convert("RGB").copy())
                durations.append(int(animation.info.get("duration", 0)))
                disposals.append(getattr(animation, "disposal_method", None))
            total_duration = sum(durations)
            total_gif_bytes += path.stat().st_size
            record(f"GIF dimensions: {filename}", animation.size == (900, 220), f"{animation.size[0]} x {animation.size[1]}")
            record(
                f"GIF cadence: {filename}",
                40 <= len(frames) <= 80 and total_duration == LOOP_DURATION_MS and 40 in durations,
                f"{len(frames)} encoded frames, {total_duration}ms loop, delays {sorted(set(durations))}",
            )
            record(
                f"GIF disposal: {filename}",
                set(disposals) == {1},
                f"disposal methods {sorted({value for value in disposals if value is not None})}",
            )
            file_size = path.stat().st_size
            record(f"GIF size: {filename}", file_size <= 1_500_000, f"{file_size / 1024:.1f} KiB")

            seam = ImageStat.Stat(ImageChops.difference(frames[0], frames[-1])).rms
            seam_rms = max(seam)
            record(f"GIF loop seam: {filename}", seam_rms <= 0.5, f"maximum channel RMS {seam_rms:.3f}")

            motion_frames = [frame.resize((225, 55), Image.Resampling.NEAREST) for frame in frames]
            ratios = [changed_ratio(first, second) for first, second in zip(motion_frames, motion_frames[1:])]
            maximum_change = max(ratios) if ratios else 0.0
            median_change = sorted(ratios)[len(ratios) // 2] if ratios else 0.0
            record(
                f"GIF bounded motion: {filename}",
                maximum_change <= 0.08 and median_change <= 0.03,
                f"median {median_change * 100:.2f}%, maximum {maximum_change * 100:.2f}% pixels changed",
            )

            static_reference = frames[0].crop((420, 20, 520, 30))
            static_ok = all(
                ImageChops.difference(static_reference, frame.crop((420, 20, 520, 30))).getbbox() is None
                for frame in frames[1:]
            )
            record(
                f"GIF static-field stability: {filename}",
                static_ok,
                "unchanged calibration field" if static_ok else "unexpected palette or disposal drift",
            )
        except (FileNotFoundError, OSError) as exc:
            record(f"GIF open: {filename}", False, str(exc))

    record(
        "aggregate GIF budget",
        total_gif_bytes <= 8_000_000,
        f"{total_gif_bytes / 1024:.1f} KiB across {len(EXPECTED_GIFS)} animations",
    )

    reel_path = PROFILE_ASSETS / "telemetry-reel.gif"
    try:
        reel = Image.open(reel_path)
        reel_frames: list[Image.Image] = []
        reel_durations: list[int] = []
        reel_disposals: list[int | None] = []
        for index in range(reel.n_frames):
            reel.seek(index)
            reel_frames.append(reel.convert("RGB").copy())
            reel_durations.append(int(reel.info.get("duration", 0)))
            reel_disposals.append(getattr(reel, "disposal_method", None))
        reel_duration = sum(reel_durations)
        record(
            "telemetry reel dimensions",
            reel.size == (900, 220),
            f"{reel.size[0]} x {reel.size[1]}",
        )
        record(
            "telemetry reel cadence",
            36 <= len(reel_frames) <= 60
            and reel_duration == TELEMETRY_REEL_LOOP_MS
            and reel.info.get("loop") == 0,
            f"{len(reel_frames)} frames, {reel_duration}ms, loop={reel.info.get('loop')}",
        )
        record(
            "telemetry reel disposal",
            set(reel_disposals) == {1},
            f"disposal methods {sorted({value for value in reel_disposals if value is not None})}",
        )
        reel_size = reel_path.stat().st_size
        record(
            "telemetry reel size",
            reel_size <= 1_500_000,
            f"{reel_size / 1024:.1f} KiB",
        )
        seam_rms = max(
            ImageStat.Stat(ImageChops.difference(reel_frames[0], reel_frames[-1])).rms
        )
        record(
            "telemetry reel loop seam",
            seam_rms <= 0.5,
            f"maximum channel RMS {seam_rms:.3f}",
        )
    except (FileNotFoundError, OSError) as exc:
        record("telemetry reel open", False, str(exc))

    field = rgb("#F4F6F1")
    ink = rgb("#050706")
    cyan = rgb("#6E9DB2")
    for name in EXPECTED_NAMES:
        path = PREVIEW / f"{name}.png"
        try:
            image = Image.open(path).convert("RGB")
            sampled = image.resize((450, 110), Image.Resampling.NEAREST)
            pixels = list(sampled.get_flattened_data()) if hasattr(sampled, "get_flattened_data") else list(sampled.getdata())
            dominant = sum(near(pixel, field, 34) or near(pixel, ink, 34) for pixel in pixels) / len(pixels)
            cyan_area = sum(near(pixel, cyan, 24) for pixel in pixels) / len(pixels)
            record(f"preview dimensions: {path.name}", image.size == (900, 220), f"{image.size[0]} x {image.size[1]}")
            record(f"black/off-white dominance: {path.name}", dominant >= 0.84, f"{dominant * 100:.2f}%")
            record(f"cyan subordination: {path.name}", cyan_area <= 0.025, f"{cyan_area * 100:.3f}%")
        except (FileNotFoundError, OSError) as exc:
            record(f"preview open: {path.name}", False, str(exc))

    primary_contrast = contrast("#050706", "#F4F6F1")
    micro_contrast = contrast("#25343A", "#F4F6F1")
    inverse_contrast = contrast("#D8ECF8", "#050706")
    record("primary text contrast", primary_contrast >= 7, f"{primary_contrast:.2f}:1")
    record("micro text contrast", micro_contrast >= 7, f"{micro_contrast:.2f}:1")
    record("inverse text contrast", inverse_contrast >= 7, f"{inverse_contrast:.2f}:1")

    metadata_path = GENERATED / "metadata.json"
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        record(
            "metadata contract",
            metadata.get("animated_widget_count") == 6
            and metadata.get("static_widget_count") == 6
            and metadata.get("animation_loop_ms") == LOOP_DURATION_MS
            and metadata.get("gif_disposal") == 1
            and metadata.get("identity_widget") == "focus-board"
            and metadata.get("source_wordmark") == "assets/banner.png",
            f"{metadata.get('static_widget_count')} static, {metadata.get('animated_widget_count')} animated, {metadata.get('animation_loop_ms')}ms",
        )
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        record("metadata contract", False, str(exc))

    profile_source = ROOT / "PROFILE-README.md"
    try:
        profile_markup = profile_source.read_text(encoding="utf-8")
        record(
            "profile telemetry composition",
            profile_markup.count("telemetry-reel.gif") == 1
            and "./assets/widgets/focus-board.svg" in profile_markup
            and '<a href="./assets/widgets/">' in profile_markup
            and "./widgets/generated/" not in profile_markup,
            "one linked reel with a static focus fallback",
        )
    except FileNotFoundError as exc:
        record("profile telemetry composition", False, str(exc))

    passed = all(bool(check["passed"]) for check in checks)
    results = {
        "passed": passed,
        "checks": checks,
        "logo_sha256": logo_sha,
        "identity_sha256": identity_sha,
        "validated_at": datetime.now(timezone.utc).isoformat(),
    }
    (ROOT / "validation-results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Validation",
        "",
        f"Overall: **{'PASS' if passed else 'FAIL'}**",
        "",
        "| Check | Result | Detail |",
        "| --- | --- | --- |",
    ]
    for check in checks:
        detail = str(check["detail"]).replace("|", "\\|")
        lines.append(f"| {check['name']} | {'PASS' if check['passed'] else 'FAIL'} | {detail} |")
    lines.extend(
        [
            "",
            "## Scope",
            "",
            "Validation covers SVG XML and accessibility metadata, profile-gallery parity, semantic colour custody, exact identity authority and wordmark frequency, raster renderability, individual and consolidated GIF cadence, disposal methods, loop seams, bounded changed-pixel area, static-field stability, file budgets, preview hierarchy, profile composition, contrast, metadata, and the absence of packaged font binaries.",
            "",
            "## Residual gap",
            "",
            (
                "The generated files use visible DEMO DATA until a real GitHub username is configured. "
                "Live API rendering depends on GitHub availability and the permissions of the configured token."
                if metadata.get("demo")
                else "The checked assets contain live public profile data. Scheduled refreshes still depend on GitHub availability and token permissions."
            ),
        ]
    )
    (ROOT / "VALIDATION.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    for check in checks:
        print(f"{'PASS' if check['passed'] else 'FAIL'}: {check['name']} — {check['detail']}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
