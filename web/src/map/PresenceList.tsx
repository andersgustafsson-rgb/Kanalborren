import { useEffect, useState } from "react";
import { subscribePublicSessions } from "../lib/fishingSessions";
import type { PublicFishingSession } from "../lib/types";

type Props = {
  excludeUserId?: string | null;
  myName: string;
  iAmCheckedIn: boolean;
  myZoneName?: string | null;
  myOpenForCompany?: boolean;
};

function placeLabel(zoneName: string | null | undefined, open: boolean) {
  const place = zoneName || "Kanalen";
  return open ? `${place} · öppen för sällskap` : place;
}

export function PresenceList({
  excludeUserId,
  myName,
  iAmCheckedIn,
  myZoneName,
  myOpenForCompany = false,
}: Props) {
  const [rows, setRows] = useState<PublicFishingSession[]>([]);

  useEffect(() => {
    return subscribePublicSessions(setRows, excludeUserId);
  }, [excludeUserId]);

  return (
    <div className="presence-list" aria-live="polite">
      <p className="presence-title">Ute nu</p>
      <ul>
        {iAmCheckedIn && (
          <li className="presence-me">
            <strong>{myName}</strong>
            <span>{placeLabel(myZoneName, myOpenForCompany)} · du</span>
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id}>
            <strong>{r.displayName}</strong>
            <span>{placeLabel(r.zoneName, r.openForCompany)}</span>
          </li>
        ))}
        {!iAmCheckedIn && rows.length === 0 && (
          <li className="presence-empty">
            Ingen synlig just nu. Öppna en till flik och gör Soff-check-in där.
          </li>
        )}
        {iAmCheckedIn && rows.length === 0 && (
          <li className="presence-empty">
            Bara du syns. I den andra fliken: annat namn under Profil →
            Soff-check-in.
          </li>
        )}
      </ul>
    </div>
  );
}
