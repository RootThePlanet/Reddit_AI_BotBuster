from pathlib import Path

from PIL import Image

SOURCE_IMAGE = Path("assets/icons/Redd-eye.png")
sizes = [16, 32, 48, 64, 96, 128]
output_dirs = [
    Path("assets/icons"),
    Path("chrome-extension/icons"),
    Path("firefox-extension/icons"),
    Path("firefox-extension-beta/icons"),
]

src = Image.open(SOURCE_IMAGE).convert("RGBA")

for icon_size in sizes:
    icon = src.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    for directory in output_dirs:
        directory.mkdir(parents=True, exist_ok=True)
        output_path = directory / f"icon-{icon_size}.png"
        icon.save(output_path)
        print(f"Generated {output_path}")
