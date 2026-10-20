from PIL import Image
from pathlib import Path

src = Path(r"C:\Users\eduar\.cursor\projects\c-Users-eduar-Documents-GitHub-controle-contas\assets\app-icon-source.png")
res = Path(r"C:\Users\eduar\Documents\GitHub\controle_contas\mobile\android\app\src\main\res")
resources = Path(r"C:\Users\eduar\Documents\GitHub\controle_contas\mobile\resources")
resources.mkdir(parents=True, exist_ok=True)

img = Image.open(src).convert("RGBA")
img.save(resources / "icon.png", optimize=True)

legacy = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

foreground = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def fit_square(im: Image.Image, size: int, pad_ratio: float = 0.0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = max(1, int(size * (1 - pad_ratio)))
    resized = im.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(resized, (offset, offset), resized)
    return canvas


for folder, size in legacy.items():
    out_dir = res / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    icon = fit_square(img, size, pad_ratio=0.0)
    icon.save(out_dir / "ic_launcher.png", optimize=True)
    icon.save(out_dir / "ic_launcher_round.png", optimize=True)

for folder, size in foreground.items():
    out_dir = res / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    fg = fit_square(img, size, pad_ratio=0.12)
    fg.save(out_dir / "ic_launcher_foreground.png", optimize=True)

print("icons written")
