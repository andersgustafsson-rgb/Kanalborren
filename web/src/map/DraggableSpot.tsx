import { Marker, Tooltip } from "react-leaflet";
import type { Feature, Point } from "geojson";
import L from "leaflet";
import type { CanalProperties } from "./types";
import { escapeHtml } from "./spotsStorage";

const FISH_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12c2.4-3 5.2-4.4 8.4-4.4 2 0 3.8.7 5.3 2L22 12l-1.3 2.4c-1.5 1.3-3.3 2-5.3 2-3.2 0-6-1.4-8.4-4.4Z"/><path d="M7 12 2.5 8.2v7.6L7 12Z"/><circle cx="17.3" cy="11.4" r="0.9" class="spot-eye"/></svg>';

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
    html: `<div class="${cls}"><span class="spot-tag"><span class="spot-ico">${FISH_SVG}</span><span class="spot-label">${safe}</span></span><span class="spot-tip" aria-hidden="true"></span></div>`,
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
        <Tooltip direction="top" offset={[0, -34]} opacity={0.95}>
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
