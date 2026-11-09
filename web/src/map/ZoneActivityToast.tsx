import { useEffect, useRef, useState } from "react";
import {
  formatZoneActivityLine,
  subscribeZoneActivity,
} from "../lib/zoneActivity";
import { loadSession } from "./checkinStorage";

type Pop = {
  id: string;
  text: string;
};

/** Soft “plopp” when someone logs a public catch in your checked-in zone. */
export function ZoneActivityToast() {
  const [pop, setPop] = useState<Pop | null>(null);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  useEffect(() => {
    return subscribeZoneActivity((rows) => {
      const session = loadSession();
      const myZone = session?.zoneId || null;

      if (!primed.current) {
        for (const r of rows) seen.current.add(r.id);
        primed.current = true;
        return;
      }

      for (const r of rows) {
        if (seen.current.has(r.id)) continue;
        seen.current.add(r.id);
        if (!myZone || r.zoneId !== myZone) continue;
        if (Date.now() - Date.parse(r.caughtAt) > 2 * 60 * 1000) continue;
        setPop({
          id: r.id,
          text: `Plopp · ${formatZoneActivityLine(r)}`,
        });
        break;
      }
    });
  }, []);

  useEffect(() => {
    if (!pop) return;
    const t = window.setTimeout(() => setPop(null), 4500);
    return () => window.clearTimeout(t);
  }, [pop]);

  if (!pop) return null;

  return (
    <div className="zone-plopp" role="status" aria-live="polite">
      {pop.text}
    </div>
  );
}
