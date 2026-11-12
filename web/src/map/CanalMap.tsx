import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import L from "leaflet";
import type {
  CanalProperties,
  EditMode,
  LayerToggles,
  MapBasemap,
} from "./types";
import { DraggableSpot } from "./DraggableSpot";
import { MapClickAdd } from "./MapClickAdd";
import { CheckInPanel } from "./CheckInPanel";
import { SessionMarkers } from "./SessionMarkers";
import { OthersMarkers } from "./OthersMarkers";
import { CatchMarkers } from "./CatchMarkers";
import { ZoneActivityToast } from "./ZoneActivityToast";
import { Recenter } from "./Recenter";
import { useCheckIn } from "./useCheckIn";
import { useAuth } from "../lib/AuthContext";
import {
  fileToAvatarDataUrl,
  loadAvatarChoice,
  resolveAvatarSrc,
  saveCustomAvatar,
  savePresetAvatar,
  type AvatarChoice,
} from "./avatarStorage";
import type { PresetAvatarId } from "./avatars";
import {
  clearStoredSpots,
  createSpot,
  loadStoredSpots,
  saveSpots,
} from "./spotsStorage";
import {
  deleteSpot,
  fetchSpots,
  replaceAllSpots,
  seedSpotsIfEmpty,
  subscribeSpots,
  upsertSpot,
} from "../lib/spotsApi";
import {
  bindParkingPopup,
  loadParkingFees,
  parkingStyle,
  type ParkingProps,
} from "./parkingLayer";
import {
  clearParkedCar,
  loadParkedCar,
  saveParkedCar,
  type ParkedCar,
} from "./carParkingStorage";
import {
  endFishingTrip,
  fetchActiveTrip,
  isTripExpired,
  type FishingTrip,
} from "../lib/fishingTrips";

const CAR_ICON = L.divIcon({
  className: "parked-car-marker",
  html: '<span class="parked-car-pin" aria-hidden="true">P</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const CENTER: [number, number] = [55.6055, 12.997];
/** No maxBounds — tight bounds lock panning when the viewport is larger than the box. */
const MIN_ZOOM = 11;

/** Collapse check-in sheet when the user pans/zooms/taps the map. */
function CollapseSheetOnMapMove({
  enabled,
  onCollapse,
}: {
  enabled: boolean;
  onCollapse: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const el = map.getContainer();
    const onPointer = (ev: Event) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.closest(".leaflet-control")) return;
      onCollapse();
    };
    el.addEventListener("pointerdown", onPointer, { passive: true });
    return () => el.removeEventListener("pointerdown", onPointer);
  }, [enabled, map, onCollapse]);

  useMapEvents({
    dragstart() {
      if (enabled) onCollapse();
    },
    zoomstart() {
      if (enabled) onCollapse();
    },
  });
  return null;
}

/** Keep map credit tiny (required by tile provider, but not shouty). */
function CompactAttribution() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);
  return null;
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

const FORBIDDEN_STYLE: PathOptions = {
  color: "#c77dff",
  weight: 2.2,
  dashArray: "9 6",
  fillColor: "#c77dff",
  fillOpacity: 0.2,
  className: "kh-zone-forbidden",
};

function isForbiddenArea(f: Feature): boolean {
  const kind = (f.properties as CanalProperties | null)?.kind;
  return (
    (kind === "moat" || kind === "forbidden") &&
    (f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")
  );
}

const NOFISH_ICON = L.divIcon({
  className: "nofish-marker",
  html: '<div class="nofish-pin"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M7.5 12c1.5-1.8 3.2-2.6 5.2-2.6 1.2 0 2.3.4 3.2 1.1L17 12l-1.1 1.5c-.9.7-2 1.1-3.2 1.1-2 0-3.7-.8-5.2-2.6Z"/><path d="M5.3 5.3l13.4 13.4" class="nofish-slash"/></svg></div>',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

/** Labels collapse to icon-only pins when zoomed out, via a class on the map container. */
function ZoomClass({ threshold }: { threshold: number }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const apply = () => {
      el.classList.toggle("map-zoom-far", map.getZoom() < threshold);
    };
    apply();
    map.on("zoomend", apply);
    return () => {
      map.off("zoomend", apply);
    };
  }, [map, threshold]);
  return null;
}

function ForbiddenMarkers({ features }: { features: Feature[] }) {
  return (
    <>
      {features.filter(isForbiddenArea).map((f, i) => {
        const center = L.geoJSON(f as Feature).getBounds().getCenter();
        const props = (f.properties || {}) as CanalProperties;
        return (
          <Marker
            key={props.id || props.name || i}
            position={center}
            icon={NOFISH_ICON}
            interactive={false}
            keyboard={false}
          />
        );
      })}
    </>
  );
}

function styleFor(props: CanalProperties): PathOptions {
  switch (props.kind) {
    case "canal":
      return {
        color: "#0b4f6c",
        weight: 1.5,
        fillColor: "#1b7a9e",
        fillOpacity: 0.72,
      };
    case "moat":
      return FORBIDDEN_STYLE;
    case "basin":
      return {
        color: "#355c7d",
        weight: 1,
        fillColor: "#6c8ead",
        fillOpacity: 0.35,
      };
    case "canal_centerline":
      return { color: "#0b4f6c", weight: 3, opacity: 0.85 };
    case "social_zone":
      return {
        color: "#5edce8",
        weight: 1.5,
        fillColor: "#5edce8",
        fillOpacity: 0.12,
        dashArray: "6 5",
      };
    case "allowed_fishing":
      return {
        color: "#5edce8",
        weight: 1,
        opacity: 0.55,
        fillColor: "#5edce8",
        fillOpacity: 0.06,
      };
    case "forbidden":
      return FORBIDDEN_STYLE;
    default:
      return { color: "#555", weight: 1, fillOpacity: 0.2 };
  }
}

function onEachFeature(feature: Feature, layer: Layer) {
  const props = (feature.properties || {}) as CanalProperties;
  const name = props.name || props.kind || "Objekt";
  const extra =
    props.kind === "moat"
      ? "Fiskeförbud (vallgrav) – källa: Malmö ordningsföreskrifter 18 §"
      : props.kind === "social_zone"
        ? "Social zon (inte exakt fiskeplats)"
        : props.kind === "bridge"
          ? "Bro – fiske från broar är förbjudet"
          : props.source
            ? `Källa: ${props.source}`
            : "";
  layer.bindPopup(
    `<strong>${name}</strong>${extra ? `<br/><span style="opacity:.85">${extra}</span>` : ""}`,
  );
}

function canalBounds(data: FeatureCollection): L.LatLngBounds | null {
  const canal = data.features.filter((f) => {
    const p = (f.properties || {}) as CanalProperties;
    if (p.kind === "moat") return true;
    if (p.kind !== "canal") return false;
    const name = (p.name || "").toLowerCase();
    return name.includes("kanal") && !name.includes("hamn");
  });
  if (!canal.length) return null;
  const layer = L.geoJSON({
    type: "FeatureCollection",
    features: canal,
  } as FeatureCollection);
  const b = layer.getBounds();
  return b.isValid() ? b : null;
}

/** Initial overview — skipped when we already have the fisher's own position. */
function FitCanal({
  data,
  holdOnUser,
}: {
  data: FeatureCollection;
  holdOnUser: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (holdOnUser) return;
    const b = canalBounds(data);
    if (b) map.fitBounds(b.pad(0.08), { animate: false });
  }, [data, map, holdOnUser]);
  return null;
}

/** Fly back to canal when user taps “Kanalen” (sofa mode). */
function FocusCanal({
  data,
  seq,
}: {
  data: FeatureCollection;
  seq: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!seq) return;
    const b = canalBounds(data);
    if (b) map.flyToBounds(b.pad(0.1), { duration: 0.85, maxZoom: 16 });
  }, [seq, data, map]);
  return null;
}

async function loadGeoJson(url: string): Promise<FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunde inte ladda ${url}`);
  return res.json();
}

function filterByKinds(
  fc: FeatureCollection,
  kinds: string[],
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.filter((f) =>
      kinds.includes((f.properties as CanalProperties)?.kind || ""),
    ),
  };
}

function bridgePoints(fc: FeatureCollection) {
  return fc.features.filter(
    (f) =>
      (f.properties as CanalProperties)?.kind === "bridge" &&
      f.geometry?.type === "Point",
  );
}

function spotId(f: Feature): string {
  const p = (f.properties || {}) as CanalProperties;
  return p.id || p.name || "";
}

type Props = {
  toggles: LayerToggles;
  adminOpen?: boolean;
  basemap?: MapBasemap;
  evening?: boolean;
  onToggleParking?: () => void;
};

const BASEMAPS: Record<
  MapBasemap,
  { url: string; attribution: string; maxZoom: number }
> = {
  street: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    maxZoom: 19,
  },
  hybrid: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    maxZoom: 19,
  },
};

const HYBRID_LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

export function CanalMap({
  toggles,
  adminOpen = false,
  basemap = "street",
  evening = false,
  onToggleParking,
}: Props) {
  const [canalData, setCanalData] = useState<FeatureCollection>(EMPTY);
  const [zonesData, setZonesData] = useState<FeatureCollection>(EMPTY);
  const [parkingData, setParkingData] = useState<FeatureCollection | null>(
    null,
  );
  const [parkedCar, setParkedCar] = useState<ParkedCar | null>(() =>
    loadParkedCar(),
  );
  const [carFocusSeq, setCarFocusSeq] = useState(0);
  const [parkingMenuOpen, setParkingMenuOpen] = useState(false);
  const parkingMenuRef = useRef<HTMLDivElement | null>(null);
  const [rulesData, setRulesData] = useState<FeatureCollection>(EMPTY);
  const [spotsData, setSpotsData] = useState<FeatureCollection>(EMPTY);
  const [seedSpots, setSeedSpots] = useState<FeatureCollection>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>("off");
  const [pickOnMap, setPickOnMap] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [avatarChoice, setAvatarChoice] = useState<AvatarChoice>(() =>
    loadAvatarChoice(),
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [canalFocusSeq, setCanalFocusSeq] = useState(0);
  const [fishingTrip, setFishingTrip] = useState<FishingTrip | null>(null);
  const [fishingPassBusy, setFishingPassBusy] = useState(false);
  const avatarSrc = resolveAvatarSrc(avatarChoice);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadGeoJson("/geo/kanal-geometri.geojson"),
      loadGeoJson("/geo/sociala-zoner.geojson"),
      loadGeoJson("/geo/regelzoner.geojson"),
      loadGeoJson("/geo/lokala-platser.geojson"),
      fetchSpots(),
    ])
      .then(([canal, zones, rules, spots, cloud]) => {
        if (cancelled) return;
        setCanalData(canal);
        setZonesData(zones);
        setRulesData(rules);
        setSeedSpots(spots);
        if (cloud) {
          setSpotsData(cloud);
          setStatus("Laddade platser från molnet");
        } else {
          const stored = loadStoredSpots();
          const local = stored || spots;
          setSpotsData(local);
          if (stored) {
            setStatus("Laddade dina sparade platser från webbläsaren");
          }
          void seedSpotsIfEmpty(local);
        }
        setReady(true);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveSpots(spotsData);
  }, [spotsData, ready]);

  useEffect(() => {
    if (!parkingMenuOpen) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      const root = parkingMenuRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        setParkingMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [parkingMenuOpen]);

  useEffect(() => {
    if (!toggles.parking || parkingData) return;
    let cancelled = false;
    loadParkingFees()
      .then((fc) => {
        if (!cancelled) setParkingData(fc);
      })
      .catch((e: Error) => {
        if (!cancelled) setStatus(e.message || "Kunde inte ladda parkering");
      });
    return () => {
      cancelled = true;
    };
  }, [toggles.parking, parkingData]);

  useEffect(() => {
    if (!ready) return;
    return subscribeSpots((fc) => {
      setSpotsData(fc);
    });
  }, [ready]);

  const waterPolys = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: canalData.features.filter((f) => {
        const p = (f.properties || {}) as CanalProperties;
        if (p.kind === "moat") return true;
        if (p.kind !== "canal") return false;
        const name = (p.name || "").toLowerCase();
        if (
          name.includes("hamn") ||
          name.includes("frihamn") ||
          name.includes("platsen")
        ) {
          return false;
        }
        return name.includes("kanal") || name === "malmö kanal" || !name;
      }),
    };
  }, [canalData]);

  const centerlines = useMemo(
    () => filterByKinds(canalData, ["canal_centerline"]),
    [canalData],
  );
  const bridges = useMemo(() => bridgePoints(canalData), [canalData]);
  const spots = useMemo(
    () =>
      spotsData.features.filter(
        (f) =>
          (f.properties as CanalProperties)?.kind === "local_spot" &&
          f.geometry?.type === "Point",
      ) as Feature<Point, CanalProperties>[],
    [spotsData],
  );
  const ruleFeatures = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: rulesData.features.filter(
        (f) => f.geometry && (f.geometry as Geometry).type,
      ),
    }),
    [rulesData],
  );

  const selected = spots.find((f) => spotId(f) === selectedId) || null;

  const auth = useAuth();
  const mapAdmin = auth.isAdmin;
  const editable = mapAdmin && editMode !== "off";
  const checkIn = useCheckIn(ready ? spotsData : null, ready ? zonesData : null, {
    userId: auth.user?.id,
    displayName: auth.displayName,
    avatarId: avatarChoice.id === "custom" ? "veteran" : avatarChoice.id,
  });

  useEffect(() => {
    if (!auth.user) {
      setFishingTrip(null);
      return;
    }
    let cancelled = false;
    void fetchActiveTrip().then((trip) => {
      if (!cancelled) setFishingTrip(trip);
    });
    return () => {
      cancelled = true;
    };
  }, [auth.user, sheetOpen]);

  // With an active fishing pass, getting a position also checks you in (synlig default).
  useEffect(() => {
    if (!fishingTrip || checkIn.session || !checkIn.fix) return;
    let cancelled = false;
    void checkIn.checkIn().then(() => {
      if (cancelled) return;
      setStatus("Synlig på kartan");
    });
    return () => {
      cancelled = true;
    };
  }, [fishingTrip, checkIn.session, checkIn.fix, checkIn.checkIn]);

  useEffect(() => {
    if (!fishingTrip) return;
    if (!isTripExpired(fishingTrip.expiresAt, checkIn.now)) return;
    void endFishingTrip(fishingTrip.id).then(() => {
      setFishingTrip(null);
      void checkIn.hide();
      setStatus("Fiskapasset löpte ut efter 4 timmar");
    });
  }, [fishingTrip, checkIn.now, checkIn.hide]);

  useEffect(() => {
    if (!mapAdmin && editMode !== "off") setEditMode("off");
  }, [mapAdmin, editMode]);

  function goToCanal() {
    void checkIn.enterSpectator();
    setPickOnMap(false);
    setCanalFocusSeq((n) => n + 1);
    setStatus("Åskådarläge · syns inte som fiskande");
  }

  function setPresetAvatar(id: PresetAvatarId) {
    savePresetAvatar(id);
    setAvatarChoice((prev) => ({ ...prev, id }));
    setUploadError(null);
  }

  async function uploadAvatar(file: File) {
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      saveCustomAvatar(dataUrl);
      setAvatarChoice({ id: "custom", customSrc: dataUrl });
      setUploadError(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Uppladdning misslyckades");
    }
  }

  function updateSpots(
    updater: (features: Feature[]) => Feature[],
    message?: string,
  ) {
    setSpotsData((prev) => ({
      ...prev,
      type: "FeatureCollection",
      features: updater(prev.features),
    }));
    if (message) {
      setStatus(message);
    }
  }

  async function persistSpot(feature: Feature, sortOrder: number, okMsg: string) {
    const result = await upsertSpot(feature, sortOrder);
    setStatus(result.ok ? okMsg : `Molnsparning misslyckades: ${result.error}`);
  }

  function moveSpot(id: string, lat: number, lng: number) {
    let moved: Feature | null = null;
    let sortOrder = 0;
    updateSpots((features) =>
      features.map((f, i) => {
        if (spotId(f) !== id || f.geometry?.type !== "Point") return f;
        sortOrder = i;
        moved = {
          ...f,
          geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          properties: {
            ...(f.properties as CanalProperties),
            confidence: "high",
          },
        };
        return moved;
      }),
    );
    if (moved) {
      void persistSpot(moved, sortOrder, "Plats flyttad · sparad till molnet");
    }
  }

  function addSpotAt(lat: number, lng: number) {
    const name = window.prompt("Namn på platsen?", "Ny plats");
    if (name === null) return;
    const spot = createSpot(name, lat, lng);
    updateSpots((features) => [...features, spot]);
    setSelectedId(spot.properties?.id || null);
    setEditMode("move");
    void persistSpot(
      spot,
      spotsData.features.length,
      `Lade till “${spot.properties?.name}” · sparad till molnet`,
    );
  }

  function renameSelected() {
    if (!selected) return;
    const current = (selected.properties as CanalProperties).name || "";
    const name = window.prompt("Nytt namn", current);
    if (name === null || !name.trim()) return;
    const id = spotId(selected);
    let renamed: Feature | null = null;
    let sortOrder = 0;
    updateSpots((features) =>
      features.map((f, i) => {
        if (spotId(f) !== id) return f;
        sortOrder = i;
        renamed = {
          ...f,
          properties: {
            ...(f.properties as CanalProperties),
            name: name.trim(),
          },
        };
        return renamed;
      }),
    );
    if (renamed) {
      void persistSpot(renamed, sortOrder, "Namn uppdaterat · sparat till molnet");
    }
  }

  function deleteSelected() {
    if (!selected) return;
    const name = (selected.properties as CanalProperties).name || "platsen";
    if (!window.confirm(`Ta bort “${name}”?`)) return;
    const id = spotId(selected);
    updateSpots((features) => features.filter((f) => spotId(f) !== id));
    setSelectedId(null);
    void deleteSpot(id).then((result) => {
      setStatus(
        result.ok
          ? `Tog bort “${name}” · sparat till molnet`
          : `Borttagning misslyckades: ${result.error}`,
      );
    });
  }

  async function publishSpots() {
    setStatus("Publicerar platser…");
    const result = await replaceAllSpots(spotsData);
    setStatus(
      result.ok
        ? `Publicerade ${result.count ?? ""} platser till molnet`
        : `Publicering misslyckades: ${result.error}`,
    );
  }

  function resetSpots() {
    if (
      !window.confirm(
        "Återställ till ursprungsfilen lokalt? (Publicera för att skriva över molnet)",
      )
    ) {
      return;
    }
    clearStoredSpots();
    setSpotsData(seedSpots);
    setSelectedId(null);
    setEditMode("off");
    setStatus("Återställde lokalt till ursprungsplatser");
  }

  return (
    <div
      className={`map-stage${sheetOpen ? " sheet-open" : ""}${evening ? " evening" : ""}`}
    >
      <div
        className={`map-shell${editable ? " editing" : ""}${mapAdmin ? " admin" : ""}${evening ? " evening" : ""}`}
      >
        {evening && <div className="evening-veil" aria-hidden />}
      {error && <div className="map-banner error">{error}</div>}
      {!ready && !error && <div className="map-banner">Laddar kanalkarta…</div>}

      {mapAdmin && adminOpen && (
        <div
          id="admin-panel"
          className="admin-sheet"
          role="toolbar"
          aria-label="Adminverktyg"
        >
          <Link className="chip admin-chip on" to="/admin">
            Dashboard
          </Link>
          <button
            type="button"
            className={editMode === "move" ? "chip on" : "chip"}
            aria-pressed={editMode === "move"}
            onClick={() => {
              setPickOnMap(false);
              setEditMode((m) => (m === "move" ? "off" : "move"));
              setStatus(
                editMode === "move"
                  ? null
                  : "Dra markeringar. Markera en plats för byt namn/ta bort.",
              );
            }}
          >
            Flytta
          </button>
          <button
            type="button"
            className={editMode === "add" ? "chip on" : "chip"}
            aria-pressed={editMode === "add"}
            onClick={() => {
              setPickOnMap(false);
              setEditMode((m) => (m === "add" ? "off" : "add"));
              setStatus(
                editMode === "add"
                  ? null
                  : "Klicka på kartan för att lägga till",
              );
            }}
          >
            Lägg till
          </button>
          <button
            type="button"
            className="chip"
            disabled={!selected || !editable}
            onClick={renameSelected}
          >
            Byt namn
          </button>
          <button
            type="button"
            className="chip danger"
            disabled={!selected || !editable}
            onClick={deleteSelected}
          >
            Ta bort
          </button>
          <button type="button" className="chip" onClick={() => void publishSpots()}>
            Publicera
          </button>
          <button type="button" className="chip" onClick={resetSpots}>
            Återställ
          </button>
        </div>
      )}

      {checkIn.reminder ? (
        <div className="map-banner status checkin-reminder" role="status">
          <span>{checkIn.reminder}</span>
          <span className="checkin-reminder-actions">
            <button
              type="button"
              className="chip"
              onClick={() => void checkIn.extend()}
            >
              +30 min
            </button>
            <button
              type="button"
              className="chip"
              onClick={checkIn.dismissReminder}
            >
              Ok
            </button>
          </span>
        </div>
      ) : (
        status && <div className="map-banner status">{status}</div>
      )}
      {editMode === "add" && (
        <div className="map-banner hint">Klicka på kartan för ny plats</div>
      )}

      <div className="map-float-actions">
        <div className="parking-fab-wrap" ref={parkingMenuRef}>
          {parkingMenuOpen && (
            <div className="parking-menu" role="menu" aria-label="Parkering">
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={toggles.parking}
                className={
                  toggles.parking
                    ? "parking-menu-item on"
                    : "parking-menu-item"
                }
                onClick={() => {
                  onToggleParking?.();
                  setStatus(
                    toggles.parking
                      ? "Parkeringslager av"
                      : "Visar parkeringar",
                  );
                  setParkingMenuOpen(false);
                }}
              >
                <span className="parking-menu-label">
                  {toggles.parking ? "Dölj parkeringar" : "Visa parkeringar"}
                </span>
                <span className="parking-menu-hint">Malmö avgiftszoner</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="parking-menu-item"
                disabled={checkIn.locating}
                onClick={() => {
                  setParkingMenuOpen(false);
                  if (parkedCar) {
                    setCarFocusSeq((n) => n + 1);
                    setStatus("Zoomar till bilen");
                    return;
                  }
                  const pin = checkIn.fix;
                  if (pin) {
                    const next = {
                      lat: pin.lat,
                      lng: pin.lng,
                      savedAt: new Date().toISOString(),
                    };
                    saveParkedCar(next);
                    setParkedCar(next);
                    setCarFocusSeq((n) => n + 1);
                    setStatus("Bilen sparad här");
                    return;
                  }
                  if (!navigator.geolocation) {
                    setStatus(
                      "GPS saknas — aktivera plats eller checka in först",
                    );
                    return;
                  }
                  setStatus("Hämtar plats för bilen…");
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const next = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        savedAt: new Date().toISOString(),
                      };
                      saveParkedCar(next);
                      setParkedCar(next);
                      setCarFocusSeq((n) => n + 1);
                      setStatus("Bilen sparad här");
                    },
                    () => setStatus("Kunde inte hämta plats för bilen"),
                    {
                      enableHighAccuracy: true,
                      timeout: 15000,
                      maximumAge: 10000,
                    },
                  );
                }}
              >
                <span className="parking-menu-label">
                  {parkedCar ? "Hitta min bil" : "Parkera bilen"}
                </span>
                <span className="parking-menu-hint">
                  {parkedCar ? "Zooma till sparad pin" : "Spara pin där du står"}
                </span>
              </button>
              {parkedCar && (
                <button
                  type="button"
                  role="menuitem"
                  className="parking-menu-item danger"
                  onClick={() => {
                    clearParkedCar();
                    setParkedCar(null);
                    setParkingMenuOpen(false);
                    setStatus("Bilpin borttagen");
                  }}
                >
                  <span className="parking-menu-label">Ta bort bilpin</span>
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            className={
              parkingMenuOpen || toggles.parking || parkedCar
                ? "locate-me car-fab on"
                : "locate-me car-fab"
            }
            aria-label="Parkering"
            aria-expanded={parkingMenuOpen}
            aria-haspopup="menu"
            title="Parkering"
            onClick={() => setParkingMenuOpen((v) => !v)}
          >
            <span className="parking-sign" aria-hidden>
              P
            </span>
          </button>
        </div>
        <button
          type="button"
          className="locate-me"
          aria-label="Centrera på min plats"
          title="Centrera på min plats"
          disabled={checkIn.locating}
          onClick={() => {
            if (checkIn.fix || checkIn.session) checkIn.recenterOnMe();
            else void checkIn.locate();
          }}
        >
          <span className="locate-me-icon" aria-hidden />
        </button>
      </div>

      <svg className="kh-map-defs" width="0" height="0" aria-hidden focusable="false">
        <defs>
          <pattern
            id="kh-hatch-forbidden"
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="9" height="9" fill="rgba(199,125,255,0.16)" />
            <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(199,125,255,0.75)" strokeWidth="2.2" />
          </pattern>
        </defs>
      </svg>

      <MapContainer
        center={CENTER}
        zoom={15}
        minZoom={MIN_ZOOM}
        maxZoom={19}
        zoomControl={false}
        className={`canal-map${editMode === "add" || pickOnMap ? " add-cursor" : ""}`}
      >
        <ZoomControl position="topright" />
        <CompactAttribution />
        <ZoomClass threshold={15} />
        <CollapseSheetOnMapMove
          enabled={sheetOpen}
          onCollapse={() => setSheetOpen(false)}
        />
        <TileLayer
          key={`base-${basemap}`}
          attribution={BASEMAPS[basemap].attribution}
          url={BASEMAPS[basemap].url}
          maxZoom={BASEMAPS[basemap].maxZoom}
        />
        {basemap === "hybrid" && (
          <TileLayer
            key="hybrid-labels"
            url={HYBRID_LABELS}
            maxZoom={19}
            opacity={0.95}
          />
        )}
        {ready && (
          <FitCanal
            data={canalData}
            holdOnUser={Boolean(checkIn.fix || checkIn.session)}
          />
        )}
        {ready && <FocusCanal data={canalData} seq={canalFocusSeq} />}
        {checkIn.fix && (
          <Recenter
            lat={checkIn.fix.lat}
            lng={checkIn.fix.lng}
            seq={checkIn.recenterSeq}
          />
        )}
        {parkedCar && (
          <Recenter
            lat={parkedCar.lat}
            lng={parkedCar.lng}
            seq={carFocusSeq}
            zoom={18}
          />
        )}
        {parkedCar && (
          <Marker position={[parkedCar.lat, parkedCar.lng]} icon={CAR_ICON}>
            <Popup>
              <div className="parked-car-popup">
                <strong>Här står bilen</strong>
                <p>
                  Sparad{" "}
                  {new Date(parkedCar.savedAt).toLocaleString("sv-SE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                <div className="parked-car-popup-actions">
                  <button
                    type="button"
                    className="parked-car-btn"
                    onClick={() => {
                      const pin = checkIn.fix;
                      if (!pin) {
                        setStatus("Aktivera plats först, sen uppdatera bilen");
                        return;
                      }
                      const next = {
                        lat: pin.lat,
                        lng: pin.lng,
                        savedAt: new Date().toISOString(),
                      };
                      saveParkedCar(next);
                      setParkedCar(next);
                      setCarFocusSeq((n) => n + 1);
                      setStatus("Bilposition uppdaterad");
                    }}
                  >
                    Flytta hit
                  </button>
                  <button
                    type="button"
                    className="parked-car-btn-danger"
                    onClick={() => {
                      clearParkedCar();
                      setParkedCar(null);
                      setStatus("Bilpin borttagen");
                    }}
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        <MapClickAdd
          enabled={editMode === "add" || pickOnMap}
          onAdd={(lat, lng) => {
            if (pickOnMap) {
              checkIn.setFixFromMapClick(lat, lng);
              setPickOnMap(false);
              setStatus("Simulerad position satt på kartan");
              return;
            }
            addSpotAt(lat, lng);
          }}
        />
        <SessionMarkers
          session={checkIn.session}
          privateFix={checkIn.fix}
          avatarSrc={avatarSrc}
          displayName={auth.displayName}
          spectator={checkIn.spectator}
        />
        <OthersMarkers excludeUserId={auth.user?.id} />

        {toggles.rules &&
          ruleFeatures.features.map((f) => (
            <GeoJSON
              key={(f.properties as CanalProperties)?.id || JSON.stringify(f)}
              data={f as Feature}
              style={() => styleFor((f.properties || {}) as CanalProperties)}
              onEachFeature={onEachFeature}
            />
          ))}
        {toggles.rules && <ForbiddenMarkers features={ruleFeatures.features} />}

        {toggles.zones && (
          <GeoJSON
            key="zones"
            data={zonesData}
            style={(feat) =>
              styleFor((feat?.properties || {}) as CanalProperties)
            }
            onEachFeature={onEachFeature}
          />
        )}

        {toggles.parking && parkingData && (
          <GeoJSON
            key={`parking-${parkingData.features.length}`}
            data={parkingData}
            style={(feat) =>
              parkingStyle((feat?.properties || {}) as ParkingProps)
            }
            onEachFeature={(feature, layer) => {
              bindParkingPopup(feature, layer);
            }}
          />
        )}

        {toggles.canal && (
          <>
            <GeoJSON
              key={`water-${waterPolys.features.length}`}
              data={waterPolys}
              style={(feat) =>
                styleFor((feat?.properties || {}) as CanalProperties)
              }
              onEachFeature={onEachFeature}
            />
            <GeoJSON
              key={`lines-${centerlines.features.length}`}
              data={centerlines}
              style={(feat) =>
                styleFor((feat?.properties || {}) as CanalProperties)
              }
              onEachFeature={onEachFeature}
            />
            <ForbiddenMarkers features={waterPolys.features} />
          </>
        )}

        {toggles.bridges &&
          bridges.map((f) => {
            const geometry = f.geometry as {
              type: "Point";
              coordinates: [number, number];
            };
            const coords = geometry.coordinates;
            const props = f.properties as CanalProperties;
            return (
              <CircleMarker
                key={props.id || props.name}
                center={[coords[1], coords[0]]}
                radius={7}
                pathOptions={{
                  color: "#7a1f1f",
                  fillColor: "#fff",
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                  {props.name} · fiskeförbud från bro
                </Tooltip>
              </CircleMarker>
            );
          })}

        {toggles.spots &&
          spots.map((f) => {
            const id = spotId(f);
            return (
              <DraggableSpot
                key={id}
                feature={f}
                editable={editable}
                selected={selectedId === id}
                onSelect={setSelectedId}
                onMove={moveSpot}
              />
            );
          })}

        <CatchMarkers
          enabled={toggles.catches}
          spots={spotsData}
          zones={zonesData}
        />
      </MapContainer>
      </div>

      <ZoneActivityToast />

      <CheckInPanel
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        locating={checkIn.locating}
        locateError={checkIn.locateError}
        fix={checkIn.fix}
        simulated={checkIn.simulated}
        pickOnMap={pickOnMap}
        suggestedZone={checkIn.suggestedZone}
        session={checkIn.session}
        now={checkIn.now}
        visibility={checkIn.visibility}
        openForCompany={checkIn.openForCompany}
        note={checkIn.note}
        avatarSrc={avatarSrc}
        avatarId={avatarChoice.id}
        onPresetAvatar={setPresetAvatar}
        onUploadAvatar={uploadAvatar}
        uploadError={uploadError}
        spectator={checkIn.spectator}
        onVisibility={checkIn.setVisibility}
        onOpenForCompany={checkIn.setOpenForCompany}
        onNote={checkIn.setNote}
        onLocate={checkIn.locate}
        onGoToCanal={goToCanal}
        onSimulateCanal={() => {
          setPickOnMap(false);
          setEditMode("off");
          setSheetOpen(true);
          checkIn.simulateAtCanal();
          setStatus("Simulerad position vid Slottsparken · tryck Checka in");
        }}
        onSofaDemoCheckIn={() => {
          void checkIn.sofaDemoCheckIn().then(() => {
            setSheetOpen(true);
            setStatus("Test-incheckad från soffan · syns i zon");
          });
        }}
        onTogglePickOnMap={() => {
          setPickOnMap((v) => {
            const next = !v;
            if (next) {
              setEditMode("off");
              setSheetOpen(false);
              setStatus("Klicka på kartan för simulerad position");
            } else {
              setStatus(null);
            }
            return next;
          });
        }}
        onCheckIn={() => {
          void checkIn.checkIn().then(() => setSheetOpen(false));
        }}
        onExtend={() => void checkIn.extend()}
        onHide={(tripNote) => void checkIn.hide(tripNote)}
        fishingPassExpiresAt={fishingTrip?.expiresAt ?? null}
        fishingPassBusy={fishingPassBusy}
        onEndFishingPass={() => {
          if (!fishingTrip) return;
          setFishingPassBusy(true);
          void endFishingTrip(fishingTrip.id).then(async ({ error }) => {
            setFishingPassBusy(false);
            if (error) {
              setStatus(error);
              return;
            }
            setFishingTrip(null);
            await checkIn.hide();
            setStatus("Fiskapasset avslutat · du syns inte längre");
          });
        }}
      />
    </div>
  );
}
