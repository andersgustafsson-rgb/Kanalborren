import { useEffect, useState, type ReactElement } from "react";
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

function IconFish({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M3.5 12c2.8-3.2 6.2-4.8 10.2-4.8 2.4 0 4.5.7 6.3 2.1L22 12l-2 2.7c-1.8 1.4-3.9 2.1-6.3 2.1-4 0-7.4-1.6-10.2-4.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 12 7 9.6v4.8L3.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="15.2" cy="11.2" r="0.9" fill="currentColor" />
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

function IconHome({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-5.5H10.2V21H5a1 1 0 0 1-1-1v-9.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrophy({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M8 4h8v5.2a4 4 0 0 1-8 0V4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 6H5.5A2.5 2.5 0 0 0 8 9.8M16 6h2.5A2.5 2.5 0 0 1 16 9.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M10 13.2h4L13.2 16H10.8L10 13.2ZM9.5 20h5M12 16v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBulb({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9.2 14.6c.3 1 .9 1.6 1.5 2V18h2.6v-1.4c.6-.4 1.2-1 1.5-2 .8-1.4.7-3.1-.4-4.3A3.8 3.8 0 0 0 8.8 10c-.9 1.1-1.1 2.8-.4 4.2.2.3.5.5.8.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 20h3.6M12 4.5V6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUser({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="8.2"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5.5 19.2c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TABS: {
  id: HomeTab;
  label: string;
  Icon: (props: IconProps) => ReactElement;
  hash?: string;
}[] = [
  { id: "hem", label: "Hem", Icon: IconHome },
  { id: "fangst", label: "Fångst", Icon: IconFish, hash: "catch" },
  { id: "utmana", label: "Utmana", Icon: IconTrophy },
  { id: "tips", label: "Tips", Icon: IconBulb },
  { id: "profil", label: "Profil", Icon: IconUser },
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
                <IconPin className="home-cta-icon" />
                Till kanalen
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
                <IconFish className="home-cta-icon" />
                {tripBusy ? "Startar…" : "Starta fiskepass"}
              </button>
              <Link className="home-cta home-cta-map" to="/karta">
                <IconPin className="home-cta-icon" />
                Till kanalen
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
              <t.Icon className="home-tab-icon" />
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
