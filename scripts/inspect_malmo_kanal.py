import json
from pathlib import Path

fc = json.loads(Path("data/kanal-geometri.geojson").read_text(encoding="utf-8"))
for f in fc["features"]:
    p = f["properties"]
    if p.get("kind") != "canal":
        continue
    name = p.get("name") or ""
    g = f["geometry"]
    print("===", name, g["type"])
    if g["type"] == "Polygon":
        rings = g["coordinates"]
        print("rings", len(rings), "outer pts", len(rings[0]))
        # sample every Nth point of outer
        outer = rings[0]
        step = max(1, len(outer) // 20)
        for i in range(0, len(outer), step):
            print(f"  {i}: {outer[i][0]:.5f},{outer[i][1]:.5f}")
    elif g["type"] == "MultiPolygon":
        print("polys", len(g["coordinates"]))
