import { useMapEvents } from "react-leaflet";

type Props = {
  enabled: boolean;
  onAdd: (lat: number, lng: number) => void;
};

/** Click map to place a new spot when edit+add mode is on. */
export function MapClickAdd({ enabled, onAdd }: Props) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
