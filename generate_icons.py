from pathlib import Path

from PIL import Image, ImageDraw

sizes = [16, 32, 48, 64, 96, 128]
output_dirs = [
    Path("assets/icons"),
    Path("chrome-extension/icons"),
    Path("firefox-extension/icons"),
]


def lerp_color(start, end, t):
    return tuple(int(start[i] + (end[i] - start[i]) * t) for i in range(4))


def draw_redd_eye_icon(size):
    scale = 4
    large = size * scale
    cx = cy = large // 2

    img = Image.new("RGBA", (large, large), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer soft glow
    for i in range(8, 0, -1):
        r = int(large * (0.47 + i * 0.006))
        alpha = int(8 + (8 - i) * 4)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(255, 55, 55, alpha),
            width=max(1, scale),
        )

    # Eye body (sclera shape)
    eye_w = int(large * 0.9)
    eye_h = int(large * 0.56)
    eye_bbox = [cx - eye_w // 2, cy - eye_h // 2, cx + eye_w // 2, cy + eye_h // 2]
    draw.ellipse(eye_bbox, fill=(31, 16, 22, 255))

    # Upper and lower eyelid shadows for depth
    draw.pieslice(eye_bbox, start=180, end=360, fill=(46, 20, 30, 220))
    draw.pieslice(eye_bbox, start=0, end=180, fill=(24, 10, 14, 200))

    # Iris radial gradient
    iris_r = int(large * 0.24)
    inner = (255, 85, 85, 255)
    outer = (145, 16, 26, 255)
    for r in range(iris_r, 0, -1):
        t = r / iris_r
        c = lerp_color(inner, outer, t)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

    # Dark pupil
    pupil_r = max(scale, int(large * 0.1))
    draw.ellipse(
        [cx - pupil_r, cy - pupil_r, cx + pupil_r, cy + pupil_r],
        fill=(12, 12, 16, 255),
    )

    # Detection crosshair motif
    cross_len = int(large * 0.3)
    cross_w = max(scale, int(large * 0.018))
    draw.line([(cx - cross_len, cy), (cx + cross_len, cy)], fill=(255, 220, 220, 185), width=cross_w)
    draw.line([(cx, cy - cross_len), (cx, cy + cross_len)], fill=(255, 220, 220, 160), width=cross_w)

    # Orbit ring hints "scanner" theme
    ring_r = int(large * 0.31)
    ring_w = max(scale, int(large * 0.014))
    draw.arc(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        start=205,
        end=334,
        fill=(255, 170, 170, 220),
        width=ring_w,
    )
    draw.arc(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        start=24,
        end=120,
        fill=(255, 125, 125, 200),
        width=ring_w,
    )

    # Reddit-inspired antenna motif integrated above eye
    stalk_w = max(scale, int(large * 0.016))
    stalk_top_x = cx + int(large * 0.18)
    stalk_top_y = cy - int(large * 0.29)
    stalk_base_x = cx + int(large * 0.07)
    stalk_base_y = cy - int(large * 0.18)
    draw.line(
        [(stalk_base_x, stalk_base_y), (stalk_top_x, stalk_top_y)],
        fill=(255, 105, 105, 220),
        width=stalk_w,
    )
    orb_r = max(scale, int(large * 0.045))
    draw.ellipse(
        [stalk_top_x - orb_r, stalk_top_y - orb_r, stalk_top_x + orb_r, stalk_top_y + orb_r],
        fill=(255, 72, 72, 255),
        outline=(255, 170, 170, 210),
        width=max(1, scale),
    )

    # Specular highlights
    h1_r = max(scale, int(large * 0.045))
    h1_x = cx - int(large * 0.075)
    h1_y = cy - int(large * 0.075)
    draw.ellipse(
        [h1_x - h1_r, h1_y - h1_r, h1_x + h1_r, h1_y + h1_r],
        fill=(255, 235, 235, 210),
    )
    h2_r = max(scale, int(large * 0.02))
    h2_x = cx + int(large * 0.11)
    h2_y = cy + int(large * 0.09)
    draw.ellipse(
        [h2_x - h2_r, h2_y - h2_r, h2_x + h2_r, h2_y + h2_r],
        fill=(255, 185, 185, 130),
    )

    # Downscale for clean anti-aliased icons
    return img.resize((size, size), Image.Resampling.LANCZOS)


for icon_size in sizes:
    icon = draw_redd_eye_icon(icon_size)
    for directory in output_dirs:
        directory.mkdir(parents=True, exist_ok=True)
        output_path = directory / f"icon-{icon_size}.png"
        icon.save(output_path)
        print(f"Generated {output_path}")
