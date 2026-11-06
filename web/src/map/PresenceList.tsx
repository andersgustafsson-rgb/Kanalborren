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

export function PresenceList({
  excludeUserId,
  myName,
  iAmCheckedIn,
  myZoneName,
  myOpenForCompany = false,
}: Props) {
  const [rows, setRows] = useState<PublicFishingSession[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return subscribePublicSessions(setRows, excludeUserId);
  }, [excludeUserId]);

  const count = rows.length + (iAmCheckedIn ? 1 : 0);

  return (
    <aside
      className={`presence-panel${open ? " open" : ""}`}
      aria-label="Ute nu"
    >
      <button
        type="button"
        className={open ? "presence-toggle on" : "presence-toggle"}
        aria-expanded={open}
        aria-controls="presence-body"
        onClick={() => setOpen((v) => !v)}
      >
        Ute nu
        <span className="presence-count">{count}</span>
      </button>

      {open && (
        <div id="presence-body" className="presence-body" aria-live="polite">
          <ul>
            {iAmCheckedIn && (
              <li className="presence-me">
                <strong>{myName}</strong>
                <span>{myZoneName || "Kanalen"} · du</span>
                {myOpenForCompany && (
                  <span className="presence-company">Vill ha sällskap</span>
                )}
              </li>
            )}
            {rows.map((r) => (
              <li key={r.id}>
                <strong>{r.displayName}</strong>
                <span>{r.zoneName || r.visibility}</span>
                {r.openForCompany && (
                  <span className="presence-company">Vill ha sällskap</span>
                )}
              </li>
            ))}
            {!iAmCheckedIn && rows.length === 0 && (
              <li className="presence-empty">
                Ingen synlig just nu. Checka in för att synas.
              </li>
            )}
            {iAmCheckedIn && rows.length === 0 && (
              <li className="presence-empty">Bara du syns just nu.</li>
            )}
          </ul>
        </div>
      )}
    </aside>
  );
}
