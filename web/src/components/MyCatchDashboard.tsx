import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  bestCatchMonth,
  buildHotspots,
  fetchMyCatches,
  type MyCatch,
  type MyHotspot,
} from "../lib/myCatches";
import "./MyCatchDashboard.css";

export function MyCatchDashboard() {
  const auth = useAuth();
  const [rows, setRows] = useState<MyCatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.user) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchMyCatches().then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  const hotspots = useMemo(() => buildHotspots(rows), [rows]);
  const peakMonth = useMemo(() => bestCatchMonth(rows), [rows]);
  const privateCount = useMemo(
    () => rows.filter((r) => r.isPrivate).length,
    [rows],
  );
  const top: MyHotspot[] = hotspots.slice(0, 5);

  if (!auth.configured) return null;

  if (!auth.user) {
    return (
      <section className="home-board catch-dash">
        <header className="home-board-head">
          <h2>Mina hotspots</h2>
          <p>
            <Link to="/profil#konto">Logga in</Link> för att se din privata
            fångsthistorik.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="home-board catch-dash" aria-labelledby="hotspot-title">
      <header className="home-board-head">
        <h2 id="hotspot-title">Mina hotspots</h2>
        <p>Bara du ser detta · inkl. dolda fångster</p>
      </header>

      {loading ? (
        <p className="catch-dash-empty">Hämtar din historik…</p>
      ) : rows.length === 0 ? (
        <p className="catch-dash-empty">
          Inga sparade fångster ännu. Rapportera under Fångst — gärna dolt om du
          vill skydda platsen.
        </p>
      ) : (
        <>
          <div className="catch-dash-stats">
            <div>
              <strong>{rows.length}</strong>
              <span>fångster</span>
            </div>
            <div>
              <strong>{hotspots.length}</strong>
              <span>platser</span>
            </div>
            <div>
              <strong>{privateCount}</strong>
              <span>dolda</span>
            </div>
          </div>

          {peakMonth && (
            <p className="catch-dash-peak">
              Flest fiskar: <strong>{peakMonth.label}</strong> · {peakMonth.count}{" "}
              st
            </p>
          )}

          <ol className="catch-dash-list">
            {top.map((h, i) => (
              <li key={`${h.zoneId || h.zoneName}-${i}`}>
                <span className="catch-dash-rank">{i + 1}</span>
                <span className="catch-dash-main">
                  <strong>{h.zoneName}</strong>
                  <small>
                    {h.count} fångst{h.count === 1 ? "" : "er"}
                    {h.bestLengthCm != null ? ` · bäst ${h.bestLengthCm} cm` : ""}
                    {" · senast "}
                    {new Date(h.lastCaughtAt).toLocaleDateString("sv-SE", {
                      dateStyle: "medium",
                    })}
                  </small>
                </span>
              </li>
            ))}
          </ol>

          <p className="catch-dash-note">
            Senare: väder/temperatur per fångst, egen karta med bara dina
            prickar.
          </p>
        </>
      )}
    </section>
  );
}
