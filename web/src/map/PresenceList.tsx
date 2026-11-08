import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../lib/AuthContext";
import { subscribePublicSessions } from "../lib/fishingSessions";
import type { PublicFishingSession } from "../lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PresenceList({ open, onOpenChange }: Props) {
  const auth = useAuth();
  const [rows, setRows] = useState<PublicFishingSession[]>([]);
  const [sheetHost, setSheetHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    return subscribePublicSessions(setRows, null);
  }, []);

  useEffect(() => {
    setSheetHost(document.querySelector(".map-app"));
  }, []);

  const mine = auth.user
    ? rows.find((r) => r.userId === auth.user!.id)
    : undefined;
  const others = auth.user
    ? rows.filter((r) => r.userId !== auth.user!.id)
    : rows;
  const count = rows.length;

  const sheet =
    open && sheetHost
      ? createPortal(
          <div
            id="presence-sheet"
            className="presence-sheet"
            role="region"
            aria-label="Ute nu"
            aria-live="polite"
          >
            <ul>
              {mine && (
                <li className="presence-me">
                  <strong>{mine.displayName}</strong>
                  <span>{mine.zoneName || mine.visibility} · du</span>
                  {mine.openForCompany && (
                    <span className="presence-company">Vill ha sällskap</span>
                  )}
                </li>
              )}
              {others.map((r) => (
                <li key={r.id}>
                  <strong>{r.displayName}</strong>
                  <span>{r.zoneName || r.visibility}</span>
                  {r.openForCompany && (
                    <span className="presence-company">Vill ha sällskap</span>
                  )}
                </li>
              ))}
              {count === 0 && (
                <li className="presence-empty">
                  Ingen synlig just nu. Checka in för att synas.
                </li>
              )}
              {mine && others.length === 0 && (
                <li className="presence-empty">Bara du syns just nu.</li>
              )}
            </ul>
          </div>,
          sheetHost,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={open ? "hud-item on" : "hud-item"}
        aria-expanded={open}
        aria-controls="presence-sheet"
        onClick={() => onOpenChange(!open)}
      >
        Ute
        {count > 0 && <span className="hud-badge">{count}</span>}
      </button>
      {sheet}
    </>
  );
}
