import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthBar } from "../components/AuthBar";
import { CatchForm } from "../components/CatchForm";
import { ChallengeBoard } from "../components/ChallengeBoard";
import { FeedbackForm } from "../components/FeedbackForm";
import { MyCatchDashboard } from "../components/MyCatchDashboard";
import { WaterLevelWidget } from "../components/WaterLevelWidget";
import { useAuth } from "../lib/AuthContext";
import {
  fetchHighscores,
  type HighscorePeriod,
  type HighscoreRow,
} from "../lib/highscores";
import { fetchMyCatches } from "../lib/myCatches";
import type { RecentCatch } from "../lib/recentCatches";
import { computeCatchStreak, type StreakInfo } from "../lib/streaks";
import {
  fetchZoneActivity,
  formatZoneActivityLine,
} from "../lib/zoneActivity";
import "./HomePage.css";

const PERIODS: { id: HighscorePeriod; label: string }[] = [
  { id: "week", label: "Vecka" },
  { id: "month", label: "Månad" },
  { id: "year", label: "År" },
];

type HomeTab = "hem" | "fangst" | "utmana" | "tips" | "profil";

const TABS: { id: HomeTab; label: string; hash?: string }[] = [
  { id: "hem", label: "Hem" },
  { id: "fangst", label: "Fångst", hash: "catch" },
  { id: "utmana", label: "Utmana" },
  { id: "tips", label: "Tips" },
  { id: "profil", label: "Profil" },
];

function tabFromHash(hash: string): HomeTab {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (h === "catch" || h === "fangst") return "fangst";
  if (h === "utmana" || h === "challenge") return "utmana";
  if (h === "tips" || h === "feedback") return "tips";
  if (h === "profil" || h === "konto") return "profil";
  return "hem";
}

export function HomePage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<HomeTab>(() =>
    tabFromHash(window.location.hash),
  );
  const [period, setPeriod] = useState<HighscorePeriod>("week");
  const [rows, setRows] = useState<HighscoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [activity, setActivity] = useState<RecentCatch[]>([]);

  useEffect(() => {
    setTab(tabFromHash(location.hash));
  }, [location.hash]);

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

  useEffect(() => {
    let cancelled = false;
    void fetchZoneActivity(12).then((data) => {
      if (!cancelled) setActivity(data.slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    if (!auth.user) {
      setStreak(null);
      return;
    }
    let cancelled = false;
    void fetchMyCatches(120).then((data) => {
      if (!cancelled) setStreak(computeCatchStreak(data));
    });
    return () => {
      cancelled = true;
    };
  }, [auth.user, reloadToken]);

  function openTab(next: HomeTab) {
    setTab(next);
    const meta = TABS.find((t) => t.id === next);
    const hash = meta?.hash ? `#${meta.hash}` : next === "hem" ? "" : `#${next}`;
    navigate({ pathname: "/", hash }, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
            <Link className="home-cta home-cta-main" to="/karta">
              Till kanalen
            </Link>
          </div>
        </header>

        <nav className="home-tabs" role="tablist" aria-label="Startsida">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "home-tab on" : "home-tab"}
              onClick={() => openTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "hem" && (
          <div className="home-panel" role="tabpanel">
            <WaterLevelWidget />

            {streak && streak.catchDays > 0 && (
              <section className="home-streak" aria-label="Streak">
                <strong>{streak.label}</strong>
                <span>
                  {streak.caughtToday
                    ? "Bra jobbat — streaken lever"
                    : "Logga en idag så håller streaken"}
                </span>
              </section>
            )}

            {activity.length > 0 && (
              <section className="home-board home-activity" aria-label="Zonaktivitet">
                <header className="home-board-head">
                  <h2>Just nu i zonerna</h2>
                  <p>Publika fångster senaste 12 h · bara zon, ingen GPS</p>
                </header>
                <ul className="activity-list">
                  {activity.map((c) => (
                    <li key={c.id}>
                      <strong>{formatZoneActivityLine(c)}</strong>
                      <span>
                        {new Date(c.caughtAt).toLocaleString("sv-SE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
                    <span>
                      Gå till fliken <strong>Fångst</strong> och rapportera.
                    </span>
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
          </div>
        )}

        {tab === "fangst" && (
          <div className="home-panel" role="tabpanel" id="catch">
            <CatchForm
              onSubmitted={() => {
                setReloadToken((n) => n + 1);
                openTab("hem");
              }}
            />
          </div>
        )}

        {tab === "utmana" && (
          <div className="home-panel" role="tabpanel">
            <ChallengeBoard reloadToken={reloadToken} />
          </div>
        )}

        {tab === "tips" && (
          <div className="home-panel" role="tabpanel">
            <FeedbackForm />
          </div>
        )}

        {tab === "profil" && (
          <div className="home-panel" role="tabpanel">
            <AuthBar />
            <MyCatchDashboard />
            <p className="home-profile-more">
              <Link className="home-cta ghost" to="/profil">
                Öppna hela profilen
              </Link>
            </p>
          </div>
        )}

        <footer className="home-legal">
          <Link to="/hjalp">Bruksanvisning</Link>
          <Link to="/integritet">Integritet</Link>
          <Link to="/villkor">Villkor</Link>
        </footer>
      </div>
    </div>
  );
}
