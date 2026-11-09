import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import { loadSession } from "../map/checkinStorage";
import { distanceMeters, resolveZone } from "../map/geo";

export type CatchPlace = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (place: CatchPlace) => void;
  spotsGeo: FeatureCollection | null;
  zonesGeo: FeatureCollection | null;
};

type LatLng = { lat: number; lng: number };

const FALLBACK_CENTER: [number, number] = [55.6055, 12.997];
const START_ZOOM = 17;

const meIcon = L.divIcon({
  className: "catch-me-marker",
  html: `<div class="catch-me-pin"><span class="catch-me-dot"></span><span class="catch-me-label">Du</span></div>`,
  iconSize: [44, 44],
  iconAnchor: [10, 10],
});

const pickIcon = L.divIcon({
  className: "catch-pick-marker",
  html: `<span class="catch-pick-dot" aria-hidden="true"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickCatch({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({
  target,
  zoom,
}: {
  target: LatLng | null;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.setView([target.lat, target.lng], zoom, { animate: true });
  }, [target?.lat, target?.lng, zoom, map]);
  return null;
}

function initialMe(): LatLng | null {
  const session = loadSession();
  if (
    session &&
    Date.parse(session.expiresAt) > Date.now() &&
    Number.isFinite(session.privateLat) &&
    Number.isFinite(session.privateLng)
  ) {
    return { lat: session.privateLat, lng: session.privateLng };
  }
  return null;
}

export function CatchPlacePicker({
  open,
  onClose,
  onPick,
  spotsGeo,
  zonesGeo,
}: Props) {
  const [me, setMe] = useState<LatLng | null>(null);
  const [meAccuracy, setMeAccuracy] = useState<number | null>(null);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [hint, setHint] = useState("Hämtar din position…");
  const [locating, setLocating] = useState(false);
  const [viewTick, setViewTick] = useState(0);

  const emptyZones = useMemo(
    () =>
      ({ type: "FeatureCollection", features: [] }) as FeatureCollection,
    [],
  );

  const preview = useMemo(() => {
    if (!pin || !spotsGeo) return null;
    return resolveZone(pin.lat, pin.lng, spotsGeo, zonesGeo || emptyZones);
  }, [pin, spotsGeo, zonesGeo, emptyZones]);

  const offsetM =
    me && pin ? Math.round(distanceMeters(me.lat, me.lng, pin.lat, pin.lng)) : 0;

  function setHintForPin(lat: number, lng: number, fromGps = false) {
    if (!spotsGeo) {
      setHint("Kartlager saknas — prova igen");
      return;
    }
    const z = resolveZone(lat, lng, spotsGeo, zonesGeo || emptyZones);
    const placeBit =
      z.source === "fallback"
        ? `Ungefärlig: ${z.name}`
        : `Närmast: ${z.name}`;
    if (fromGps) {
      setHint(`${placeBit} · dra eller tryck för att justera några meter`);
      return;
    }
    const here = me
      ? Math.round(distanceMeters(me.lat, me.lng, lat, lng))
      : null;
    setHint(
      here == null
        ? placeBit
        : here <= 5
          ? `${placeBit} · vid dig`
          : `${placeBit} · ${here} m från dig`,
    );
  }

  function placeAt(lat: number, lng: number, fromGps = false) {
    const next = { lat, lng };
    setPin(next);
    setHintForPin(lat, lng, fromGps);
  }

  /** Ignore phone GPS far from an active canal check-in (sofa / office testing). */
  const CHECKIN_TRUST_M = 700;

  function applyGps(lat: number, lng: number, accuracy: number | null) {
    const next = { lat, lng };
    setMe(next);
    setMeAccuracy(accuracy);
    setPin(next);
    setViewTick((n) => n + 1);
    setHintForPin(lat, lng, true);
  }

  function locate(force = false) {
    const checkIn = initialMe();

    if (!navigator.geolocation) {
      if (checkIn) {
        applyGps(checkIn.lat, checkIn.lng, null);
        setHint("GPS saknas — använder check-in. Justera nålen om det behövs.");
        return;
      }
      setHint("GPS saknas i den här webbläsaren — peka på kartan");
      return;
    }
    setLocating(true);
    if (!force) setHint("Hämtar din position…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const gps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const accuracy =
          typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null;

        // Soft open: keep check-in when GPS is clearly elsewhere (job/home).
        // Force ("Du är här") always trusts the phone.
        if (!force && checkIn) {
          const away = distanceMeters(
            checkIn.lat,
            checkIn.lng,
            gps.lat,
            gps.lng,
          );
          if (away > CHECKIN_TRUST_M) {
            applyGps(checkIn.lat, checkIn.lng, null);
            setHint(
              `Check-in nära kanalen · telefonen är ~${Math.round(away)} m bort. Tryck “Du är här” för live-GPS.`,
            );
            return;
          }
        }

        applyGps(gps.lat, gps.lng, accuracy);
      },
      () => {
        setLocating(false);
        if (checkIn) {
          applyGps(checkIn.lat, checkIn.lng, null);
          setHint(
            "Kunde inte hämta GPS — använder check-in. Justera nålen om det behövs.",
          );
          return;
        }
        setHint("Kunde inte hämta GPS — peka på kartan i stället");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: force ? 0 : 8_000 },
    );
  }

  useEffect(() => {
    if (!open) {
      setMe(null);
      setMeAccuracy(null);
      setPin(null);
      setHint("Hämtar din position…");
      setLocating(false);
      return;
    }
    const seeded = initialMe();
    if (seeded) {
      applyGps(seeded.lat, seeded.lng, null);
      setHint("Från check-in — finjustera några meter om det behövs");
    }
    locate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opened
  }, [open]);

  if (!open) return null;

  function confirm() {
    if (!preview) return;
    onPick({ id: preview.id, name: preview.name });
    onClose();
  }

  const mapCenter: [number, number] = me
    ? [me.lat, me.lng]
    : pin
      ? [pin.lat, pin.lng]
      : FALLBACK_CENTER;

  return createPortal(
    <div className="catch-place-overlay" role="dialog" aria-modal="true">
      <div className="catch-place-sheet">
        <header className="catch-place-head">
          <h3>Välj plats</h3>
          <button type="button" className="chip" onClick={onClose}>
            Stäng
          </button>
        </header>
        <p className="catch-place-hint">{hint}</p>
        <div className="catch-place-map">
          <MapContainer
            center={mapCenter}
            zoom={START_ZOOM}
            minZoom={13}
            maxZoom={19}
            zoomControl={false}
            attributionControl={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution="© Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <Recenter
              key={viewTick}
              target={me || pin}
              zoom={START_ZOOM}
            />
            <ClickCatch onClick={(lat, lng) => placeAt(lat, lng)} />
            {me && (
              <>
                {meAccuracy != null && meAccuracy > 0 && meAccuracy < 120 && (
                  <Circle
                    center={[me.lat, me.lng]}
                    radius={meAccuracy}
                    pathOptions={{
                      color: "#3ec7d6",
                      weight: 1,
                      fillColor: "#3ec7d6",
                      fillOpacity: 0.12,
                    }}
                  />
                )}
                <Circle
                  center={[me.lat, me.lng]}
                  radius={50}
                  pathOptions={{
                    color: "rgba(184, 240, 110, 0.55)",
                    weight: 1,
                    dashArray: "4 6",
                    fillColor: "#b8f06e",
                    fillOpacity: 0.06,
                  }}
                />
                <Marker
                  position={[me.lat, me.lng]}
                  icon={meIcon}
                  interactive={false}
                  zIndexOffset={200}
                />
              </>
            )}
            {pin && (
              <Marker
                position={[pin.lat, pin.lng]}
                icon={pickIcon}
                draggable
                zIndexOffset={400}
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target as L.Marker;
                    const ll = m.getLatLng();
                    placeAt(ll.lat, ll.lng);
                  },
                }}
              />
            )}
          </MapContainer>
        </div>
        <div className="catch-place-actions">
          <button
            type="button"
            className="chip"
            disabled={locating}
            onClick={() => locate(true)}
          >
            {locating ? "Hämtar…" : "Du är här"}
          </button>
          <button
            type="button"
            className="cta"
            disabled={!preview}
            onClick={confirm}
          >
            Använd {preview ? preview.name : "plats"}
            {preview && offsetM > 5 ? ` · ${offsetM} m` : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
