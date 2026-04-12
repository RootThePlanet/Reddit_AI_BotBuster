from pathlib import Path

from PIL import Image, ImageDraw

sizes = [16, 32, 48, 64, 96, 128]
SUPERSAMPLING_SCALE = 4
output_dirs = [
    Path("assets/icons"),
    Path("chrome-extension/icons"),
    Path("firefox-extension/icons"),
]


def lerp_color(start, end, t):
    """Linearly interpolate between two RGBA colors."""
    return tuple(int(start[i] + (end[i] - start[i]) * t) for i in range(4))


def draw_redd_eye_icon(size):
    """Render a red-eye surveillance icon themed around detecting AI/bots.

    The icon depicts a stylised red eye with scanner crosshairs,
    a subtle digital circuit motif, and a Reddit-inspired antenna,
    conveying the idea of an all-seeing eye that watches for AI
    content and bot activity.

    Args:
        size (int): The width and height of the output icon in pixels.

    Returns:
        Image: A PIL Image object containing the rendered icon.
    """
    scale = SUPERSAMPLING_SCALE
    large = size * scale
    cx = cy = large // 2

    img = Image.new("RGBA", (large, large), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── Background circle (dark, subtle) ──────────────────────────
    bg_r = int(large * 0.46)
    draw.ellipse(
        [cx - bg_r, cy - bg_r, cx + bg_r, cy + bg_r],
        fill=(18, 10, 14, 240),
    )

    # ── Outer glow ring (pulsating red halo) ──────────────────────
    for i in range(10, 0, -1):
        r = int(large * (0.46 + i * 0.005))
        alpha = int(6 + (10 - i) * 5)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(255, 40, 40, alpha),
            width=max(1, scale),
        )

    # ── Eye body (sclera – almond shape via ellipse) ──────────────
    eye_w = int(large * 0.82)
    eye_h = int(large * 0.48)
    eye_bbox = [cx - eye_w // 2, cy - eye_h // 2, cx + eye_w // 2, cy + eye_h // 2]
    draw.ellipse(eye_bbox, fill=(28, 14, 20, 255))

    # Upper/lower eyelid shading for depth
    draw.pieslice(eye_bbox, start=180, end=360, fill=(42, 18, 26, 230))
    draw.pieslice(eye_bbox, start=0, end=180, fill=(22, 8, 12, 210))

    # ── Iris radial gradient ──────────────────────────────────────
    iris_r = int(large * 0.22)
    inner_color = (255, 60, 60, 255)
    outer_color = (160, 10, 20, 255)
    for r in range(iris_r, 0, -1):
        t = r / iris_r
        c = lerp_color(inner_color, outer_color, t)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

    # ── Thin iris detail ring ─────────────────────────────────────
    iris_ring_r = int(large * 0.19)
    draw.ellipse(
        [cx - iris_ring_r, cy - iris_ring_r, cx + iris_ring_r, cy + iris_ring_r],
        outline=(255, 120, 120, 100),
        width=max(1, scale),
    )

    # ── Dark pupil ────────────────────────────────────────────────
    pupil_r = max(scale, int(large * 0.09))
    draw.ellipse(
        [cx - pupil_r, cy - pupil_r, cx + pupil_r, cy + pupil_r],
        fill=(8, 8, 12, 255),
    )

    # ── Scanner crosshair lines ───────────────────────────────────
    cross_len = int(large * 0.28)
    cross_w = max(scale, int(large * 0.015))
    # Horizontal
    draw.line(
        [(cx - cross_len, cy), (cx - pupil_r - scale, cy)],
        fill=(255, 200, 200, 180),
        width=cross_w,
    )
    draw.line(
        [(cx + pupil_r + scale, cy), (cx + cross_len, cy)],
        fill=(255, 200, 200, 180),
        width=cross_w,
    )
    # Vertical
    draw.line(
        [(cx, cy - cross_len), (cx, cy - pupil_r - scale)],
        fill=(255, 200, 200, 160),
        width=cross_w,
    )
    draw.line(
        [(cx, cy + pupil_r + scale), (cx, cy + cross_len)],
        fill=(255, 200, 200, 160),
        width=cross_w,
    )

    # ── Corner tick marks (targeting/scanner feel) ────────────────
    tick_len = int(large * 0.06)
    tick_w = max(1, scale)
    tick_offset = int(large * 0.28)
    tick_color = (255, 150, 150, 140)
    # top-left
    draw.line([(cx - tick_offset, cy - tick_offset), (cx - tick_offset + tick_len, cy - tick_offset)], fill=tick_color, width=tick_w)
    draw.line([(cx - tick_offset, cy - tick_offset), (cx - tick_offset, cy - tick_offset + tick_len)], fill=tick_color, width=tick_w)
    # top-right
    draw.line([(cx + tick_offset, cy - tick_offset), (cx + tick_offset - tick_len, cy - tick_offset)], fill=tick_color, width=tick_w)
    draw.line([(cx + tick_offset, cy - tick_offset), (cx + tick_offset, cy - tick_offset + tick_len)], fill=tick_color, width=tick_w)
    # bottom-left
    draw.line([(cx - tick_offset, cy + tick_offset), (cx - tick_offset + tick_len, cy + tick_offset)], fill=tick_color, width=tick_w)
    draw.line([(cx - tick_offset, cy + tick_offset), (cx - tick_offset, cy + tick_offset - tick_len)], fill=tick_color, width=tick_w)
    # bottom-right
    draw.line([(cx + tick_offset, cy + tick_offset), (cx + tick_offset - tick_len, cy + tick_offset)], fill=tick_color, width=tick_w)
    draw.line([(cx + tick_offset, cy + tick_offset), (cx + tick_offset, cy + tick_offset - tick_len)], fill=tick_color, width=tick_w)

    # ── Scanner arc segments (orbital scanner feel) ───────────────
    ring_r = int(large * 0.30)
    ring_w = max(scale, int(large * 0.012))
    draw.arc(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        start=210,
        end=330,
        fill=(255, 130, 130, 200),
        width=ring_w,
    )
    draw.arc(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        start=30,
        end=150,
        fill=(255, 100, 100, 180),
        width=ring_w,
    )

    # ── Reddit-inspired antenna (connects the icon to Reddit) ────
    stalk_w = max(scale, int(large * 0.018))
    stalk_top_x = cx + int(large * 0.16)
    stalk_top_y = cy - int(large * 0.36)
    stalk_base_x = cx + int(large * 0.06)
    stalk_base_y = cy - int(large * 0.22)
    draw.line(
        [(stalk_base_x, stalk_base_y), (stalk_top_x, stalk_top_y)],
        fill=(255, 80, 80, 230),
        width=stalk_w,
    )
    orb_r = max(scale, int(large * 0.04))
    draw.ellipse(
        [stalk_top_x - orb_r, stalk_top_y - orb_r,
         stalk_top_x + orb_r, stalk_top_y + orb_r],
        fill=(255, 60, 60, 255),
        outline=(255, 160, 160, 220),
        width=max(1, scale),
    )

    # ── Digital circuit dots (subtle tech/AI motif) ───────────────
    dot_r = max(1, int(large * 0.012))
    dot_color = (255, 100, 100, 120)
    dot_positions = [
        (cx - int(large * 0.32), cy - int(large * 0.08)),
        (cx - int(large * 0.32), cy + int(large * 0.08)),
        (cx + int(large * 0.32), cy - int(large * 0.08)),
        (cx + int(large * 0.32), cy + int(large * 0.08)),
    ]
    for dx, dy in dot_positions:
        draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=dot_color)

    # ── Specular highlights (eye realism) ─────────────────────────
    h1_r = max(scale, int(large * 0.04))
    h1_x = cx - int(large * 0.065)
    h1_y = cy - int(large * 0.065)
    draw.ellipse(
        [h1_x - h1_r, h1_y - h1_r, h1_x + h1_r, h1_y + h1_r],
        fill=(255, 230, 230, 200),
    )
    h2_r = max(scale, int(large * 0.018))
    h2_x = cx + int(large * 0.10)
    h2_y = cy + int(large * 0.08)
    draw.ellipse(
        [h2_x - h2_r, h2_y - h2_r, h2_x + h2_r, h2_y + h2_r],
        fill=(255, 180, 180, 120),
    )

    # ── Downscale with LANCZOS for clean anti-aliased icons ──────
    return img.resize((size, size), Image.Resampling.LANCZOS)


for icon_size in sizes:
    icon = draw_redd_eye_icon(icon_size)
    for directory in output_dirs:
        directory.mkdir(parents=True, exist_ok=True)
        output_path = directory / f"icon-{icon_size}.png"
        icon.save(output_path)
        print(f"Generated {output_path}")
