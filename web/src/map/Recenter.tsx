import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Props = {
  lat: number | null;
  lng: number | null;
  seq: number;
  zoom?: number;
};

/** Fly to position only when seq increases (e.g. after Locate). */
export function Recenter({ lat, lng, seq, zoom = 16 }: Props) {
  const map = useMap();
  useEffect(() => {
    if (!seq || lat == null || lng == null) return;
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [seq, lat, lng, zoom, map]);
  return null;
}
