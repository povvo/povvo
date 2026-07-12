#!/usr/bin/env python3
"""Generate Povvo Spec-Scan GitHub profile widgets.

The pack contains six static SVG widgets and six animated GIF variants.
Only the Current Focus widget uses the exact production mark loaded from
``assets/logo.png``. Every animated widget also has a static SVG equivalent for
reduced-motion use.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import random
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any, Callable, Iterable

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "config.json"
DEFAULT_OUTPUT = ROOT / "generated"
PREVIEW_OUTPUT = ROOT / "preview"
LOGO_SOURCE = ROOT.parent / "assets" / "logo.png"
IDENTITY_SOURCE = ROOT.parent / "assets" / "banner.png"

WIDTH = 900
HEIGHT = 220
RENDER_SCALE = 3
LOOP_DURATION_MS = 7200
MOTION_STEP_MS = 40
GIF_PALETTE_COLOURS = 192

TOKENS = {
    "surface.field": "#F4F6F1",
    "surface.grain": "#DCE4DF",
    "surface.black-board": "#050706",
    "text.primary": "#050706",
    "text.inverse": "#D8ECF8",
    "text.micro": "#25343A",
    "border.hairline": "#6E9DB2",
    "border.focus": "#6E9DB2",
    "scan.edge": "#0B2B34",
    "texture.warm": "#B5A293",
    "status.success": "#287F76",
    "status.error": "#B24A32",
}

FONT_PATHS = {
    "display": "/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf",
    "display_regular": "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
    "body": "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf",
    "body_bold": "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
    "micro": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
}

EVENT_LABELS = {
    "PushEvent": "PUSH",
    "PullRequestEvent": "PR",
    "IssuesEvent": "ISSUE",
    "ReleaseEvent": "RELEASE",
    "CreateEvent": "CREATE",
    "WatchEvent": "STAR",
    "ForkEvent": "FORK",
    "IssueCommentEvent": "COMMENT",
    "PullRequestReviewEvent": "REVIEW",
}


@dataclass
class ProfileData:
    username: str
    display_name: str
    role: str
    status: str
    location: str
    bio: str
    public_repos: int | None
    followers: int | None
    stars: int | None
    forks: int | None
    top_repositories: list[dict[str, Any]]
    languages: list[tuple[str, int]]
    contributions: list[tuple[str, int]]
    total_contributions: int | None
    current_streak: int | None
    longest_streak: int | None
    focus: list[str]
    recent_events: list[dict[str, str]]
    demo: bool = False


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"Configuration file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def request_json(url: str, token: str | None = None, data: bytes | None = None) -> Any:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "povvo-github-widgets/2.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, headers=headers, data=data)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"GitHub request failed ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GitHub request failed: {exc.reason}") from exc


def fetch_repositories(username: str, token: str | None) -> list[dict[str, Any]]:
    repos: list[dict[str, Any]] = []
    for page in range(1, 6):
        url = (
            f"https://api.github.com/users/{username}/repos"
            f"?per_page=100&page={page}&sort=updated&type=owner"
        )
        chunk = request_json(url, token)
        if not isinstance(chunk, list):
            raise RuntimeError("Unexpected repository response from GitHub")
        repos.extend(chunk)
        if len(chunk) < 100:
            break
    return repos


def fetch_languages(
    repos: list[dict[str, Any]], token: str | None, repo_limit: int
) -> list[tuple[str, int]]:
    totals: dict[str, int] = {}
    candidates = sorted(
        repos,
        key=lambda repo: (
            int(repo.get("stargazers_count", 0)),
            str(repo.get("pushed_at", "")),
        ),
        reverse=True,
    )[: max(1, repo_limit)]
    for repo in candidates:
        url = repo.get("languages_url")
        if not url:
            continue
        try:
            language_map = request_json(str(url), token)
        except RuntimeError:
            continue
        if not isinstance(language_map, dict):
            continue
        for language, byte_count in language_map.items():
            totals[str(language)] = totals.get(str(language), 0) + int(byte_count)
    return sorted(totals.items(), key=lambda item: item[1], reverse=True)[:5]


def fetch_contributions(
    username: str, token: str | None
) -> tuple[list[tuple[str, int]], int | None]:
    if not token:
        return [], None
    query = """
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
    """
    payload = json.dumps({"query": query, "variables": {"login": username}}).encode(
        "utf-8"
    )
    response = request_json("https://api.github.com/graphql", token, data=payload)
    errors = response.get("errors") if isinstance(response, dict) else None
    if errors:
        raise RuntimeError(
            f"GitHub GraphQL error: {errors[0].get('message', 'unknown error')}"
        )
    user = response.get("data", {}).get("user")
    if not user:
        return [], None
    calendar = user["contributionsCollection"]["contributionCalendar"]
    days: list[tuple[str, int]] = []
    for week in calendar["weeks"]:
        for day in week["contributionDays"]:
            days.append((str(day["date"]), int(day["contributionCount"])))
    return days[-364:], int(calendar["totalContributions"])


def fetch_events(username: str, token: str | None) -> list[dict[str, str]]:
    raw = request_json(
        f"https://api.github.com/users/{username}/events/public?per_page=100", token
    )
    if not isinstance(raw, list):
        return []
    events: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for item in raw:
        event_type = str(item.get("type") or "Event")
        repo = str((item.get("repo") or {}).get("name") or "unknown/repository")
        created_at = str(item.get("created_at") or "")
        label = EVENT_LABELS.get(event_type, event_type.removesuffix("Event").upper())
        repo_name = repo.split("/", 1)[-1]
        event_date = created_at[:10]
        key = (label, repo_name, event_date)
        if key in seen:
            continue
        seen.add(key)
        events.append({"type": label, "repo": repo_name, "date": event_date})
        if len(events) >= 8:
            break
    return events

def streaks(days: list[tuple[str, int]]) -> tuple[int | None, int | None]:
    if not days:
        return None, None
    parsed = [(datetime.strptime(day, "%Y-%m-%d").date(), count) for day, count in days]
    parsed.sort(key=lambda item: item[0])
    longest = 0
    run = 0
    for _, count in parsed:
        if count > 0:
            run += 1
            longest = max(longest, run)
        else:
            run = 0
    by_date = {day: count for day, count in parsed}
    cursor = date.today()
    if by_date.get(cursor, 0) == 0:
        cursor -= timedelta(days=1)
    current = 0
    while by_date.get(cursor, 0) > 0:
        current += 1
        cursor -= timedelta(days=1)
    return current, longest


def demo_data(config: dict[str, Any]) -> ProfileData:
    today = date.today()
    days: list[tuple[str, int]] = []
    for index in range(364):
        day = today - timedelta(days=363 - index)
        count = 0 if (index * 7 + index // 11) % 9 < 4 else 1 + ((index * 13) % 6)
        days.append((day.isoformat(), count))
    repos = [
        {
            "name": "evaluation-lab",
            "description": "MODEL EVALUATION TOOLING",
            "stars": 72,
            "forks": 14,
            "pushed_at": (today - timedelta(days=2)).isoformat(),
        },
        {
            "name": "trace-index",
            "description": "RESEARCH TRACE SYSTEM",
            "stars": 48,
            "forks": 9,
            "pushed_at": (today - timedelta(days=11)).isoformat(),
        },
        {
            "name": "latent-probe",
            "description": "REPRESENTATION ANALYSIS",
            "stars": 39,
            "forks": 11,
            "pushed_at": (today - timedelta(days=29)).isoformat(),
        },
        {
            "name": "dataset-audit",
            "description": "DATASET INSPECTION",
            "stars": 27,
            "forks": 7,
            "pushed_at": (today - timedelta(days=67)).isoformat(),
        },
    ]
    events = [
        {"type": "PUSH", "repo": "evaluation-lab", "date": today.isoformat()},
        {"type": "REVIEW", "repo": "trace-index", "date": (today - timedelta(days=1)).isoformat()},
        {"type": "PR", "repo": "latent-probe", "date": (today - timedelta(days=2)).isoformat()},
        {"type": "ISSUE", "repo": "dataset-audit", "date": (today - timedelta(days=4)).isoformat()},
        {"type": "CREATE", "repo": "evaluation-lab", "date": (today - timedelta(days=6)).isoformat()},
        {"type": "PUSH", "repo": "trace-index", "date": (today - timedelta(days=8)).isoformat()},
    ]
    return ProfileData(
        username=str(config.get("username") or "YOUR_USERNAME"),
        display_name=str(config.get("display_name") or "YOUR NAME"),
        role=str(config.get("role") or "ML RESEARCH / ENGINEERING"),
        status=str(config.get("status") or "AVAILABLE FOR SELECT PROJECTS"),
        location=str(config.get("location_override") or "LOCATION NOT SET"),
        bio="PROFILE DATA WILL BE INDEXED AFTER CONFIGURATION",
        public_repos=24,
        followers=312,
        stars=186,
        forks=41,
        top_repositories=repos,
        languages=[
            ("Python", 480000),
            ("TypeScript", 260000),
            ("Rust", 145000),
            ("Jupyter", 72000),
            ("Shell", 33000),
        ],
        contributions=days,
        total_contributions=sum(count for _, count in days),
        current_streak=11,
        longest_streak=38,
        focus=[str(item) for item in config.get("focus", [])][:4],
        recent_events=events,
        demo=True,
    )


def fetch_profile(config: dict[str, Any]) -> ProfileData:
    username = str(config.get("username") or "").strip()
    if not username or username.upper() == "YOUR_USERNAME":
        return demo_data(config)

    token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    user = request_json(f"https://api.github.com/users/{username}", token)
    repos = fetch_repositories(username, token)
    if not bool(config.get("include_forks", False)):
        repos = [repo for repo in repos if not bool(repo.get("fork"))]

    stars = sum(int(repo.get("stargazers_count", 0)) for repo in repos)
    forks = sum(int(repo.get("forks_count", 0)) for repo in repos)
    top_repositories: list[dict[str, Any]] = []
    for repo in sorted(
        repos,
        key=lambda item: (
            int(item.get("stargazers_count", 0)),
            str(item.get("pushed_at", "")),
        ),
        reverse=True,
    )[:4]:
        top_repositories.append(
            {
                "name": str(repo.get("name") or "repository"),
                "description": str(repo.get("description") or "NO DESCRIPTION").upper(),
                "stars": int(repo.get("stargazers_count", 0)),
                "forks": int(repo.get("forks_count", 0)),
                "pushed_at": str(repo.get("pushed_at") or ""),
            }
        )

    languages = fetch_languages(
        repos, token, int(config.get("language_repo_limit", 30))
    )
    contributions: list[tuple[str, int]] = []
    total_contributions: int | None = None
    try:
        contributions, total_contributions = fetch_contributions(username, token)
    except RuntimeError as exc:
        print(f"Warning: contribution data unavailable: {exc}", file=sys.stderr)
    current_streak, longest_streak = streaks(contributions)
    try:
        events = fetch_events(username, token)
    except RuntimeError as exc:
        print(f"Warning: event data unavailable: {exc}", file=sys.stderr)
        events = []

    return ProfileData(
        username=username,
        display_name=str(config.get("display_name") or user.get("name") or username),
        role=str(config.get("role") or "OPEN SOURCE PROFILE"),
        status=str(config.get("status") or "INDEXED"),
        location=str(config.get("location_override") or user.get("location") or "LOCATION NOT SET"),
        bio=str(user.get("bio") or "PUBLIC WORK, REPOSITORIES, AND CONTRIBUTIONS"),
        public_repos=int(user.get("public_repos", len(repos))),
        followers=int(user.get("followers", 0)),
        stars=stars,
        forks=forks,
        top_repositories=top_repositories,
        languages=languages,
        contributions=contributions,
        total_contributions=total_contributions,
        current_streak=current_streak,
        longest_streak=longest_streak,
        focus=[str(item) for item in config.get("focus", [])][:4],
        recent_events=events,
        demo=False,
    )


def fmt(value: int | None) -> str:
    if value is None:
        return "N/A"
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.1f}K"
    return str(value)


def truncate(text: str, limit: int) -> str:
    cleaned = " ".join(str(text).split())
    return cleaned if len(cleaned) <= limit else cleaned[: max(1, limit - 1)].rstrip() + "…"


def wrap_words(text: str, line_limit: int = 20, max_lines: int = 2) -> list[str]:
    words = " ".join(str(text).upper().split()).split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= line_limit:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) == max_lines - 1:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    return lines[:max_lines]


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def transparent_logo_crop(
    source: Path, box: tuple[int, int, int, int], fill: str | None = None
) -> Image.Image:
    if not source.exists():
        raise SystemExit(f"Required production logo is missing: {source}")
    image = Image.open(source).convert("RGB")
    if image.size != (1672, 941):
        raise SystemExit(
            f"Unexpected logo.png dimensions {image.size}; expected 1672 x 941"
        )
    crop = image.crop(box)
    output = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    source_px = crop.load()
    output_px = output.load()
    target = hex_rgb(fill) if fill else None
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue = source_px[x, y]
            grey = int(0.299 * red + 0.587 * green + 0.114 * blue)
            alpha = int(max(0, min(255, (205 - grey) / 115 * 255)))
            if alpha < 25:
                alpha = 0
            colour = target if target is not None else (red, green, blue)
            output_px[x, y] = (*colour, alpha)
    return output


def image_data_uri(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    payload = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{payload}"


def wordmark_image(
    mask: Image.Image,
    width: int,
    colour: tuple[int, int, int],
    *,
    outline: bool = False,
    opacity: int = 255,
    outline_width: int = 5,
) -> Image.Image:
    """Render the canonical extracted wordmark without reconstructing its type."""
    height = max(1, round(width * mask.height / mask.width))
    resized = mask.resize((width, height), Image.Resampling.LANCZOS)
    if outline:
        filter_size = max(3, outline_width | 1)
        dilated = resized.filter(ImageFilter.MaxFilter(filter_size))
        eroded = resized.filter(ImageFilter.MinFilter(filter_size))
        alpha = ImageChops.subtract(dilated, eroded)
    else:
        alpha = resized
    if opacity < 255:
        alpha = alpha.point(lambda value: round(value * opacity / 255))
    rendered = Image.new("RGBA", resized.size, (*colour, 0))
    rendered.putalpha(alpha)
    return rendered


def extract_wordmark_mask(source: Path) -> Image.Image:
    if not source.exists():
        raise SystemExit(f"Required identity authority is missing: {source}")
    image = Image.open(source).convert("RGB")
    if image.size != (1983, 793):
        raise SystemExit(
            f"Unexpected banner.png dimensions {image.size}; expected 1983 x 793"
        )
    crop = image.crop((320, 230, 1660, 570))
    mask = Image.new("L", crop.size, 0)
    source_pixels = crop.load()
    mask_pixels = mask.load()
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue = source_pixels[x, y]
            luminance = (299 * red + 587 * green + 114 * blue) // 1000
            chroma = max(red, green, blue) - min(red, green, blue)
            if luminance < 100 and chroma < 40:
                mask_pixels[x, y] = max(0, min(255, round((105 - luminance) * 255 / 100)))
    bounds = mask.getbbox()
    if bounds is None:
        raise SystemExit("The canonical banner does not contain a detectable POVVO wordmark")
    return mask.crop(bounds)


def load_logo_assets() -> dict[str, Any]:
    if not LOGO_SOURCE.exists():
        raise SystemExit(f"Required production logo is missing: {LOGO_SOURCE}")
    source = Image.open(LOGO_SOURCE).convert("RGBA")
    if source.size == (160, 160):
        # The repository stores the compact canonical showcase tile. Isolate the
        # central mark from its measured field and normalise it for widget use.
        rgb = source.convert("RGB")
        alpha = Image.new("L", source.size, 0)
        src_pixels = rgb.load()
        alpha_pixels = alpha.load()
        for y in range(20, 140):
            for x in range(20, 140):
                red, green, blue = src_pixels[x, y]
                luminance = (299 * red + 587 * green + 114 * blue) // 1000
                alpha_pixels[x, y] = max(0, min(255, round((150 - luminance) * 255 / 120)))
        bounds = alpha.getbbox()
        if bounds is None:
            raise SystemExit("The canonical logo tile does not contain a detectable mark")
        alpha = alpha.crop(bounds).resize((176, 106), Image.Resampling.LANCZOS)
        mark = Image.new("RGBA", (197, 125), (*hex_rgb(TOKENS["text.primary"]), 0))
        mark_alpha = Image.new("L", mark.size, 0)
        mark_alpha.paste(alpha, (11, 10))
        mark.putalpha(mark_alpha)
    elif source.size == (197, 125):
        mark = source
    else:
        raise SystemExit(
            f"Unexpected logo.png dimensions {source.size}; expected 160 x 160 canonical tile"
        )
    alpha = mark.getchannel("A")
    inverse = Image.new("RGBA", mark.size, (*hex_rgb(TOKENS["text.inverse"]), 0))
    inverse.putalpha(alpha)
    wordmark_mask = extract_wordmark_mask(IDENTITY_SOURCE)
    wordmark_ink = wordmark_image(wordmark_mask, 430, hex_rgb(TOKENS["text.primary"]))
    wordmark_inverse = wordmark_image(wordmark_mask, 430, hex_rgb(TOKENS["text.inverse"]))
    wordmark_ghost = wordmark_image(
        wordmark_mask,
        980,
        hex_rgb(TOKENS["border.hairline"]),
        outline=True,
        opacity=112,
        outline_width=5,
    )
    return {
        "mark": mark,
        "mark_inverse": inverse,
        "mark_uri": image_data_uri(mark),
        "mark_inverse_uri": image_data_uri(inverse),
        "wordmark_mask": wordmark_mask,
        "wordmark_ink_uri": image_data_uri(wordmark_ink),
        "wordmark_inverse_uri": image_data_uri(wordmark_inverse),
        "wordmark_ghost_uri": image_data_uri(wordmark_ghost),
        "wordmark_ratio": wordmark_mask.width / wordmark_mask.height,
    }


# ---------------------------------------------------------------------------
# SVG construction



# ---------------------------------------------------------------------------
# Povvo v3 rendering primitives


FIELD = hex_rgb(TOKENS["surface.field"])
GRAIN = hex_rgb(TOKENS["surface.grain"])
INK = hex_rgb(TOKENS["text.primary"])
MICRO = hex_rgb(TOKENS["text.micro"])
CYAN = hex_rgb(TOKENS["border.hairline"])
INVERSE = hex_rgb(TOKENS["text.inverse"])
BLACK = hex_rgb(TOKENS["surface.black-board"])
EDGE = hex_rgb(TOKENS["scan.edge"])


FONT_CANDIDATES = {
    "display": [
        "/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-BoldItalic.ttf",
    ],
    "display_regular": [
        "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ],
    "body": [
        "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ],
    "body_bold": [
        "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ],
    "micro": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf",
    ],
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def mix(first: tuple[int, int, int], second: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    amount = clamp(amount)
    return tuple(round(first[index] * (1 - amount) + second[index] * amount) for index in range(3))


def lerp(first: float, second: float, amount: float) -> float:
    return first + (second - first) * amount


def ease_out_quint(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 5


def ease_in_cubic(value: float) -> float:
    value = clamp(value)
    return value ** 3


def ease_in_out_cubic(value: float) -> float:
    value = clamp(value)
    return 4 * value ** 3 if value < 0.5 else 1 - (-2 * value + 2) ** 3 / 2


def sx(value: float) -> int:
    return round(value * RENDER_SCALE)


def sr(value: float) -> int:
    return max(1, round(value * RENDER_SCALE))


def _font_path(role: str) -> str:
    for candidate in FONT_CANDIDATES[role]:
        if Path(candidate).exists():
            return candidate
    raise SystemExit(f"No usable system font found for role: {role}")


@__import__("functools").lru_cache(maxsize=96)
def font(role: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(_font_path(role), sx(size))


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    value: str,
    *,
    role: str = "body",
    size: int = 14,
    fill: tuple[int, int, int] = INK,
    anchor: str = "lt",
) -> None:
    draw.text((sx(xy[0]), sx(xy[1])), value, font=font(role, size), fill=fill, anchor=anchor)


def tracked_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    value: str,
    *,
    fill: tuple[int, int, int] = MICRO,
    size: int = 10,
    tracking: float = 1.1,
    anchor: str = "left",
) -> None:
    value = str(value).upper()
    fnt = font("micro", size)
    widths = [draw.textlength(character, font=fnt) for character in value]
    advance = sx(tracking)
    total = sum(widths) + advance * max(0, len(value) - 1)
    x = sx(xy[0])
    y = sx(xy[1])
    if anchor == "center":
        x -= round(total / 2)
    elif anchor == "right":
        x -= round(total)
    for character, width in zip(value, widths):
        draw.text((x, y), character, font=fnt, fill=fill, anchor="lt")
        x += round(width + advance)


def draw_line(
    draw: ImageDraw.ImageDraw,
    points: tuple[float, float, float, float],
    *,
    fill: tuple[int, int, int] = CYAN,
    width: float = 1.0,
) -> None:
    draw.line(tuple(sx(value) for value in points), fill=fill, width=sr(width))


def draw_rectangle(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    *,
    fill: tuple[int, int, int] | None = None,
    outline: tuple[int, int, int] | None = None,
    width: float = 1.0,
) -> None:
    draw.rectangle(tuple(sx(value) for value in box), fill=fill, outline=outline, width=sr(width))


def draw_bracket(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    *,
    amount: float = 1.0,
    fill: tuple[int, int, int] = CYAN,
    width: float = 1.5,
    corner: float = 9.0,
) -> None:
    amount = ease_out_quint(amount)
    x0, y0, x1, y1 = box
    c = corner * amount
    if c <= 0.01:
        return
    for points in (
        (x0, y0, x0 + c, y0),
        (x0, y0, x0, y0 + c),
        (x1 - c, y0, x1, y0),
        (x1, y0, x1, y0 + c),
        (x0, y1 - c, x0, y1),
        (x0, y1, x0 + c, y1),
        (x1, y1 - c, x1, y1),
        (x1 - c, y1, x1, y1),
    ):
        draw_line(draw, points, fill=fill, width=width)


def draw_pulse(
    draw: ImageDraw.ImageDraw,
    center: tuple[float, float],
    amount: float,
    *,
    background: tuple[int, int, int] = FIELD,
) -> None:
    amount = clamp(amount)
    if amount <= 0:
        return
    radius = lerp(4.5, 12.0, amount)
    colour = mix(background, CYAN, 0.78 * (1 - amount) + 0.18)
    x, y = center
    draw.ellipse(
        (sx(x - radius), sx(y - radius), sx(x + radius), sx(y + radius)),
        outline=colour,
        width=sr(1.0),
    )


def draw_scan_line(
    draw: ImageDraw.ImageDraw,
    x: float,
    y0: float,
    y1: float,
    *,
    direction: int = 1,
    background: tuple[int, int, int] = FIELD,
) -> None:
    draw_line(draw, (x, y0, x, y1), fill=mix(background, CYAN, 0.86), width=1.1)
    cap = 4.0
    y = y0 - 2
    if direction >= 0:
        points = [(sx(x - cap), sx(y)), (sx(x + cap), sx(y)), (sx(x + cap), sx(y + 3))]
    else:
        points = [(sx(x - cap), sx(y)), (sx(x + cap), sx(y)), (sx(x - cap), sx(y + 3))]
    draw.polygon(points, fill=INK if background == FIELD else INVERSE)


def new_field(seed: int) -> Image.Image:
    image = Image.new("RGB", (sx(WIDTH), sx(HEIGHT)), FIELD)
    draw = ImageDraw.Draw(image)
    rng = random.Random(seed)
    grain_colour = mix(FIELD, GRAIN, 0.42)
    for _ in range(470):
        x = rng.randrange(image.width)
        y = rng.randrange(image.height)
        radius = rng.choice((1, 1, 1, 2))
        draw.ellipse((x, y, x + radius, y + radius), fill=grain_colour)
    border = mix(FIELD, CYAN, 0.72)
    draw.rectangle((0, 0, image.width - 1, image.height - 1), outline=border, width=sr(0.65))
    edge_start = sx(872)
    for x in range(edge_start, image.width):
        amount = ((x - edge_start) / max(1, image.width - edge_start)) ** 1.7 * 0.085
        colour = mix(FIELD, EDGE, amount)
        draw.line((x, 0, x, image.height), fill=colour)
    return image


def paste_wordmark(
    image: Image.Image,
    assets: dict[str, Any],
    xy: tuple[float, float],
    width: float,
    *,
    colour: tuple[int, int, int] = CYAN,
    outline: bool = True,
    opacity: int = 84,
    outline_width: float = 2.0,
) -> Image.Image:
    layer = wordmark_image(
        assets["wordmark_mask"],
        sx(width),
        colour,
        outline=outline,
        opacity=opacity,
        outline_width=sr(outline_width),
    )
    image.paste(layer, (sx(xy[0]), sx(xy[1])), layer)
    return layer


def draw_ruler(
    draw: ImageDraw.ImageDraw,
    x0: float,
    x1: float,
    y: float,
    *,
    ticks: int = 18,
    fill: tuple[int, int, int] = CYAN,
) -> None:
    draw_line(draw, (x0, y, x1, y), fill=mix(FIELD, fill, 0.58), width=0.65)
    for index in range(ticks + 1):
        x = lerp(x0, x1, index / max(1, ticks))
        height = 8 if index % 6 == 0 else 4 if index % 3 == 0 else 2
        draw_line(draw, (x, y - height / 2, x, y + height / 2), fill=mix(FIELD, fill, 0.76), width=0.7)


def draw_registration_cross(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    *,
    size: float = 8,
    fill: tuple[int, int, int] = CYAN,
) -> None:
    x, y = xy
    draw_line(draw, (x - size, y, x + size, y), fill=fill, width=0.8)
    draw_line(draw, (x, y - size, x, y + size), fill=fill, width=0.8)
    draw.ellipse(
        (sx(x - 1.4), sx(y - 1.4), sx(x + 1.4), sx(y + 1.4)),
        outline=fill,
        width=sr(0.7),
    )


def draw_signature_slashes(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    *,
    fill: tuple[int, int, int] = INK,
) -> None:
    x, y = xy
    for index in range(4):
        offset = index * 11
        draw_line(draw, (x + offset, y + 8, x + offset + 7, y - 4), fill=fill, width=2.2)


def draw_header(draw: ImageDraw.ImageDraw, title: str, number: int, data: ProfileData, *, x: float = 40) -> None:
    tracked_text(draw, (x, 28), title, size=10)
    draw_text(draw, (846, 15), f"{number:02d}", role="display", size=34, fill=mix(FIELD, CYAN, 0.42), anchor="rt")
    draw_line(draw, (x, 47, x + 34, 47), fill=INK, width=1.5)
    draw_line(draw, (x + 34, 47, x + 76, 47), fill=mix(FIELD, CYAN, 0.82), width=0.8)
    draw_ruler(draw, 560, 790, 30, ticks=18)
    if data.demo:
        tracked_text(draw, (528, 28), "DEMO DATA", size=9, anchor="right")


def draw_footer(draw: ImageDraw.ImageDraw, label: str) -> None:
    tracked_text(draw, (40, 201), label, size=9)
    draw_signature_slashes(draw, (792, 195))
    draw_registration_cross(draw, (858, 197), size=6)


def downsample(image: Image.Image) -> Image.Image:
    return image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


@dataclass(frozen=True)
class MotionPlan:
    start_ms: int
    reveal_end_ms: int
    lock_end_ms: int
    hold_end_ms: int
    exit_end_ms: int
    loop_end_ms: int = LOOP_DURATION_MS


def frame_schedule(plan: MotionPlan) -> list[tuple[int, int]]:
    frames: list[tuple[int, int]] = [(0, plan.start_ms)]

    def motion(first: int, last: int) -> None:
        current = first + MOTION_STEP_MS
        while current < last:
            frames.append((current, MOTION_STEP_MS))
            current += MOTION_STEP_MS
        if last > first:
            remainder = last - (frames[-1][0] if frames[-1][0] >= first else first)
            if not frames or frames[-1][0] != last:
                frames.append((last, max(10, remainder if remainder < MOTION_STEP_MS else MOTION_STEP_MS)))

    motion(plan.start_ms, plan.lock_end_ms)
    hold_duration = max(10, plan.hold_end_ms - plan.lock_end_ms)
    frames.append((plan.lock_end_ms, hold_duration))
    motion(plan.hold_end_ms, plan.exit_end_ms)
    tail_duration = max(10, plan.loop_end_ms - plan.exit_end_ms)
    frames.append((plan.exit_end_ms, tail_duration))

    # Remove adjacent duplicate timestamps while preserving the later duration.
    compact: list[tuple[int, int]] = []
    for timestamp, duration in frames:
        if compact and compact[-1][0] == timestamp:
            compact[-1] = (timestamp, duration)
        else:
            compact.append((timestamp, duration))
    total = sum(duration for _, duration in compact)
    if total != plan.loop_end_ms:
        timestamp, duration = compact[-1]
        compact[-1] = (timestamp, duration + plan.loop_end_ms - total)
    return compact


def save_gif(path: Path, frames: list[Image.Image], durations: list[int]) -> None:
    if not frames or len(frames) != len(durations):
        raise ValueError("Animation frames and durations must be non-empty and aligned")
    sample_count = min(8, len(frames))
    sample_indices = sorted({round(index * (len(frames) - 1) / max(1, sample_count - 1)) for index in range(sample_count)})
    sheet = Image.new("RGB", (WIDTH * 2, HEIGHT * math.ceil(len(sample_indices) / 2)), FIELD)
    for index, frame_index in enumerate(sample_indices):
        sheet.paste(frames[frame_index], ((index % 2) * WIDTH, (index // 2) * HEIGHT))
    master = sheet.convert("P", palette=Image.Palette.ADAPTIVE, colors=GIF_PALETTE_COLOURS)
    quantized = [frame.quantize(palette=master, dither=Image.Dither.NONE) for frame in frames]
    quantized[0].save(
        path,
        save_all=True,
        append_images=quantized[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=1,
    )


def render_animation(
    path: Path,
    renderer: Callable[[int], Image.Image],
    plan: MotionPlan,
) -> tuple[list[Image.Image], list[int]]:
    schedule = frame_schedule(plan)
    frames = [renderer(timestamp) for timestamp, _ in schedule]
    durations = [duration for _, duration in schedule]
    save_gif(path, frames, durations)
    return frames, durations


# ---------------------------------------------------------------------------
# SVG construction


def svg_start(title: str, description: str) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="title desc">',
        f'<title id="title">{escape(title)}</title>',
        f'<desc id="desc">{escape(description)}</desc>',
        "<defs>",
        '<linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="#0B2B34" stop-opacity="0"/><stop offset="1" stop-color="#0B2B34" stop-opacity="0.085"/></linearGradient>',
        '<pattern id="grain" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="4" r=".45" fill="#DCE4DF"/><circle cx="13" cy="8" r=".35" fill="#DCE4DF"/><circle cx="7" cy="17" r=".3" fill="#DCE4DF"/></pattern>',
        '<style>',
        '.micro{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:1.1px;fill:#25343A}',
        '.micro9{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:9px;font-weight:700;letter-spacing:1px;fill:#25343A}',
        '.body{font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;fill:#050706}',
        '.bodybold{font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;fill:#050706}',
        '.display{font-family:Inter,Arial Narrow,Helvetica,sans-serif;font-size:27px;font-weight:900;font-style:italic;fill:#050706;font-variant-numeric:tabular-nums}',
        '.utility{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:700;fill:#050706;font-variant-numeric:tabular-nums}',
        '.inverse{fill:#D8ECF8}',
        '</style>',
        "</defs>",
        '<rect width="900" height="220" fill="#F4F6F1"/>',
        '<rect width="900" height="220" fill="url(#grain)" opacity=".18"/>',
        '<rect x=".5" y=".5" width="899" height="219" fill="none" stroke="#6E9DB2" stroke-opacity=".72"/>',
        '<rect x="872" width="28" height="220" fill="url(#edge)"/>',
    ]


def svg_wordmark(
    lines: list[str],
    href: str,
    ratio: float,
    *,
    x: float,
    y: float,
    width: float,
    opacity: float = 1.0,
) -> None:
    height = width / ratio
    lines.append(
        f'<image x="{x}" y="{y}" width="{width}" height="{height:.2f}" opacity="{opacity:.3f}" href="{href}" preserveAspectRatio="xMidYMid meet"/>'
    )


def svg_ruler(lines: list[str], x0: float, x1: float, y: float, *, ticks: int = 18) -> None:
    lines.append(f'<path d="M{x0} {y}H{x1}" stroke="#6E9DB2" stroke-opacity=".58" stroke-width=".65"/>')
    for index in range(ticks + 1):
        x = lerp(x0, x1, index / max(1, ticks))
        height = 8 if index % 6 == 0 else 4 if index % 3 == 0 else 2
        lines.append(
            f'<path d="M{x:.2f} {y-height/2:.2f}V{y+height/2:.2f}" stroke="#6E9DB2" stroke-opacity=".76" stroke-width=".7"/>'
        )


def svg_registration_cross(lines: list[str], x: float, y: float, *, size: float = 6) -> None:
    lines.append(
        f'<path d="M{x-size} {y}H{x+size}M{x} {y-size}V{y+size}" fill="none" stroke="#6E9DB2" stroke-width=".8"/>'
    )
    lines.append(f'<circle cx="{x}" cy="{y}" r="1.4" fill="none" stroke="#6E9DB2" stroke-width=".7"/>')


def svg_header(lines: list[str], title: str, number: int, data: ProfileData, *, x: int = 40) -> None:
    lines.append(f'<text x="{x}" y="36" class="micro">{escape(title)}</text>')
    lines.append(f'<text x="846" y="42" text-anchor="end" class="display" style="font-size:34px;fill:#DCE4DF">{number:02d}</text>')
    lines.append(f'<path d="M{x} 47H{x+34}" stroke="#050706" stroke-width="1.5"/>')
    lines.append(f'<path d="M{x+34} 47H{x+76}" stroke="#6E9DB2" stroke-width=".8"/>')
    svg_ruler(lines, 560, 790, 30, ticks=18)
    if data.demo:
        lines.append('<text x="528" y="36" text-anchor="end" class="micro9">DEMO DATA</text>')


def svg_footer(lines: list[str], label: str) -> None:
    lines.append(f'<text x="40" y="209" class="micro9">{escape(label)}</text>')
    lines.append('<path d="M792 203l7-12m4 12 7-12m4 12 7-12m4 12 7-12" stroke="#050706" stroke-width="2.2"/>')
    svg_registration_cross(lines, 858, 197, size=6)


def svg_bracket(lines: list[str], box: tuple[float, float, float, float], *, corner: float = 9, width: float = 1.5) -> None:
    x0, y0, x1, y1 = box
    paths = [
        f"M{x0} {y0}h{corner}M{x0} {y0}v{corner}",
        f"M{x1-corner} {y0}h{corner}M{x1} {y0}v{corner}",
        f"M{x0} {y1-corner}v{corner}M{x0} {y1}h{corner}",
        f"M{x1} {y1-corner}v{corner}M{x1-corner} {y1}h{corner}",
    ]
    lines.append(f'<path d="{" ".join(paths)}" fill="none" stroke="#6E9DB2" stroke-width="{width}"/>')


def contribution_svg(data: ProfileData, assets: dict[str, Any]) -> str:
    lines = svg_start(
        "Povvo contribution scan",
        f"A measured 364-day contribution field with total and streak values for @{data.username}.",
    )
    svg_wordmark(lines, assets["wordmark_ghost_uri"], assets["wordmark_ratio"], x=252, y=48, width=790, opacity=.42)
    svg_header(lines, "CONTRIBUTION SCAN", 1, data)
    stats = [("TOTAL", data.total_contributions), ("CURRENT", data.current_streak), ("LONGEST", data.longest_streak)]
    for index, (label, value) in enumerate(stats):
        x = 40 + index * 108
        lines.append(f'<text x="{x}" y="86" class="display">{escape(fmt(value))}</text>')
        lines.append(f'<text x="{x}" y="103" class="micro9">{escape(label)}</text>')
    days = (data.contributions or [("", 0)] * 364)[-364:]
    max_count = max(1, max(count for _, count in days))
    for index, (_, count) in enumerate(days):
        week, weekday = divmod(index, 7)
        x, y = 40 + week * 11, 116 + weekday * 11
        opacity = 0.0 if count <= 0 else 0.28 + 0.66 * count / max_count
        lines.append(
            f'<rect x="{x}" y="{y}" width="8" height="8" fill="#050706" fill-opacity="{opacity:.3f}" stroke="#6E9DB2" stroke-opacity=".68" stroke-width=".65"/>'
        )
    x_now = 40 + 51 * 11
    svg_bracket(lines, (x_now - 2, 112, x_now + 10, 194), corner=4, width=1.2)
    lines.append('<text x="642" y="128" class="micro">364 DAYS</text>')
    lines.append('<path d="M642 139H836" stroke="#6E9DB2" stroke-width=".8"/>')
    lines.append('<text x="642" y="160" class="micro9">SCAN / LOCK / RETURN</text>')
    lines.append('<text x="642" y="181" class="micro9">DARKER = HIGHER COUNT</text>')
    svg_footer(lines, "PUBLIC CONTRIBUTIONS / 52 × 7 FIELD")
    lines.append("</svg>")
    return "\n".join(lines)


def focus_svg(data: ProfileData, assets: dict[str, Any]) -> str:
    lines = svg_start(
        "Povvo current focus",
        f"Current workstreams for @{data.username}, with the exact Povvo wordmark on a black identity board.",
    )
    lines.append('<rect x="0" y="0" width="900" height="220" fill="#050706"/>')
    lines.append('<rect x=".5" y=".5" width="899" height="219" fill="none" stroke="#6E9DB2" stroke-opacity=".82"/>')
    svg_wordmark(lines, assets["wordmark_ghost_uri"], assets["wordmark_ratio"], x=-92, y=35, width=780, opacity=.94)
    svg_wordmark(lines, assets["wordmark_inverse_uri"], assets["wordmark_ratio"], x=44, y=78, width=430, opacity=1)
    lines.append('<path d="M548 34V188" stroke="#6E9DB2" stroke-opacity=".82"/>')
    lines.append('<text x="32" y="36" class="micro inverse">POVVO / CURRENT FOCUS</text>')
    lines.append('<text x="846" y="42" text-anchor="end" class="display" style="font-size:34px;fill:#0B2B34">02</text>')
    svg_ruler(lines, 610, 790, 30, ticks=15)
    if data.demo:
        lines.append('<text x="520" y="36" text-anchor="end" class="micro9 inverse">DEMO</text>')
    status_lines = wrap_words(data.status, 22, 2)
    for index, value in enumerate(status_lines):
        lines.append(f'<text x="32" y="{192 + index * 12}" class="micro9 inverse">{escape(value)}</text>')
    lines.append('<text x="582" y="64" class="micro inverse">ACTIVE WORKSTREAMS</text>')
    focus = (data.focus or ["NO FOCUS ITEMS CONFIGURED"])[:4]
    for index, item in enumerate(focus):
        y = 82 + index * 31
        lines.append(f'<text x="582" y="{y+17}" class="display inverse" style="font-size:19px">{index+1:02d}</text>')
        lines.append(f'<path d="M622 {y+10}H846" stroke="#6E9DB2" stroke-opacity=".78" stroke-width=".8"/>')
        lines.append(f'<text x="636" y="{y+17}" class="body inverse" style="font-size:12px">{escape(truncate(item.upper(), 28))}</text>')
    svg_bracket(lines, (570, 78, 854, 108), corner=9, width=1.4)
    lines.append(f'<text x="582" y="205" class="micro9 inverse">{escape(truncate(data.bio.upper(), 40))}</text>')
    lines.append("</svg>")
    return "\n".join(lines)


def repository_index_svg(data: ProfileData, assets: dict[str, Any]) -> str:
    repos = list(data.top_repositories[:4])
    lines = svg_start(
        "Povvo repository index",
        f"Repository totals and {len(repos)} indexed public repositories for @{data.username}.",
    )
    svg_wordmark(lines, assets["wordmark_ghost_uri"], assets["wordmark_ratio"], x=-196, y=58, width=760, opacity=.34)
    svg_header(lines, "REPOSITORY INDEX", 3, data)
    lines.append('<path d="M310 64V187" stroke="#050706" stroke-width="2"/>')
    stats = [
        ("REPOSITORIES", data.public_repos, 40, 67),
        ("FOLLOWERS", data.followers, 166, 67),
        ("STARS", data.stars, 40, 129),
        ("FORKS", data.forks, 166, 129),
    ]
    for label, value, x, y in stats:
        lines.append(f'<text x="{x}" y="{y+25}" class="display">{escape(fmt(value))}</text>')
        lines.append(f'<text x="{x}" y="{y+43}" class="micro9">{label}</text>')
    lines.append(f'<text x="346" y="72" class="micro">TOP REPOSITORIES / {len(repos):02d}</text>')
    if repos:
        for index, repo in enumerate(repos):
            y = 88 + index * 27
            lines.append(f'<path d="M346 {y-8}H836" stroke="#6E9DB2" stroke-width=".75"/>')
            lines.append(f'<text x="346" y="{y+8}" class="bodybold">{escape(truncate(str(repo.get("name", "")), 28))}</text>')
            lines.append(f'<text x="836" y="{y+7}" text-anchor="end" class="micro9">S {repo.get("stars", 0)} / F {repo.get("forks", 0)}</text>')
        svg_bracket(lines, (338, 78, 844, 105), corner=8, width=1.2)
    else:
        lines.append('<path d="M346 82H836" stroke="#DCE4DF" stroke-width="2"/>')
        lines.append('<text x="346" y="110" class="bodybold">NO PUBLIC REPOSITORIES INDEXED</text>')
    svg_footer(lines, "PUBLIC REPOSITORIES / STAR-WEIGHTED INDEX")
    lines.append("</svg>")
    return "\n".join(lines)

def event_rail_svg(data: ProfileData, assets: dict[str, Any]) -> str:
    events = list(data.recent_events[:6])
    lines = svg_start(
        "Povvo event rail",
        f"Up to six distinct recent public GitHub events for @{data.username}, ordered from most recent to oldest.",
    )
    svg_wordmark(lines, assets["wordmark_ghost_uri"], assets["wordmark_ratio"], x=142, y=53, width=900, opacity=.34)
    svg_header(lines, "EVENT RAIL", 4, data)
    x0, x1, y = 72, 788, 86
    lines.append(f'<path d="M{x0} {y}H{x1}" stroke="#050706" stroke-width="1.8"/>')
    if events:
        if len(events) == 1:
            node_xs = [(x0 + x1) / 2]
        else:
            node_xs = [x0 + index * ((x1 - x0) / (len(events) - 1)) for index in range(len(events))]
        for x, event in zip(node_xs, events):
            lines.append(f'<path d="M{x} {y-14}V{y+14}" stroke="#6E9DB2" stroke-width="1"/>')
            lines.append(f'<circle cx="{x}" cy="{y}" r="4" fill="#050706"/>')
            lines.append(f'<text x="{x}" y="115" text-anchor="middle" class="micro9">{escape(event["type"])}</text>')
            lines.append(f'<text x="{x}" y="139" text-anchor="middle" class="bodybold" style="font-size:12px">{escape(truncate(event["repo"], 18))}</text>')
            lines.append(f'<text x="{x}" y="161" text-anchor="middle" class="micro9" style="font-size:8px">{escape(event["date"])}</text>')
        first_x = node_xs[0]
        svg_bracket(lines, (first_x - 18, 62, first_x + 18, 178), corner=8, width=1.2)
    else:
        lines.append('<text x="430" y="132" text-anchor="middle" class="bodybold">NO PUBLIC EVENTS INDEXED</text>')
    svg_footer(lines, "PUBLIC EVENTS / MOST RECENT FIRST")
    lines.append("</svg>")
    return "\n".join(lines)

def language_metrics(data: ProfileData) -> tuple[list[tuple[str, int]], list[float], float]:
    languages = list(data.languages[:5])
    if not languages:
        return [], [], 100.0
    total = max(1, sum(value for _, value in languages))
    percentages = [value / total * 100 for _, value in languages]
    maximum = max(10.0, math.ceil(max(percentages) / 10.0) * 10.0)
    return languages, percentages, maximum

def code_spectrum_svg(data: ProfileData, assets: dict[str, Any]) -> str:
    lines = svg_start(
        "Povvo code spectrum",
        f"Byte-weighted language proportions from public repositories for @{data.username}, or an explicit empty state when no language data is published.",
    )
    svg_wordmark(lines, assets["wordmark_ghost_uri"], assets["wordmark_ratio"], x=-84, y=64, width=940, opacity=.30)
    svg_header(lines, "CODE SPECTRUM", 5, data)
    languages, percentages, scale_max = language_metrics(data)
    x0, x1 = 200, 744
    lines.append(f'<path d="M{x0} 56H{x1}" stroke="#6E9DB2" stroke-width=".8"/>')
    for tick in range(11):
        x = x0 + (x1 - x0) * tick / 10
        height = 8 if tick in (0, 5, 10) else 4
        lines.append(f'<path d="M{x} {56-height/2}V{56+height/2}" stroke="#6E9DB2" stroke-width=".7"/>')
    lines.append(f'<text x="{x0}" y="49" class="micro9">0</text>')
    lines.append(f'<text x="{x1}" y="49" text-anchor="end" class="micro9">{scale_max:.0f}% SCALE</text>')
    if languages:
        for index, ((name, _), percent) in enumerate(zip(languages, percentages)):
            y = 76 + index * 25
            endpoint = x0 + (x1 - x0) * percent / scale_max
            lines.append(f'<text x="40" y="{y+4}" class="micro">{escape(truncate(name, 18).upper())}</text>')
            lines.append(f'<path d="M{x0} {y}H{x1}" stroke="#DCE4DF" stroke-width="10"/>')
            lines.append(f'<path d="M{x0} {y}H{endpoint:.2f}" stroke="#050706" stroke-width="10"/>')
            lines.append(f'<path d="M{endpoint:.2f} {y-8}V{y+8}" stroke="#6E9DB2" stroke-width="1.2"/>')
            lines.append(f'<text x="834" y="{y+4}" text-anchor="end" class="utility">{percent:04.1f}%</text>')
    else:
        lines.append('<path d="M200 98H744" stroke="#DCE4DF" stroke-width="2"/>')
        lines.append('<text x="40" y="104" class="bodybold">NO PUBLIC LANGUAGE DATA</text>')
    svg_footer(lines, "BYTE-WEIGHTED / PUBLIC REPOSITORIES")
    lines.append("</svg>")
    return "\n".join(lines)

def repo_age_days(repo: dict[str, Any]) -> int:
    pushed = str(repo.get("pushed_at") or "")
    if not pushed:
        return 120
    try:
        pushed_date = datetime.fromisoformat(pushed.replace("Z", "+00:00")).date()
    except ValueError:
        return 120
    return max(0, min(120, (date.today() - pushed_date).days))


def repository_signal_svg(data: ProfileData, assets: dict[str, Any]) -> str:
    repos = list(data.top_repositories[:4])
    lines = svg_start(
        "Povvo repository signal",
        f"Last-push ages for {len(repos)} indexed public repositories belonging to @{data.username}.",
    )
    svg_wordmark(lines, assets["wordmark_ghost_uri"], assets["wordmark_ratio"], x=208, y=68, width=850, opacity=.30)
    svg_header(lines, "REPOSITORY SIGNAL", 6, data)
    x0, x1 = 254, 824
    lines.append(f'<path d="M{x0} 60H{x1}" stroke="#6E9DB2" stroke-width=".8"/>')
    for tick in range(13):
        x = x0 + (x1 - x0) * tick / 12
        h = 8 if tick % 3 == 0 else 4
        lines.append(f'<path d="M{x} {60-h/2}V{60+h/2}" stroke="#6E9DB2" stroke-width=".7"/>')
    lines.append(f'<text x="{x0}" y="50" class="micro9">120D</text>')
    lines.append(f'<text x="{x1-94}" y="50" text-anchor="end" class="micro9">NOW / 0D</text>')
    if repos:
        for index, repo in enumerate(repos):
            y = 82 + index * 30
            age = repo_age_days(repo)
            node_x = x1 - (x1 - x0) * age / 120
            lines.append(f'<text x="40" y="{y+4}" class="micro9">{escape(truncate(str(repo.get("name", "")), 25).upper())}</text>')
            lines.append(f'<path d="M{x0} {y}H{x1}" stroke="#DCE4DF" stroke-width="2"/>')
            lines.append(f'<path d="M{node_x:.2f} {y}H{x1}" stroke="#050706" stroke-width="2"/>')
            lines.append(f'<circle cx="{node_x:.2f}" cy="{y}" r="4" fill="#F4F6F1" stroke="#050706" stroke-width="2"/>')
            lines.append(f'<text x="846" y="{y+4}" text-anchor="end" class="micro9">{age:02d}D</text>')
        youngest = min(repos, key=repo_age_days)
        youngest_index = repos.index(youngest)
        youngest_age = repo_age_days(youngest)
        youngest_x = x1 - (x1 - x0) * youngest_age / 120
        youngest_y = 82 + youngest_index * 30
        svg_bracket(lines, (youngest_x - 10, youngest_y - 12, youngest_x + 10, youngest_y + 12), corner=5, width=1.1)
    else:
        lines.append('<text x="40" y="106" class="bodybold">NO PUBLIC REPOSITORIES INDEXED</text>')
    svg_footer(lines, "LAST PUSH / AGE SPAN FROM NOW")
    lines.append("</svg>")
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# High-resolution motion renderers


def _paste_reveal(
    image: Image.Image,
    layer: Image.Image,
    box: tuple[int, int, int, int],
    amount: float,
) -> None:
    amount = clamp(amount)
    if amount <= 0:
        return
    x0, y0, x1, y1 = box
    visible_x1 = x0 + max(1, round((x1 - x0) * amount))
    crop = layer.crop((sx(x0), sx(y0), sx(visible_x1), sx(y1)))
    image.paste(crop, (sx(x0), sx(y0)), crop)


def make_contribution_renderer(
    data: ProfileData, assets: dict[str, Any], plan: MotionPlan
) -> Callable[[int], Image.Image]:
    base = new_field(201)
    paste_wordmark(base, assets, (252, 48), 790, opacity=44, outline_width=2.0)
    draw = ImageDraw.Draw(base)
    draw_header(draw, "CONTRIBUTION SCAN", 1, data)
    stats = [("TOTAL", data.total_contributions), ("CURRENT", data.current_streak), ("LONGEST", data.longest_streak)]
    for index, (label, value) in enumerate(stats):
        x = 40 + index * 108
        draw_text(draw, (x, 61), fmt(value), role="display", size=27)
        tracked_text(draw, (x, 94), label, size=9)
    origin_x, origin_y = 40, 116
    for index in range(364):
        week, weekday = divmod(index, 7)
        x, y = origin_x + week * 11, origin_y + weekday * 11
        draw_rectangle(
            draw,
            (x, y, x + 8, y + 8),
            outline=mix(FIELD, CYAN, 0.72),
            width=0.65,
        )
    tracked_text(draw, (642, 119), "364 DAYS", size=10)
    draw_line(draw, (642, 139, 836, 139), fill=mix(FIELD, CYAN, 0.8), width=0.8)
    tracked_text(draw, (642, 151), "SCAN / LOCK / RETURN", size=9)
    tracked_text(draw, (642, 172), "DARKER = HIGHER COUNT", size=9)
    draw_footer(draw, "PUBLIC CONTRIBUTIONS / 52 × 7 FIELD")

    days = (data.contributions or [("", 0)] * 364)[-364:]
    max_count = max(1, max(count for _, count in days))
    x_first = origin_x - 4
    x_last = origin_x + 51 * 11 + 12

    def renderer(timestamp: int) -> Image.Image:
        image = base.copy()
        frame = ImageDraw.Draw(image)
        entering = plan.start_ms < timestamp <= plan.reveal_end_ms
        locking = plan.reveal_end_ms < timestamp <= plan.lock_end_ms
        holding = plan.lock_end_ms <= timestamp <= plan.hold_end_ms
        exiting = plan.hold_end_ms < timestamp < plan.exit_end_ms

        if entering:
            progress = clamp((timestamp - plan.start_ms) / (plan.reveal_end_ms - plan.start_ms))
            scan_week = lerp(-0.8, 51.8, progress)
        elif locking or holding:
            progress = 1.0
            scan_week = 52.0
        elif exiting:
            exit_progress = clamp((timestamp - plan.hold_end_ms) / (plan.exit_end_ms - plan.hold_end_ms))
            scan_week = lerp(51.8, -1.2, ease_in_cubic(exit_progress))
            progress = 1.0
        else:
            scan_week = -1.2
            progress = 0.0

        for index, (_, count) in enumerate(days):
            if count <= 0:
                continue
            week, weekday = divmod(index, 7)
            if entering:
                local = ease_out_quint(clamp((scan_week - week + 0.15) / 0.72))
            elif locking or holding:
                local = 1.0
            elif exiting:
                local = ease_in_out_cubic(clamp((scan_week - week + 0.85) / 0.85))
            else:
                local = 0.0
            if local <= 0:
                continue
            x = origin_x + week * 11
            y = origin_y + weekday * 11
            size = lerp(2.0, 8.0, local)
            inset = (8.0 - size) / 2
            intensity = 0.28 + 0.66 * count / max_count
            fill = mix(FIELD, INK, intensity * local)
            draw_rectangle(frame, (x + inset, y + inset, x + 8 - inset, y + 8 - inset), fill=fill)

        if entering:
            scan_x = lerp(x_first, x_last, progress)
            draw_scan_line(frame, scan_x, 109, 195, direction=1)
        elif exiting:
            exit_progress = clamp((timestamp - plan.hold_end_ms) / (plan.exit_end_ms - plan.hold_end_ms))
            scan_x = lerp(x_last, x_first, ease_in_cubic(exit_progress))
            draw_scan_line(frame, scan_x, 109, 195, direction=-1)

        if locking:
            bracket_amount = (timestamp - plan.reveal_end_ms) / max(1, plan.lock_end_ms - plan.reveal_end_ms)
        elif holding:
            bracket_amount = 1.0
        elif exiting:
            bracket_amount = 1.0 - (timestamp - plan.hold_end_ms) / max(1, plan.exit_end_ms - plan.hold_end_ms)
        else:
            bracket_amount = 0.0
        x_now = origin_x + 51 * 11
        draw_bracket(frame, (x_now - 2, 112, x_now + 10, 194), amount=bracket_amount, corner=4, width=1.2)
        return downsample(image)

    return renderer


def _wordmark_layers(assets: dict[str, Any]) -> tuple[Image.Image, Image.Image]:
    fill = wordmark_image(assets["wordmark_mask"], sx(430), INVERSE)
    outline = wordmark_image(
        assets["wordmark_mask"],
        sx(780),
        CYAN,
        outline=True,
        opacity=138,
        outline_width=sr(2.0),
    )
    return fill, outline


def make_focus_renderer(data: ProfileData, assets: dict[str, Any], plan: MotionPlan) -> Callable[[int], Image.Image]:
    base = Image.new("RGB", (sx(WIDTH), sx(HEIGHT)), BLACK)
    draw = ImageDraw.Draw(base)
    rng = random.Random(203)
    board_grain = mix(BLACK, INVERSE, 0.055)
    for _ in range(360):
        x = rng.randrange(sx(WIDTH))
        y = rng.randrange(sx(220))
        draw.ellipse((x, y, x + 1, y + 1), fill=board_grain)
    draw_rectangle(draw, (0.5, 0.5, 899.5, 219.5), outline=CYAN, width=0.8)
    fill_logo, outline_logo = _wordmark_layers(assets)
    base.paste(outline_logo, (sx(-92), sx(35)), outline_logo)
    draw = ImageDraw.Draw(base)
    draw_line(draw, (548, 34, 548, 188), fill=CYAN, width=0.9)
    tracked_text(draw, (32, 28), "POVVO / CURRENT FOCUS", fill=INVERSE, size=10)
    draw_text(draw, (846, 15), "02", role="display", size=34, fill=EDGE, anchor="rt")
    draw_ruler(draw, 610, 790, 30, ticks=15)
    if data.demo:
        tracked_text(draw, (520, 28), "DEMO", fill=INVERSE, size=9, anchor="right")
    status_lines = wrap_words(data.status, 22, 2)
    for index, value in enumerate(status_lines):
        tracked_text(draw, (32, 192 + index * 12), value, fill=INVERSE, size=9)
    tracked_text(draw, (582, 56), "ACTIVE WORKSTREAMS", fill=INVERSE, size=10)
    focus = (data.focus or ["NO FOCUS ITEMS CONFIGURED"])[:4]
    row_ys: list[float] = []
    for index, item in enumerate(focus):
        y = 82 + index * 31
        row_ys.append(y)
        draw_text(draw, (582, y), f"{index+1:02d}", role="display", size=19, fill=INVERSE)
        draw_line(draw, (622, y + 10, 846, y + 10), fill=mix(BLACK, CYAN, 0.82), width=0.75)
        draw_text(draw, (636, y + 1), truncate(item.upper(), 28), role="body", size=12, fill=INVERSE)
    tracked_text(draw, (582, 195), truncate(data.bio.upper(), 40), fill=INVERSE, size=9)
    draw_signature_slashes(draw, (786, 195), fill=INVERSE)
    draw_registration_cross(draw, (858, 197), size=6, fill=CYAN)
    logo_xy = (sx(44), sx(78))

    def renderer(timestamp: int) -> Image.Image:
        image = base.copy()
        image.paste(outline_logo, logo_xy, outline_logo)
        frame = ImageDraw.Draw(image)
        entering = plan.start_ms < timestamp <= plan.reveal_end_ms
        locking = plan.reveal_end_ms < timestamp <= plan.lock_end_ms
        holding = plan.lock_end_ms <= timestamp <= plan.hold_end_ms
        exiting = plan.hold_end_ms < timestamp < plan.exit_end_ms

        if entering:
            fill_amount = ease_out_quint((timestamp - plan.start_ms) / (plan.reveal_end_ms - plan.start_ms))
        elif locking or holding:
            fill_amount = 1.0
        elif exiting:
            fill_amount = 1.0 - ease_in_cubic((timestamp - plan.hold_end_ms) / (plan.exit_end_ms - plan.hold_end_ms))
        else:
            fill_amount = 0.0

        if fill_amount > 0:
            visible_width = max(1, round(fill_logo.width * fill_amount))
            crop = fill_logo.crop((0, 0, visible_width, fill_logo.height))
            image.paste(crop, logo_xy, crop)

        if entering:
            scan_x = 44 + 430 * fill_amount
            draw_scan_line(frame, scan_x, 68, 164, direction=1, background=BLACK)
            if row_ys:
                scan_progress = clamp((timestamp - plan.start_ms) / (plan.reveal_end_ms - plan.start_ms))
                scan_y = lerp(row_ys[0] - 6, row_ys[-1] + 28, scan_progress)
                draw_line(frame, (566, scan_y, 854, scan_y), fill=mix(BLACK, CYAN, 0.86), width=1.0)
        elif exiting:
            scan_x = 44 + 430 * fill_amount
            draw_scan_line(frame, scan_x, 68, 164, direction=-1, background=BLACK)

        if locking:
            bracket_amount = (timestamp - plan.reveal_end_ms) / max(1, plan.lock_end_ms - plan.reveal_end_ms)
        elif holding:
            bracket_amount = 1.0
        elif exiting:
            bracket_amount = 1.0 - (timestamp - plan.hold_end_ms) / max(1, plan.exit_end_ms - plan.hold_end_ms)
        else:
            bracket_amount = 0.0
        if row_ys:
            draw_bracket(frame, (570, row_ys[0] - 4, 854, row_ys[0] + 26), amount=bracket_amount, corner=9, width=1.4)
        return downsample(image)

    return renderer


def make_repository_index_renderer(
    data: ProfileData, assets: dict[str, Any], plan: MotionPlan
) -> Callable[[int], Image.Image]:
    base = new_field(205)
    paste_wordmark(base, assets, (-196, 58), 760, opacity=36, outline_width=2.0)
    draw = ImageDraw.Draw(base)
    draw_header(draw, "REPOSITORY INDEX", 3, data)
    draw_line(draw, (310, 64, 310, 187), fill=INK, width=2)
    stats = [
        ("REPOSITORIES", data.public_repos, 40, 67),
        ("FOLLOWERS", data.followers, 166, 67),
        ("STARS", data.stars, 40, 129),
        ("FORKS", data.forks, 166, 129),
    ]
    stat_layers: list[tuple[Image.Image, tuple[int, int, int, int]]] = []
    for label, value, x, y in stats:
        tracked_text(draw, (x, y + 34), label, size=9)
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        layer_draw = ImageDraw.Draw(layer)
        draw_text(layer_draw, (x, y), fmt(value), role="display", size=27, fill=INK)
        stat_layers.append((layer, (x, y - 2, x + 112, y + 31)))
    repos = list(data.top_repositories[:4])
    tracked_text(draw, (346, 64), f"TOP REPOSITORIES / {len(repos):02d}", size=10)
    row_layers: list[tuple[Image.Image, tuple[int, int, int, int]]] = []
    row_ys: list[int] = []
    for index, repo in enumerate(repos):
        y = 88 + index * 27
        row_ys.append(y)
        draw_line(draw, (346, y - 8, 836, y - 8), fill=mix(FIELD, CYAN, 0.78), width=0.75)
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        layer_draw = ImageDraw.Draw(layer)
        draw_text(layer_draw, (346, y - 4), truncate(str(repo.get("name", "")), 28), role="body_bold", size=14, fill=INK)
        tracked_text(layer_draw, (836, y - 2), f'S {repo.get("stars", 0)} / F {repo.get("forks", 0)}', size=9, anchor="right")
        row_layers.append((layer, (344, y - 8, 840, y + 17)))
    if not repos:
        draw_line(draw, (346, 82, 836, 82), fill=GRAIN, width=2)
        draw_text(draw, (346, 99), "NO PUBLIC REPOSITORIES INDEXED", role="body_bold", size=14, fill=INK)
    draw_footer(draw, "PUBLIC REPOSITORIES / STAR-WEIGHTED INDEX")

    def renderer(timestamp: int) -> Image.Image:
        image = base.copy()
        frame = ImageDraw.Draw(image)
        entering = plan.start_ms < timestamp <= plan.reveal_end_ms
        locking = plan.reveal_end_ms < timestamp <= plan.lock_end_ms
        holding = plan.lock_end_ms <= timestamp <= plan.hold_end_ms
        exiting = plan.hold_end_ms < timestamp < plan.exit_end_ms

        if entering:
            global_amount = clamp((timestamp - plan.start_ms) / (plan.reveal_end_ms - plan.start_ms))
        elif locking or holding:
            global_amount = 1.0
        elif exiting:
            global_amount = 1.0 - ease_in_cubic((timestamp - plan.hold_end_ms) / (plan.exit_end_ms - plan.hold_end_ms))
        else:
            global_amount = 0.0

        for index, (layer, box) in enumerate(stat_layers):
            local = ease_out_quint(clamp((global_amount - index * 0.10) / 0.36))
            _paste_reveal(image, layer, box, local)
        for index, (layer, box) in enumerate(row_layers):
            local = ease_out_quint(clamp((global_amount - 0.24 - index * 0.10) / 0.42))
            _paste_reveal(image, layer, box, local)

        if entering:
            scan_x = lerp(34, 844, global_amount)
            draw_scan_line(frame, scan_x, 60, 188, direction=1)
        elif exiting:
            scan_x = lerp(844, 34, 1 - global_amount)
            draw_scan_line(frame, scan_x, 60, 188, direction=-1)

        if locking:
            bracket_amount = (timestamp - plan.reveal_end_ms) / max(1, plan.lock_end_ms - plan.reveal_end_ms)
        elif holding:
            bracket_amount = 1.0
        elif exiting:
            bracket_amount = global_amount
        else:
            bracket_amount = 0.0
        if row_ys:
            draw_bracket(frame, (338, row_ys[0] - 10, 844, row_ys[0] + 17), amount=bracket_amount, corner=8, width=1.2)
        return downsample(image)

    return renderer

def make_event_rail_renderer(
    data: ProfileData, assets: dict[str, Any], plan: MotionPlan
) -> Callable[[int], Image.Image]:
    base = new_field(207)
    paste_wordmark(base, assets, (142, 53), 900, opacity=36, outline_width=2.0)
    draw = ImageDraw.Draw(base)
    draw_header(draw, "EVENT RAIL", 4, data)
    events = list(data.recent_events[:6])
    x0, x1, rail_y = 72, 788, 86
    if len(events) == 1:
        node_xs = [(x0 + x1) / 2]
    elif events:
        node_xs = [x0 + index * ((x1 - x0) / (len(events) - 1)) for index in range(len(events))]
    else:
        node_xs = []
    draw_line(draw, (x0, rail_y, x1, rail_y), fill=mix(FIELD, CYAN, 0.72), width=1.4)
    for x, event in zip(node_xs, events):
        draw_line(draw, (x, rail_y - 14, x, rail_y + 14), fill=mix(FIELD, CYAN, 0.76), width=0.9)
        draw.ellipse((sx(x - 3.5), sx(rail_y - 3.5), sx(x + 3.5), sx(rail_y + 3.5)), fill=FIELD, outline=mix(FIELD, CYAN, 0.88), width=sr(1.0))
        tracked_text(draw, (x, 108), event["type"], size=9, anchor="center")
        draw_text(draw, (x, 128), truncate(event["repo"], 18), role="body_bold", size=12, anchor="mt")
        tracked_text(draw, (x, 153), event["date"], size=8, anchor="center")
    if not events:
        draw_text(draw, ((x0 + x1) / 2, 126), "NO PUBLIC EVENTS INDEXED", role="body_bold", size=14, anchor="mm")
    draw_footer(draw, "PUBLIC EVENTS / MOST RECENT FIRST")

    def renderer(timestamp: int) -> Image.Image:
        image = base.copy()
        frame = ImageDraw.Draw(image)
        entering = plan.start_ms < timestamp <= plan.reveal_end_ms
        locking = plan.reveal_end_ms < timestamp <= plan.lock_end_ms
        holding = plan.lock_end_ms <= timestamp <= plan.hold_end_ms
        exiting = plan.hold_end_ms < timestamp < plan.exit_end_ms

        if entering:
            progress = clamp((timestamp - plan.start_ms) / (plan.reveal_end_ms - plan.start_ms))
            scan_x = lerp(x1, x0, progress)
            active = True
        elif locking or holding:
            progress = 1.0
            scan_x = x0
            active = False
        elif exiting:
            progress = clamp((timestamp - plan.hold_end_ms) / (plan.exit_end_ms - plan.hold_end_ms))
            scan_x = lerp(x0, x1, ease_in_cubic(progress))
            active = True
        else:
            progress = 0.0
            scan_x = x1 + 1
            active = False

        if scan_x < x1:
            draw_line(frame, (scan_x, rail_y, x1, rail_y), fill=INK, width=1.8)
        for x in node_xs:
            passed = x > scan_x + 0.5
            if (locking or holding) or passed:
                frame.ellipse((sx(x - 4), sx(rail_y - 4), sx(x + 4), sx(rail_y + 4)), fill=INK)
            if entering:
                cross_time = plan.start_ms + (x1 - x) / (x1 - x0) * (plan.reveal_end_ms - plan.start_ms)
                pulse_age = timestamp - cross_time
                if 0 <= pulse_age <= 180:
                    draw_pulse(frame, (x, rail_y), pulse_age / 180)
        if active:
            draw_scan_line(frame, scan_x, 61, 179, direction=-1 if entering else 1)

        if locking:
            bracket_amount = (timestamp - plan.reveal_end_ms) / max(1, plan.lock_end_ms - plan.reveal_end_ms)
        elif holding:
            bracket_amount = 1.0
        elif exiting:
            bracket_amount = 1.0 - progress
        else:
            bracket_amount = 0.0
        if node_xs:
            first_x = node_xs[0]
            draw_bracket(frame, (first_x - 18, 62, first_x + 18, 178), amount=bracket_amount, corner=8, width=1.2)
        return downsample(image)

    return renderer

def make_code_spectrum_renderer(
    data: ProfileData, assets: dict[str, Any], plan: MotionPlan
) -> Callable[[int], Image.Image]:
    base = new_field(209)
    paste_wordmark(base, assets, (-84, 64), 940, opacity=32, outline_width=2.0)
    draw = ImageDraw.Draw(base)
    draw_header(draw, "CODE SPECTRUM", 5, data)
    languages, percentages, scale_max = language_metrics(data)
    x0, x1 = 200, 744
    draw_line(draw, (x0, 56, x1, 56), fill=mix(FIELD, CYAN, 0.82), width=0.8)
    for tick in range(11):
        x = x0 + (x1 - x0) * tick / 10
        height = 8 if tick in (0, 5, 10) else 4
        draw_line(draw, (x, 56 - height / 2, x, 56 + height / 2), fill=mix(FIELD, CYAN, 0.82), width=0.7)
    tracked_text(draw, (x0, 39), "0", size=9)
    tracked_text(draw, (x1, 39), f"{scale_max:.0f}% SCALE", size=9, anchor="right")
    ys: list[float] = []
    endpoints: list[float] = []
    for index, ((name, _), percent) in enumerate(zip(languages, percentages)):
        y = 76 + index * 25
        ys.append(y)
        endpoint = x0 + (x1 - x0) * percent / scale_max
        endpoints.append(endpoint)
        tracked_text(draw, (40, y - 6), truncate(name, 18), size=10)
        draw_line(draw, (x0, y, x1, y), fill=GRAIN, width=10)
        draw_text(draw, (834, y), f"{percent:04.1f}%", role="micro", size=11, anchor="rm")
    if not languages:
        draw_line(draw, (x0, 98, x1, 98), fill=GRAIN, width=2)
        draw_text(draw, (40, 99), "NO PUBLIC LANGUAGE DATA", role="body_bold", size=14, fill=INK)
    draw_footer(draw, "BYTE-WEIGHTED / PUBLIC REPOSITORIES")
    longest_index = max(range(len(endpoints)), key=endpoints.__getitem__) if endpoints else None

    def renderer(timestamp: int) -> Image.Image:
        image = base.copy()
        frame = ImageDraw.Draw(image)
        entering = plan.start_ms < timestamp <= plan.reveal_end_ms
        locking = plan.reveal_end_ms < timestamp <= plan.lock_end_ms
        holding = plan.lock_end_ms <= timestamp <= plan.hold_end_ms
        exiting = plan.hold_end_ms < timestamp < plan.exit_end_ms

        if entering:
            progress = clamp((timestamp - plan.start_ms) / (plan.reveal_end_ms - plan.start_ms))
            scan_x = lerp(x0, x1, progress)
            active = True
        elif locking or holding:
            progress = 1.0
            scan_x = x1
            active = False
        elif exiting:
            progress = clamp((timestamp - plan.hold_end_ms) / (plan.exit_end_ms - plan.hold_end_ms))
            scan_x = lerp(x1, x0, ease_in_cubic(progress))
            active = True
        else:
            progress = 0.0
            scan_x = x0
            active = False

        for y, endpoint in zip(ys, endpoints):
            visible_end = min(endpoint, scan_x)
            if visible_end > x0 + 0.5:
                draw_line(frame, (x0, y, visible_end, y), fill=INK, width=10)
            locked = scan_x >= endpoint - 0.5 and (entering or locking or holding)
            if exiting:
                locked = scan_x >= endpoint
            if locked:
                draw_line(frame, (endpoint, y - 8, endpoint, y + 8), fill=CYAN, width=1.2)
            if entering:
                cross_time = plan.start_ms + (endpoint - x0) / (x1 - x0) * (plan.reveal_end_ms - plan.start_ms)
                pulse_age = timestamp - cross_time
                if 0 <= pulse_age <= 160:
                    draw_pulse(frame, (endpoint, y), pulse_age / 160)
        if active:
            draw_scan_line(frame, scan_x, 62, 189, direction=1 if entering else -1)

        if locking:
            bracket_amount = (timestamp - plan.reveal_end_ms) / max(1, plan.lock_end_ms - plan.reveal_end_ms)
        elif holding:
            bracket_amount = 1.0
        elif exiting:
            bracket_amount = 1.0 - progress
        else:
            bracket_amount = 0.0
        if longest_index is not None:
            endpoint = endpoints[longest_index]
            y = ys[longest_index]
            draw_bracket(frame, (endpoint - 8, y - 13, endpoint + 8, y + 13), amount=bracket_amount, corner=5, width=1.1)
        return downsample(image)

    return renderer

def make_repository_signal_renderer(
    data: ProfileData, assets: dict[str, Any], plan: MotionPlan
) -> Callable[[int], Image.Image]:
    base = new_field(211)
    paste_wordmark(base, assets, (208, 68), 850, opacity=32, outline_width=2.0)
    draw = ImageDraw.Draw(base)
    draw_header(draw, "REPOSITORY SIGNAL", 6, data)
    repos = list(data.top_repositories[:4])
    x0, x1 = 254, 824
    draw_line(draw, (x0, 60, x1, 60), fill=mix(FIELD, CYAN, 0.82), width=0.8)
    for tick in range(13):
        x = x0 + (x1 - x0) * tick / 12
        height = 8 if tick % 3 == 0 else 4
        draw_line(draw, (x, 60 - height / 2, x, 60 + height / 2), fill=mix(FIELD, CYAN, 0.82), width=0.7)
    tracked_text(draw, (x0, 39), "120D", size=9)
    tracked_text(draw, (x1 - 94, 39), "NOW / 0D", size=9, anchor="right")
    ys: list[float] = []
    node_xs: list[float] = []
    ages: list[int] = []
    for index, repo in enumerate(repos):
        y = 82 + index * 30
        age = repo_age_days(repo)
        node_x = x1 - (x1 - x0) * age / 120
        ys.append(y)
        node_xs.append(node_x)
        ages.append(age)
        tracked_text(draw, (40, y - 6), truncate(str(repo.get("name", "")), 25), size=9)
        draw_line(draw, (x0, y, x1, y), fill=GRAIN, width=2)
        tracked_text(draw, (846, y - 6), f"{age:02d}D", size=9, anchor="right")
    if not repos:
        draw_text(draw, (40, 99), "NO PUBLIC REPOSITORIES INDEXED", role="body_bold", size=14, fill=INK)
    draw_footer(draw, "LAST PUSH / AGE SPAN FROM NOW")
    youngest_index = min(range(len(ages)), key=ages.__getitem__) if ages else None

    def renderer(timestamp: int) -> Image.Image:
        image = base.copy()
        frame = ImageDraw.Draw(image)
        entering = plan.start_ms < timestamp <= plan.reveal_end_ms
        locking = plan.reveal_end_ms < timestamp <= plan.lock_end_ms
        holding = plan.lock_end_ms <= timestamp <= plan.hold_end_ms
        exiting = plan.hold_end_ms < timestamp < plan.exit_end_ms

        if entering:
            progress = clamp((timestamp - plan.start_ms) / (plan.reveal_end_ms - plan.start_ms))
            scan_x = lerp(x1, x0, progress)
            active = True
        elif locking or holding:
            progress = 1.0
            scan_x = x0
            active = False
        elif exiting:
            progress = clamp((timestamp - plan.hold_end_ms) / (plan.exit_end_ms - plan.hold_end_ms))
            scan_x = lerp(x0, x1, ease_in_cubic(progress))
            active = True
        else:
            progress = 0.0
            scan_x = x1
            active = False

        for y, node_x in zip(ys, node_xs):
            start_x = max(scan_x, node_x)
            if start_x < x1 - 0.5:
                draw_line(frame, (start_x, y, x1, y), fill=INK, width=2)
            node_visible = scan_x <= node_x + 0.5 and (entering or locking or holding)
            if exiting:
                node_visible = scan_x < node_x
            if node_visible:
                frame.ellipse((sx(node_x - 4), sx(y - 4), sx(node_x + 4), sx(y + 4)), fill=FIELD, outline=INK, width=sr(1.6))
            if entering:
                cross_time = plan.start_ms + (x1 - node_x) / (x1 - x0) * (plan.reveal_end_ms - plan.start_ms)
                pulse_age = timestamp - cross_time
                if 0 <= pulse_age <= 180:
                    draw_pulse(frame, (node_x, y), pulse_age / 180)
        if active:
            draw_scan_line(frame, scan_x, 51, 190, direction=-1 if entering else 1)

        if locking:
            bracket_amount = (timestamp - plan.reveal_end_ms) / max(1, plan.lock_end_ms - plan.reveal_end_ms)
        elif holding:
            bracket_amount = 1.0
        elif exiting:
            bracket_amount = 1.0 - progress
        else:
            bracket_amount = 0.0
        if youngest_index is not None:
            node_x = node_xs[youngest_index]
            y = ys[youngest_index]
            draw_bracket(frame, (node_x - 10, y - 12, node_x + 10, y + 12), amount=bracket_amount, corner=5, width=1.1)
        return downsample(image)

    return renderer

# ---------------------------------------------------------------------------
# Output assembly


MOTION_PLANS = {
    "contribution-scan": MotionPlan(480, 1900, 2040, 5200, 5620),
    "focus-board": MotionPlan(680, 2050, 2190, 5260, 5680),
    "repository-index": MotionPlan(880, 2300, 2440, 5320, 5740),
    "event-rail": MotionPlan(1080, 2500, 2640, 5380, 5800),
    "code-spectrum": MotionPlan(1280, 2700, 2840, 5440, 5860),
    "repository-signal": MotionPlan(1480, 2900, 3040, 5500, 5920),
}


def write_outputs(data: ProfileData, assets: dict[str, Any], output: Path) -> list[Path]:
    output.mkdir(parents=True, exist_ok=True)
    PREVIEW_OUTPUT.mkdir(parents=True, exist_ok=True)

    svgs = {
        "contribution-scan.svg": contribution_svg(data, assets),
        "focus-board.svg": focus_svg(data, assets),
        "repository-index.svg": repository_index_svg(data, assets),
        "event-rail.svg": event_rail_svg(data, assets),
        "code-spectrum.svg": code_spectrum_svg(data, assets),
        "repository-signal.svg": repository_signal_svg(data, assets),
    }
    written: list[Path] = []
    for filename, content in svgs.items():
        path = output / filename
        path.write_text(content, encoding="utf-8")
        written.append(path)

    renderers = {
        "contribution-scan": make_contribution_renderer(data, assets, MOTION_PLANS["contribution-scan"]),
        "focus-board": make_focus_renderer(data, assets, MOTION_PLANS["focus-board"]),
        "repository-index": make_repository_index_renderer(data, assets, MOTION_PLANS["repository-index"]),
        "event-rail": make_event_rail_renderer(data, assets, MOTION_PLANS["event-rail"]),
        "code-spectrum": make_code_spectrum_renderer(data, assets, MOTION_PLANS["code-spectrum"]),
        "repository-signal": make_repository_signal_renderer(data, assets, MOTION_PLANS["repository-signal"]),
    }

    animation_metadata: dict[str, Any] = {}
    previews: dict[str, Image.Image] = {}
    for name, renderer in renderers.items():
        plan = MOTION_PLANS[name]
        path = output / f"{name}.gif"
        frames, durations = render_animation(path, renderer, plan)
        previews[name] = renderer(plan.lock_end_ms)
        animation_metadata[name] = {
            "encoded_source_frames": len(frames),
            "loop_duration_ms": sum(durations),
            "start_ms": plan.start_ms,
            "reveal_end_ms": plan.reveal_end_ms,
            "lock_end_ms": plan.lock_end_ms,
            "hold_end_ms": plan.hold_end_ms,
            "exit_end_ms": plan.exit_end_ms,
            "frame_step_ms": MOTION_STEP_MS,
        }
        written.append(path)

    for name, preview in previews.items():
        preview_path = PREVIEW_OUTPUT / f"{name}.png"
        preview.save(preview_path, optimize=True)
        written.append(preview_path)

    gap = 12
    order = (
        "contribution-scan",
        "focus-board",
        "repository-index",
        "event-rail",
        "code-spectrum",
        "repository-signal",
    )
    sheet = Image.new("RGB", (WIDTH, HEIGHT * len(order) + gap * (len(order) - 1)), FIELD)
    for index, name in enumerate(order):
        sheet.paste(previews[name], (0, index * (HEIGHT + gap)))
    sheet_path = ROOT / "povvo-widgets-preview.png"
    sheet.save(sheet_path, optimize=True)
    written.append(sheet_path)

    metadata = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "username": data.username,
        "demo": data.demo,
        "static_widget_count": len(svgs),
        "animated_widget_count": len(renderers),
        "animation_loop_ms": LOOP_DURATION_MS,
        "motion_step_ms": MOTION_STEP_MS,
        "render_scale": RENDER_SCALE,
        "gif_palette_colours": GIF_PALETTE_COLOURS,
        "gif_disposal": 1,
        "identity_widget": "focus-board",
        "source_logo": str(LOGO_SOURCE.relative_to(ROOT.parent)),
        "source_wordmark": str(IDENTITY_SOURCE.relative_to(ROOT.parent)),
        "animations": animation_metadata,
    }
    metadata_path = output / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    written.append(metadata_path)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    config = load_json(args.config)
    assets = load_logo_assets()
    try:
        data = fetch_profile(config)
    except RuntimeError as exc:
        print(f"Data fetch failed: {exc}", file=sys.stderr)
        return 2
    written = write_outputs(data, assets, args.output)
    for path in written:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
