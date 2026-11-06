import { useMemo } from "react";
import { Circle, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { CheckInSession } from "./checkinStorage";
import { avatarImgHtml } from "./avatars";
import { escapeHtml } from "./spotsStorage";

function zoneIcon(zoneName: string, open: boolean, displayName: string) {
  const zone = escapeHtml(zoneName);
  const who = escapeHtml(displayName);
  const company = open
    ? `<span class="session-company">Vill ha sällskap</span>`
    : "";
  return L.divIcon({
    className: "session-marker",
    html: `<div class="session-pin me${open ? " open" : ""}"><span class="session-dot"></span><span class="session-name"><em>Du · ${who}</em>${zone}${company}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function avatarIcon(src: string, displayName: string, you = true) {
  const label = you
    ? `<span class="you-label">Du · ${escapeHtml(displayName)}</span>`
    : `<span class="you-label">${escapeHtml(displayName)}</span>`;
  return L.divIcon({
    className: "avatar-marker",
    html: `<div class="avatar-pin">${avatarImgHtml(src)}${label}<span class="avatar-stem"></span></div>`,
    iconSize: [44, 56],
    iconAnchor: [22, 54],
  });
}

type Props = {
  session: CheckInSession | null;
  privateFix: { lat: number; lng: number; accuracy: number | null } | null;
  avatarSrc: string;
  displayName: string;
  /** Sofa / browse — no presence markers on the canal. */
  spectator?: boolean;
};

export function SessionMarkers({
  session,
  privateFix,
  avatarSrc,
  displayName,
  spectator = false,
}: Props) {
  const youIcon = useMemo(
    () => avatarIcon(avatarSrc, displayName, true),
    [avatarSrc, displayName],
  );
  const preciseIcon = useMemo(
    () => avatarIcon(avatarSrc, displayName, false),
    [avatarSrc, displayName],
  );

  if (spectator) return null;

  return (
    <>
      {privateFix && (
        <>
          {privateFix.accuracy != null && privateFix.accuracy < 120 && (
            <Circle
              center={[privateFix.lat, privateFix.lng]}
              radius={privateFix.accuracy}
              pathOptions={{
                color: "#3ec7d6",
                weight: 1,
                fillColor: "#3ec7d6",
                fillOpacity: 0.12,
              }}
            />
          )}
          <Marker
            position={[privateFix.lat, privateFix.lng]}
            icon={youIcon}
            zIndexOffset={800}
          >
            <Tooltip direction="top" offset={[0, -48]} opacity={0.95}>
              Du ({displayName}) · privat markering
            </Tooltip>
          </Marker>
        </>
      )}

      {session?.visibility === "zone" &&
        session.zoneName &&
        session.publicLat != null &&
        session.publicLng != null && (
          <Marker
            position={[session.publicLat, session.publicLng]}
            icon={zoneIcon(
              session.zoneName,
              session.openForCompany,
              displayName,
            )}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              Du · {displayName} · {session.zoneName}
            </Tooltip>
          </Marker>
        )}

      {session?.visibility === "precise" &&
        session.publicLat != null &&
        session.publicLng != null && (
          <Marker
            position={[session.publicLat, session.publicLng]}
            icon={preciseIcon}
            zIndexOffset={700}
          >
            <Tooltip direction="top" offset={[0, -48]}>
              Du · {displayName} (publik avatar)
            </Tooltip>
          </Marker>
        )}
    </>
  );
}
