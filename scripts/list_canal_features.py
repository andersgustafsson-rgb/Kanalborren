import json
from pathlib import Path

fc = json.loads(Path("data/kanal-geometri.geojson").read_text(encoding="utf-8"))
for f in fc["features"]:
    p = f["properties"]
    g = f["geometry"]
    coords: list[list[float]] = []

    def walk(c):
        if isinstance(c[0], (int, float)):
            coords.append(c)
        else:
            for x in c:
                walk(x)

    walk(g["coordinates"])
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    print(
        f"{p.get('kind', '?'):16} {str(p.get('name')):28} "
        f"pts={len(coords):4} "
        f"lon={min(xs):.4f}-{max(xs):.4f} lat={min(ys):.4f}-{max(ys):.4f}"
    )
