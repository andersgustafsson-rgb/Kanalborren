import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CatchForm } from "../components/CatchForm";
import { ChallengeBoard } from "../components/ChallengeBoard";
import { FeedbackForm } from "../components/FeedbackForm";
import { KanalToppen } from "../components/KanalToppen";
import { WaterLevelWidget } from "../components/WaterLevelWidget";
import { useAuth } from "../lib/AuthContext";
import {
  endFishingTrip,
  fetchActiveTrip,
  formatTripRemaining,
  isTripExpired,
  startFishingTrip,
  type FishingTrip,
} from "../lib/fishingTrips";
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
import { ProfileStudio } from "./ProfilePage";
import "./HomePage.css";

type HomeTab = "hem" | "fangst" | "utmana" | "tips" | "profil";

type IconProps = { className?: string };

function IconTarget({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconPin({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 21s6-5.2 6-10.2A6 6 0 0 0 6 10.8C6 15.8 12 21 12 21Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="10.5"
        r="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const TABS: {
  id: HomeTab;
  label: string;
  icon: string;
  hash?: string;
}[] = [
  { id: "hem", label: "Hem", icon: "/icons/tabs/hem.png" },
  { id: "fangst", label: "Fångst", icon: "/icons/tabs/fangst.png", hash: "catch" },
  { id: "utmana", label: "Utmana", icon: "/icons/tabs/utmana.png" },
  { id: "tips", label: "Tips", icon: "/icons/tabs/tips.png" },
  { id: "profil", label: "Profil", icon: "/icons/tabs/profil.png" },
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
  const [trip, setTrip] = useState<FishingTrip | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  const [tripMsg, setTripMsg] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    setTab(tabFromHash(location.hash));
  }, [location.hash]);

  useEffect(() => {
    if (!auth.user) {
      setTrip(null);
      return;
    }
    let cancelled = false;
    void fetchActiveTrip().then((active) => {
      if (!cancelled) setTrip(active);
    });
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  useEffect(() => {
    if (!trip) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [trip]);

  useEffect(() => {
    if (!trip || !isTripExpired(trip.expiresAt, nowTick)) return;
    void endFishingTrip(trip.id).then(() => setTrip(null));
  }, [trip, nowTick]);

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

  async function onStartPass() {
    setTripMsg(null);
    if (!auth.user) {
      setTripMsg("Logga in under Profil för att starta fiskepass");
      openTab("profil");
      return;
    }
    setTripBusy(true);
    const { trip: next, error } = await startFishingTrip();
    setTripBusy(false);
    if (error || !next) {
      setTripMsg(error || "Kunde inte starta fiskepass");
      return;
    }
    setTrip(next);
    setNowTick(Date.now());
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
          <p className="home-kicker">Malmö · fiske · gemenskap</p>
          <img
            className="home-logo"
            src="/brand/kanalhugget-logo.png"
            alt="KanalHugget"
            width={420}
            height={150}
            decoding="async"
          />
          {trip ? (
            <div className="home-cta-row">
              <Link className="home-cta home-cta-map" to="/karta">
                <span className="home-cta-icon-ring" aria-hidden>
                  <IconPin className="home-cta-icon" />
                </span>
                <span className="home-cta-label">Till kanalen</span>
              </Link>
              <p className="home-pass-status" role="status">
                Pass igång · {formatTripRemaining(trip.expiresAt, nowTick)} kvar ·
                avsluta från kartmenyn
              </p>
            </div>
          ) : (
            <div className="home-cta-row home-cta-pair" role="group" aria-label="Gå ut">
              <button
                type="button"
                className="home-cta home-cta-start"
                disabled={tripBusy}
                onClick={() => void onStartPass()}
              >
                <IconTarget className="home-cta-icon" />
                <span className="home-cta-label">
                  {tripBusy ? "Startar…" : "Starta fiskepass"}
                </span>
              </button>
              <Link className="home-cta home-cta-map" to="/karta">
                <span className="home-cta-icon-ring" aria-hidden>
                  <IconPin className="home-cta-icon" />
                </span>
                <span className="home-cta-label">Till kanalen</span>
              </Link>
            </div>
          )}
          {tripMsg && <p className="home-cta-msg">{tripMsg}</p>}
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
              <span
                className="home-tab-icon"
                style={{
                  WebkitMaskImage: `url(${t.icon})`,
                  maskImage: `url(${t.icon})`,
                }}
                aria-hidden
              />
              <span className="home-tab-label">{t.label}</span>
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

            <KanalToppen
              period={period}
              onPeriod={setPeriod}
              rows={rows}
              loading={loading}
            />
          </div>
        )}

        {tab === "fangst" && (
          <div className="home-panel" role="tabpanel" id="catch">
            <CatchForm
              onSubmitted={() => {
                setReloadToken((n) => n + 1);
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
            <ProfileStudio />
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
