from pathlib import Path
from PIL import Image, ImageDraw

output_dir = Path('assets/icons')
output_dir.mkdir(parents=True, exist_ok=True)

sizes = [16, 32, 48, 64, 96, 128]

for size in sizes:
    img = Image.new('RGBA', (size, size), (24, 30, 46, 255))
    draw = ImageDraw.Draw(img)

    # Outer ring for detection theme
    outer_radius = int(size * 0.42)
    cx = cy = size // 2
    bbox_outer = [cx - outer_radius, cy - outer_radius, cx + outer_radius, cy + outer_radius]
    draw.ellipse(bbox_outer, fill=(255, 140, 0, 255))

    # Inner core representing a signal pulse
    inner_radius = max(2, int(size * 0.2))
    bbox_inner = [cx - inner_radius, cy - inner_radius, cx + inner_radius, cy + inner_radius]
    draw.ellipse(bbox_inner, fill=(35, 39, 55, 255))

    # Crosshair lines for "detection" motif
    line_width = max(1, size // 16)
    offset = int(size * 0.28)
    draw.line([(cx - offset, cy), (cx + offset, cy)], fill=(255, 255, 255, 230), width=line_width)
    draw.line([(cx, cy - offset), (cx, cy + offset)], fill=(255, 255, 255, 230), width=line_width)

    # Highlight arc to add depth
    arc_radius = int(size * 0.36)
    bbox_arc = [cx - arc_radius, cy - arc_radius, cx + arc_radius, cy + arc_radius]
    draw.arc(bbox_arc, start=300, end=60, fill=(255, 214, 170, 255), width=max(1, size // 20))

    file_path = output_dir / f'icon-{size}.png'
    img.save(file_path)
    print(f'Generated {file_path}')
