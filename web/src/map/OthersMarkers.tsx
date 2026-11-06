import { useEffect, useMemo, useState } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { subscribePublicSessions } from "../lib/fishingSessions";
import { jitterLatLng } from "../lib/localPresence";
import type { PublicFishingSession } from "../lib/types";
import { avatarImgHtml, getPresetAvatar, isPresetAvatarId } from "./avatars";
import { escapeHtml } from "./spotsStorage";

function zoneIcon(name: string, open: boolean, label: string) {
  const safe = escapeHtml(name);
  const who = escapeHtml(label);
  const company = open
    ? `<span class="session-company">Vill ha sällskap</span>`
    : "";
  return L.divIcon({
    className: "session-marker other-session",
    html: `<div class="session-pin other${open ? " open" : ""}"><span class="session-dot"></span><span class="session-name"><em>${who}</em>${safe}${company}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function otherAvatarIcon(avatarId: string | null, name: string) {
  const src = isPresetAvatarId(avatarId)
    ? getPresetAvatar(avatarId).src
    : getPresetAvatar("veteran").src;
  const label = `<span class="other-label">${escapeHtml(name)}</span>`;
  return L.divIcon({
    className: "avatar-marker",
    html: `<div class="avatar-pin">${avatarImgHtml(src)}${label}<span class="avatar-stem other-stem"></span></div>`,
    iconSize: [44, 56],
    iconAnchor: [22, 54],
  });
}

type Props = {
  excludeUserId?: string | null;
};

export function OthersMarkers({ excludeUserId }: Props) {
  const [rows, setRows] = useState<PublicFishingSession[]>([]);

  useEffect(() => {
    return subscribePublicSessions(setRows, excludeUserId);
  }, [excludeUserId]);

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const r of rows) {
      if (r.visibility === "precise" && r.lat != null && r.lng != null) {
        map.set(r.id, otherAvatarIcon(r.avatarId, r.displayName));
      } else if (r.zoneName && r.lat != null && r.lng != null) {
        map.set(
          r.id,
          zoneIcon(r.zoneName, r.openForCompany, r.displayName),
        );
      }
    }
    return map;
  }, [rows]);

  return (
    <>
      {rows.map((r) => {
        if (r.lat == null || r.lng == null) return null;
        const icon = icons.get(r.id);
        if (!icon) return null;
        const pos = jitterLatLng(r.lat, r.lng, r.userId || r.id);
        return (
          <Marker
            key={r.id}
            position={[pos.lat, pos.lng]}
            icon={icon}
            zIndexOffset={650}
          >
            <Tooltip direction="top" offset={[0, -40]} permanent={false}>
              <strong>{r.displayName}</strong>
              {r.zoneName ? ` · ${r.zoneName}` : ""}
              {r.openForCompany ? " · öppen för sällskap" : ""}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
