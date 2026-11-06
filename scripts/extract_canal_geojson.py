"""Extract Malmö canal water polygons and bridges from OSM XML to GeoJSON."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from math import inf
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OSM_PATH = ROOT / "data" / "osm-map.osm"
OUT_PATH = ROOT / "data" / "kanal-geometri.geojson"
ZONES_PATH = ROOT / "data" / "sociala-zoner.geojson"

BRIDGE_NAMES = [
    "Turbinbron",
    "Neptunibron",
    "Suellsbron",
    "Hovrättsbron",
    "Davidshallsbron",
    "Fersens bro",
    "Universitetsbron",
    "Citadellsbron",
    "Citadellbron",
    "Bagers bro",
    "Klaffbron",
    "Amiralsbron",
    "Älvsborgsbron",
    "Neptunibron",
    "Slottsbron",
]


def load_osm(path: Path):
    nodes: dict[str, tuple[float, float]] = {}
    ways_by_id: dict[str, dict] = {}
    relations: list[dict] = []
    for _event, elem in ET.iterparse(path, events=("end",)):
        if elem.tag == "node":
            nodes[elem.attrib["id"]] = (
                float(elem.attrib["lon"]),
                float(elem.attrib["lat"]),
            )
            elem.clear()
        elif elem.tag == "way":
            tags = {t.attrib["k"]: t.attrib["v"] for t in elem.findall("tag")}
            nds = [nd.attrib["ref"] for nd in elem.findall("nd")]
            ways_by_id[elem.attrib["id"]] = {"tags": tags, "nds": nds}
            elem.clear()
        elif elem.tag == "relation":
            tags = {t.attrib["k"]: t.attrib["v"] for t in elem.findall("tag")}
            members = [
                (m.attrib.get("type"), m.attrib.get("ref"), m.attrib.get("role", ""))
                for m in elem.findall("member")
            ]
            relations.append(
                {"tags": tags, "members": members, "id": elem.attrib["id"]}
            )
            elem.clear()
    return nodes, ways_by_id, relations


def way_coords(ways_by_id, nodes, wid: str):
    w = ways_by_id.get(wid)
    if not w:
        return None
    coords = []
    for ref in w["nds"]:
        if ref in nodes:
            coords.append([nodes[ref][0], nodes[ref][1]])
    return coords if len(coords) >= 2 else None


def assemble_rings(ways_by_id, nodes, members, role: str):
    segs = []
    for typ, ref, r in members:
        if typ != "way" or r != role:
            continue
        c = way_coords(ways_by_id, nodes, ref)
        if c:
            segs.append(c)
    if not segs:
        return []
    rings = []
    unused = segs[:]
    while unused:
        ring = unused.pop(0)[:]
        changed = True
        while changed:
            changed = False
            for i, seg in enumerate(unused):
                if ring[-1] == seg[0]:
                    ring.extend(seg[1:])
                    unused.pop(i)
                    changed = True
                    break
                if ring[-1] == seg[-1]:
                    ring.extend(reversed(seg[:-1]))
                    unused.pop(i)
                    changed = True
                    break
                if ring[0] == seg[-1]:
                    ring = seg[:-1] + ring
                    unused.pop(i)
                    changed = True
                    break
                if ring[0] == seg[0]:
                    ring = list(reversed(seg[1:])) + ring
                    unused.pop(i)
                    changed = True
                    break
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        if len(ring) >= 4:
            rings.append(ring)
    return rings


def want_relation(tags: dict) -> bool:
    """Keep canal/moat/basin water — skip named harbor districts (land+water admin)."""
    water = tags.get("water")
    name = (tags.get("name") or tags.get("name:sv") or "").lower()
    if water in ("canal", "moat"):
        return True
    if water == "basin" and "hamn" not in name:
        return True
    if "vallgrav" in name:
        return True
    # Named harbor areas like "Västra Hamnen" are huge and cover land — exclude.
    if any(k in name for k in ("västra hamnen", "frihamnen", "inre hamnen", "frihamnsplatsen")):
        return False
    if water == "basin":
        return True
    return False


def build_zones_from_canal(canal_polys: list[dict]) -> dict:
    """Build social zones as buffers along canal segments using simple bbox splits."""
    # Collect all canal polygon exterior points
    points = []
    for f in canal_polys:
        g = f["geometry"]
        if g["type"] == "Polygon":
            points.extend(g["coordinates"][0])
        elif g["type"] == "MultiPolygon":
            for poly in g["coordinates"]:
                points.extend(poly[0])
    if not points:
        return {"type": "FeatureCollection", "features": []}

    # Hand-tuned zone boxes aligned to named areas (refined vs previous placeholders)
    zones = [
        ("slottsparken", "Slottsparken", 12.9865, 55.6030, 12.9945, 55.6078),
        ("kungsparken", "Kungsparken", 12.9935, 55.6025, 13.0005, 55.6068),
        ("malmohus", "Malmöhus (utanför vallgrav)", 12.9840, 55.6032, 12.9908, 55.6072),
        ("centralen", "Centralen / station", 12.9965, 55.6070, 13.0060, 55.6120),
        ("davidshall", "Davidshall", 12.9945, 55.5998, 13.0030, 55.6042),
        ("triangeln_soder", "Södra kanalen", 12.9980, 55.5978, 13.0100, 55.6032),
        ("neptuni", "Neptuni / inre hamnkant", 12.9940, 55.6090, 13.0035, 55.6135),
        ("suell", "Suell / östra inner", 13.0010, 55.6055, 13.0110, 55.6115),
    ]
    features = []
    for zid, name, minx, miny, maxx, maxy in zones:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": zid,
                    "name": name,
                    "kind": "social_zone",
                    "approximation": True,
                    "note": "Zone for social visibility – not an exact fishing spot",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [minx, miny],
                            [maxx, miny],
                            [maxx, maxy],
                            [minx, maxy],
                            [minx, miny],
                        ]
                    ],
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "metadata": {
            "purpose": "Social visibility zones for Kanalborren",
            "approximation": True,
            "updated_at": "2026-11-06",
        },
        "features": features,
    }


def main() -> None:
    nodes, ways_by_id, relations = load_osm(OSM_PATH)
    features: list[dict] = []
    canal_polys: list[dict] = []

    for rel in relations:
        tags = rel["tags"]
        if not want_relation(tags):
            continue
        water = tags.get("water")
        name = tags.get("name") or tags.get("name:sv") or ""
        outers = assemble_rings(ways_by_id, nodes, rel["members"], "outer")
        inners = assemble_rings(ways_by_id, nodes, rel["members"], "inner")
        if not outers:
            continue
        if len(outers) == 1:
            geom = {"type": "Polygon", "coordinates": [outers[0]] + inners}
        else:
            polys = [[o] for o in outers]
            if inners:
                polys[0].extend(inners)
            geom = {"type": "MultiPolygon", "coordinates": polys}
        kind = (
            "moat"
            if water == "moat" or "vallgrav" in name.lower()
            else ("basin" if water in ("basin", "harbour") else "canal")
        )
        display = name or (
            "Malmöhus vallgrav" if kind == "moat" else "Malmö kanal"
        )
        feat = {
            "type": "Feature",
            "properties": {
                "id": f"osm-rel-{rel['id']}",
                "name": display,
                "kind": kind,
                "water": water,
                "source": "OpenStreetMap",
                "license": "ODbL",
                "attribution": "© OpenStreetMap contributors",
            },
            "geometry": geom,
        }
        features.append(feat)
        if kind in ("canal", "moat"):
            canal_polys.append(feat)
        print(f"poly {display!r} water={water} outers={len(outers)} inners={len(inners)}")

    for wid, w in ways_by_id.items():
        tags = w["tags"]
        if tags.get("waterway") != "canal":
            continue
        c = way_coords(ways_by_id, nodes, wid)
        if not c:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"osm-way-{wid}",
                    "name": tags.get("name") or "canal",
                    "kind": "canal_centerline",
                    "source": "OpenStreetMap",
                    "license": "ODbL",
                    "attribution": "© OpenStreetMap contributors",
                },
                "geometry": {"type": "LineString", "coordinates": c},
            }
        )

    seen_bridges: set[str] = set()

    def add_bridge(name: str, lon: float, lat: float) -> None:
        if name in seen_bridges:
            return
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"bridge-{name}",
                    "name": name,
                    "kind": "bridge",
                    "source": "OpenStreetMap",
                    "license": "ODbL",
                },
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            }
        )
        seen_bridges.add(name)
        print(f"bridge {name} {lon:.5f},{lat:.5f}")

    for wid, w in ways_by_id.items():
        name = w["tags"].get("name") or ""
        if name not in BRIDGE_NAMES:
            continue
        c = way_coords(ways_by_id, nodes, wid)
        if not c:
            continue
        lon = sum(p[0] for p in c) / len(c)
        lat = sum(p[1] for p in c) / len(c)
        add_bridge(name, lon, lat)

    # Some bridges are multipolygon relations (e.g. Neptunibron)
    for rel in relations:
        name = rel["tags"].get("name") or ""
        if name not in BRIDGE_NAMES and name not in (
            "Neptunibron",
            "Citadellsbron",
            "Slottsbron",
        ):
            continue
        pts: list[list[float]] = []
        for typ, ref, _role in rel["members"]:
            if typ != "way":
                continue
            c = way_coords(ways_by_id, nodes, ref)
            if c:
                pts.extend(c)
        if not pts:
            continue
        lon = sum(p[0] for p in pts) / len(pts)
        lat = sum(p[1] for p in pts) / len(pts)
        add_bridge(name, lon, lat)

    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "OpenStreetMap",
            "extracted_at": "2026-11-06",
            "license": "ODbL 1.0",
            "attribution": "© OpenStreetMap contributors",
            "note": "Accurate canal polygons from OSM multipolygons",
        },
        "features": features,
    }
    OUT_PATH.write_text(json.dumps(collection), encoding="utf-8")
    print(f"wrote {OUT_PATH} features={len(features)}")

    zones = build_zones_from_canal(canal_polys)
    ZONES_PATH.write_text(json.dumps(zones, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {ZONES_PATH}")

    minx = miny = inf
    maxx = maxy = -inf

    def walk(c):
        nonlocal minx, miny, maxx, maxy
        if isinstance(c[0], (int, float)):
            minx = min(minx, c[0])
            maxx = max(maxx, c[0])
            miny = min(miny, c[1])
            maxy = max(maxy, c[1])
        else:
            for x in c:
                walk(x)

    for f in canal_polys:
        walk(f["geometry"]["coordinates"])
    print(f"canal bbox {minx:.5f},{miny:.5f} to {maxx:.5f},{maxy:.5f}")


if __name__ == "__main__":
    main()
