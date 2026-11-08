import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import L from "leaflet";
import type { CanalProperties, EditMode, LayerToggles } from "./types";
import { DraggableSpot } from "./DraggableSpot";
import { MapClickAdd } from "./MapClickAdd";
import { CheckInPanel } from "./CheckInPanel";
import { SessionMarkers } from "./SessionMarkers";
import { OthersMarkers } from "./OthersMarkers";
import { CatchMarkers } from "./CatchMarkers";
import { CompanyPanel } from "./CompanyPanel";
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
  downloadSpotsGeoJson,
  loadStoredSpots,
  saveSpots,
} from "./spotsStorage";

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
      return {
        color: "#7a1f1f",
        weight: 2,
        fillColor: "#c0392b",
        fillOpacity: 0.55,
        dashArray: "4 3",
      };
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
        color: "#2d6a4f",
        weight: 2,
        fillColor: "#52b788",
        fillOpacity: 0.28,
        dashArray: "6 4",
      };
    case "allowed_fishing":
      return {
        color: "#1b4332",
        weight: 1,
        fillColor: "#95d5b2",
        fillOpacity: 0.12,
      };
    case "forbidden":
      return {
        color: "#9b2226",
        weight: 2,
        fillColor: "#e5383b",
        fillOpacity: 0.25,
      };
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
};

export function CanalMap({ toggles }: Props) {
  const [canalData, setCanalData] = useState<FeatureCollection>(EMPTY);
  const [zonesData, setZonesData] = useState<FeatureCollection>(EMPTY);
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
  const avatarSrc = resolveAvatarSrc(avatarChoice);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadGeoJson("/geo/kanal-geometri.geojson"),
      loadGeoJson("/geo/sociala-zoner.geojson"),
      loadGeoJson("/geo/regelzoner.geojson"),
      loadGeoJson("/geo/lokala-platser.geojson"),
    ])
      .then(([canal, zones, rules, spots]) => {
        if (cancelled) return;
        setCanalData(canal);
        setZonesData(zones);
        setRulesData(rules);
        setSeedSpots(spots);
        const stored = loadStoredSpots();
        setSpotsData(stored || spots);
        setReady(true);
        if (stored) {
          setStatus("Laddade dina sparade platser från webbläsaren");
        }
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

  function moveSpot(id: string, lat: number, lng: number) {
    updateSpots(
      (features) =>
        features.map((f) => {
          if (spotId(f) !== id || f.geometry?.type !== "Point") return f;
          return {
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
        }),
      "Plats flyttad · sparad lokalt",
    );
  }

  function addSpotAt(lat: number, lng: number) {
    const name = window.prompt("Namn på platsen?", "Ny plats");
    if (name === null) return;
    const spot = createSpot(name, lat, lng);
    updateSpots((features) => [...features, spot], `Lade till “${spot.properties?.name}”`);
    setSelectedId(spot.properties?.id || null);
    setEditMode("move");
  }

  function renameSelected() {
    if (!selected) return;
    const current = (selected.properties as CanalProperties).name || "";
    const name = window.prompt("Nytt namn", current);
    if (name === null || !name.trim()) return;
    const id = spotId(selected);
    updateSpots(
      (features) =>
        features.map((f) =>
          spotId(f) === id
            ? {
                ...f,
                properties: {
                  ...(f.properties as CanalProperties),
                  name: name.trim(),
                },
              }
            : f,
        ),
      "Namn uppdaterat",
    );
  }

  function deleteSelected() {
    if (!selected) return;
    const name = (selected.properties as CanalProperties).name || "platsen";
    if (!window.confirm(`Ta bort “${name}”?`)) return;
    const id = spotId(selected);
    updateSpots(
      (features) => features.filter((f) => spotId(f) !== id),
      `Tog bort “${name}”`,
    );
    setSelectedId(null);
  }

  function exportSpots() {
    downloadSpotsGeoJson(spotsData);
    setStatus("Exporterade lokala-platser.geojson");
  }

  function resetSpots() {
    if (
      !window.confirm(
        "Återställ till ursprungsfilen och radera dina lokala ändringar?",
      )
    ) {
      return;
    }
    clearStoredSpots();
    setSpotsData(seedSpots);
    setSelectedId(null);
    setEditMode("off");
    setStatus("Återställde till ursprungsplatser");
  }

  return (
    <div className={`map-stage${sheetOpen ? " sheet-open" : ""}`}>
      <div
        className={`map-shell${editable ? " editing" : ""}${mapAdmin ? " admin" : ""}`}
      >
      {error && <div className="map-banner error">{error}</div>}
      {!ready && !error && <div className="map-banner">Laddar kanalkarta…</div>}

      <div className="top-bar" role="toolbar" aria-label="Kartverktyg">
        <button
          type="button"
          className="chip on canal-chip"
          onClick={goToCanal}
          title="Centrera på Malmö kanal"
        >
          Till kanalen
        </button>
        {mapAdmin && (
          <>
            <Link className="chip admin-chip on" to="/admin">
              Admin
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
            <button type="button" className="chip" onClick={exportSpots}>
              Exportera
            </button>
            <button type="button" className="chip" onClick={resetSpots}>
              Återställ
            </button>
          </>
        )}
      </div>

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

      {(checkIn.fix || checkIn.session) && (
        <button
          type="button"
          className="locate-me"
          aria-label="Centrera på mig"
          onClick={() => checkIn.recenterOnMe()}
        >
          <span className="locate-me-icon" aria-hidden />
        </button>
      )}

      <MapContainer
        center={CENTER}
        zoom={15}
        minZoom={MIN_ZOOM}
        maxZoom={19}
        zoomControl={false}
        className={`canal-map${editMode === "add" || pickOnMap ? " add-cursor" : ""}`}
      >
        <ZoomControl position="bottomright" />
        <CompactAttribution />
        <CollapseSheetOnMapMove
          enabled={sheetOpen}
          onCollapse={() => setSheetOpen(false)}
        />
        <TileLayer
          attribution="© Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
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

      <CompanyPanel />

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
        onHide={() => void checkIn.hide()}
      />
    </div>
  );
}
