import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  bestCatchMonth,
  buildHotspots,
  fetchMyCatches,
  fetchMyTripNotes,
  groupCatchesByDay,
  type MyCatch,
  type MyHotspot,
  type MyTripNote,
} from "../lib/myCatches";
import { computeCatchStreak } from "../lib/streaks";
import "./MyCatchDashboard.css";

type View = "places" | "days";

export function MyCatchDashboard() {
  const auth = useAuth();
  const [rows, setRows] = useState<MyCatch[]>([]);
  const [tripNotes, setTripNotes] = useState<MyTripNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("places");

  useEffect(() => {
    if (!auth.user) {
      setRows([]);
      setTripNotes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchMyCatches(), fetchMyTripNotes()]).then(
      ([catches, notes]) => {
        if (!cancelled) {
          setRows(catches);
          setTripNotes(notes);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  const hotspots = useMemo(() => buildHotspots(rows), [rows]);
  const peakMonth = useMemo(() => bestCatchMonth(rows), [rows]);
  const days = useMemo(() => groupCatchesByDay(rows), [rows]);
  const streak = useMemo(() => computeCatchStreak(rows), [rows]);
  const privateCount = useMemo(
    () => rows.filter((r) => r.isPrivate).length,
    [rows],
  );
  const top: MyHotspot[] = hotspots.slice(0, 5);
  const notesByDay = useMemo(() => {
    const map = new Map<string, MyTripNote[]>();
    for (const n of tripNotes) {
      const d = new Date(n.endedAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) || [];
      list.push(n);
      map.set(key, list);
    }
    return map;
  }, [tripNotes]);

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
      ) : rows.length === 0 && tripNotes.length === 0 ? (
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
            <div>
              <strong>{streak.catchDays}</strong>
              <span>streak</span>
            </div>
          </div>

          {streak.catchDays > 0 && (
            <p className="catch-dash-peak">{streak.label}</p>
          )}

          {peakMonth && (
            <p className="catch-dash-peak">
              Flest fiskar: <strong>{peakMonth.label}</strong> · {peakMonth.count}{" "}
              st
            </p>
          )}

          <div className="catch-dash-tabs" role="tablist" aria-label="Visa">
            <button
              type="button"
              role="tab"
              aria-selected={view === "places"}
              className={view === "places" ? "on" : ""}
              onClick={() => setView("places")}
            >
              Platser
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "days"}
              className={view === "days" ? "on" : ""}
              onClick={() => setView("days")}
            >
              Per dag
            </button>
          </div>

          {view === "places" ? (
            <ol className="catch-dash-list">
              {top.map((h, i) => (
                <li key={`${h.zoneId || h.zoneName}-${i}`}>
                  <span className="catch-dash-rank">{i + 1}</span>
                  <span className="catch-dash-main">
                    <strong>{h.zoneName}</strong>
                    <small>
                      {h.count} fångst{h.count === 1 ? "" : "er"}
                      {h.bestLengthCm != null
                        ? ` · bäst ${h.bestLengthCm} cm`
                        : ""}
                      {" · senast "}
                      {new Date(h.lastCaughtAt).toLocaleDateString("sv-SE", {
                        dateStyle: "medium",
                      })}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="catch-dash-days">
              {days.map((day) => (
                <article key={day.dateKey} className="catch-dash-day">
                  <header>
                    <strong>{day.label}</strong>
                    <span>
                      {day.catches.length} fisk
                      {day.catches.length === 1 ? "" : "ar"}
                    </span>
                  </header>
                  {(notesByDay.get(day.dateKey) || []).map((n) => (
                    <p key={n.id} className="catch-dash-trip-note">
                      {n.zoneName ? `${n.zoneName}: ` : ""}
                      {n.note}
                    </p>
                  ))}
                  <ul>
                    {day.catches.map((c) => (
                      <li key={c.id}>
                        <strong>
                          {c.species}
                          {c.isPrivate ? " · dold" : ""}
                        </strong>
                        <small>
                          {c.lengthCm != null ? `${c.lengthCm} cm` : ""}
                          {c.weightKg != null
                            ? `${c.lengthCm != null ? " · " : ""}${c.weightKg} kg`
                            : ""}
                          {c.zoneName ? ` · ${c.zoneName}` : ""}
                          {" · "}
                          {new Date(c.caughtAt).toLocaleTimeString("sv-SE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              {days.length === 0 && (
                <p className="catch-dash-empty">Inga fångster per dag ännu.</p>
              )}
            </div>
          )}

          <p className="catch-dash-note">
            Avsluta en tur på kartan för att spara en kort anteckning. Senare:
            väder/temperatur och egen karta.
          </p>
        </>
      )}
    </section>
  );
}
