import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import { resolveZone } from "../map/geo";

export type CatchPlace = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (place: CatchPlace) => void;
  spotsGeo: FeatureCollection | null;
  zonesGeo: FeatureCollection | null;
};

const CENTER: [number, number] = [55.6055, 12.997];

const pickIcon = L.divIcon({
  className: "catch-pick-marker",
  html: `<span class="catch-pick-dot"></span>`,
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

export function CatchPlacePicker({
  open,
  onClose,
  onPick,
  spotsGeo,
  zonesGeo,
}: Props) {
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [hint, setHint] = useState("Tryck på kartan där du fick fisken");

  const preview = useMemo(() => {
    if (!pin || !spotsGeo || !zonesGeo) return null;
    return resolveZone(pin.lat, pin.lng, spotsGeo, zonesGeo);
  }, [pin, spotsGeo, zonesGeo]);

  useEffect(() => {
    if (!open) {
      setPin(null);
      setHint("Tryck på kartan där du fick fisken");
    }
  }, [open]);

  if (!open) return null;

  function applyLatLng(lat: number, lng: number) {
    setPin({ lat, lng });
    if (!spotsGeo || !zonesGeo) {
      setHint("Kartlager saknas — prova igen");
      return;
    }
    const z = resolveZone(lat, lng, spotsGeo, zonesGeo);
    setHint(`Närmast: ${z.name}`);
  }

  function confirm() {
    if (!preview) return;
    onPick({ id: preview.id, name: preview.name });
    onClose();
  }

  function useGps() {
    if (!navigator.geolocation) {
      setHint("GPS saknas i den här webbläsaren");
      return;
    }
    setHint("Hämtar GPS…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyLatLng(pos.coords.latitude, pos.coords.longitude);
      },
      () => setHint("Kunde inte hämta GPS — peka på kartan i stället"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10_000 },
    );
  }

  return (
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
            center={CENTER}
            zoom={14}
            minZoom={12}
            maxZoom={18}
            zoomControl={false}
            attributionControl={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <ClickCatch onClick={applyLatLng} />
            {pin && <Marker position={[pin.lat, pin.lng]} icon={pickIcon} />}
          </MapContainer>
        </div>
        <div className="catch-place-actions">
          <button type="button" className="chip" onClick={useGps}>
            Min GPS
          </button>
          <button
            type="button"
            className="cta"
            disabled={!preview}
            onClick={confirm}
          >
            Använd {preview ? preview.name : "plats"}
          </button>
        </div>
      </div>
    </div>
  );
}
