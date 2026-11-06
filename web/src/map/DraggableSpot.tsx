import { Marker, Tooltip } from "react-leaflet";
import type { Feature, Point } from "geojson";
import L from "leaflet";
import type { CanalProperties } from "./types";
import { escapeHtml } from "./spotsStorage";

function spotIcon(name: string, selected: boolean, editable: boolean) {
  const safe = escapeHtml(name);
  const cls = [
    "spot-pin",
    selected ? "selected" : "",
    editable ? "editable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "spot-marker",
    html: `<div class="${cls}"><span class="spot-label">${safe}</span><span class="spot-beacon" aria-hidden="true"></span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

type Props = {
  feature: Feature<Point, CanalProperties>;
  editable: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, lat: number, lng: number) => void;
};

export function DraggableSpot({
  feature,
  editable,
  selected,
  onSelect,
  onMove,
}: Props) {
  const props = feature.properties || {};
  const id = props.id || props.name || "spot";
  const name = props.name || "Plats";
  const [lng, lat] = feature.geometry.coordinates;

  return (
    <Marker
      position={[lat, lng]}
      icon={spotIcon(name, selected, editable)}
      draggable={editable}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onSelect(id);
        },
        dragend: (e) => {
          const marker = e.target as L.Marker;
          const pos = marker.getLatLng();
          onMove(id, pos.lat, pos.lng);
        },
      }}
    >
      {!editable && (
        <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
          <strong>{name}</strong>
          {props.note ? (
            <>
              <br />
              {props.note}
            </>
          ) : null}
          <br />
          <em>Ingen fiskgaranti</em>
        </Tooltip>
      )}
    </Marker>
  );
}
