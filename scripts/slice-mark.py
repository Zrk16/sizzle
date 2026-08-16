"""
Slice the generated SIZZLE wordmark into six letter PNGs.

The hero drops each letter on its own beat, which means each letter has to be its own
element. Rather than hand-cropping, find the letters by their own ink: knock the black
background out to transparency, sum alpha down each column, and cut wherever the column
profile goes quiet. Gaps between letters are the only place that happens.

Each slice keeps its own drip and is trimmed to its true bounding box, then the script
records where the letter sat in the original so CSS can put it back on one baseline —
otherwise trimming makes every letter look vertically centred and the word falls apart.
"""

import json
from pathlib import Path

from PIL import Image

import sys
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "public/mark/sizzle-raw.png")
OUT = Path("public/mark")
LETTERS = ["S", "I", "Z", "Z", "L", "E"]

# A column counts as "ink" above this share of its max possible alpha. The background is
# near-pure black and the gold is bright, so this is a wide margin, not a tuned constant.
COLUMN_THRESHOLD = 0.004
# Gold is warm; the background has a little sensor noise. Anything under this is background.
ALPHA_FLOOR = 26


def main() -> None:
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    px = img.load()

    # Black -> transparent. Brightness drives alpha so the drips keep their soft edges
    # instead of turning into hard-edged blobs.
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            a = max(r, g, b)
            op[x, y] = (r, g, b, 0 if a < ALPHA_FLOOR else a)

    # Column profile -> letter bands.
    col = [0] * w
    for x in range(w):
        s = 0
        for y in range(h):
            s += op[x, y][3]
        col[x] = s

    peak = max(col) or 1
    inked = [c / peak > COLUMN_THRESHOLD for c in col]

    bands = []
    start = None
    for x, on in enumerate(inked):
        if on and start is None:
            start = x
        elif not on and start is not None:
            bands.append((start, x))
            start = None
    if start is not None:
        bands.append((start, w))

    # Drop slivers — noise, or a drip that detached from its letter.
    bands = [b for b in bands if b[1] - b[0] > w * 0.01]

    print(f"found {len(bands)} bands in a {w}x{h} image")
    if len(bands) != len(LETTERS):
        print("  band widths:", [b[1] - b[0] for b in bands])
        raise SystemExit(
            f"expected {len(LETTERS)} letters, found {len(bands)}. "
            "Adjust COLUMN_THRESHOLD, or the letters are touching."
        )

    manifest = []
    for (x0, x1), char in zip(bands, LETTERS):
        crop = out.crop((x0, 0, x1, h))
        bbox = crop.getbbox()  # trims the empty rows above and below
        letter = crop.crop(bbox)
        name = f"{len(manifest)}-{char}.png"
        letter.save(OUT / name)

        manifest.append(
            {
                "char": char,
                "src": f"/mark/{name}",
                "width": letter.width,
                "height": letter.height,
                # Where this letter sat in the source, as a fraction of the full mark.
                # The hero uses these to rebuild one baseline out of six trimmed images.
                "left": round(x0 / w, 5),
                "top": round((bbox[1]) / h, 5),
                "widthPct": round(letter.width / w, 5),
                "heightPct": round(letter.height / h, 5),
            }
        )
        print(f"  {char}: {letter.width}x{letter.height} -> {name}")

    (OUT / "manifest.json").write_text(
        json.dumps({"source": {"width": w, "height": h}, "letters": manifest}, indent=2)
    )
    print("wrote manifest.json")


if __name__ == "__main__":
    main()
