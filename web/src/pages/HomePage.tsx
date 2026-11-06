import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthBar } from "../components/AuthBar";
import { CatchForm } from "../components/CatchForm";
import { ChallengeBoard } from "../components/ChallengeBoard";
import { WaterLevelWidget } from "../components/WaterLevelWidget";
import {
  fetchHighscores,
  type HighscorePeriod,
  type HighscoreRow,
} from "../lib/highscores";
import "./HomePage.css";

const PERIODS: { id: HighscorePeriod; label: string }[] = [
  { id: "week", label: "Vecka" },
  { id: "month", label: "Månad" },
  { id: "year", label: "År" },
];

export function HomePage() {
  const [period, setPeriod] = useState<HighscorePeriod>("week");
  const [rows, setRows] = useState<HighscoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchHighscores(period).then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [period, reloadToken]);

  return (
    <div className="home">
      <img
        className="home-bg"
        src="/brand/malmo-kanal-hero.jpg"
        alt=""
        decoding="async"
      />
      <div className="home-scrim" aria-hidden />

      <div className="home-stack">
        <header className="home-top">
          <img
            className="home-logo"
            src="/brand/kanalhugget-logo.png"
            alt="KanalHugget"
            width={420}
            height={150}
            decoding="async"
          />
          <div className="home-cta-row">
            <Link className="home-cta" to="/karta">
              Öppna kartan
            </Link>
            <Link className="home-cta ghost" to="/hjalp">
              Så funkar det
            </Link>
          </div>
        </header>

        <AuthBar />

        <section className="home-board" aria-labelledby="highscore-title">
          <header className="home-board-head">
            <h1 id="highscore-title">Kanal-toppen</h1>
            <p>Största fångster · vecka · månad · år</p>
          </header>

          <div className="period-tabs" role="tablist" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                className={period === p.id ? "period on" : "period"}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <ol className="score-list" aria-live="polite">
            {loading && <li className="score-empty">Hämtar topplista…</li>}
            {!loading && rows.length === 0 && (
              <li className="score-empty">
                Inga fångster den här{" "}
                {period === "week"
                  ? "veckan"
                  : period === "month"
                    ? "månaden"
                    : "året"}{" "}
                än.
                <span>Rapportera en fångst nedan — då syns du här.</span>
              </li>
            )}
            {!loading &&
              rows.map((r, i) => (
                <li key={r.id} className="score-row">
                  <span className="score-rank">{i + 1}</span>
                  <span className="score-main">
                    <strong>{r.displayName}</strong>
                    <small>
                      {r.species}
                      {r.lengthCm != null ? ` · ${r.lengthCm} cm` : ""}
                      {r.weightKg != null ? ` · ${r.weightKg} kg` : ""}
                      {r.zoneName ? ` · ${r.zoneName}` : ""}
                      {" · "}
                      {new Date(r.caughtAt).toLocaleString("sv-SE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </small>
                  </span>
                </li>
              ))}
          </ol>
        </section>

        <div id="catch">
          <CatchForm onSubmitted={() => setReloadToken((n) => n + 1)} />
        </div>

        <ChallengeBoard reloadToken={reloadToken} />

        <WaterLevelWidget />
      </div>
    </div>
  );
}
