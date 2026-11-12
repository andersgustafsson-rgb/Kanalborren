import { useState, type ReactElement } from "react";
import type { HighscorePeriod, HighscoreRow } from "../lib/highscores";
import "./KanalToppen.css";

type Props = {
  period: HighscorePeriod;
  onPeriod: (period: HighscorePeriod) => void;
  rows: HighscoreRow[];
  loading: boolean;
};

const PERIODS: { id: HighscorePeriod; label: string; Icon: () => ReactElement }[] = [
  { id: "week", label: "Vecka", Icon: IconCalendar },
  { id: "month", label: "Månad", Icon: IconCalendarGrid },
  { id: "year", label: "År", Icon: IconClock },
  { id: "all", label: "All time", Icon: IconCrown },
];

const PERIOD_NOUN: Record<HighscorePeriod, string> = {
  week: "denna vecka",
  month: "denna månad",
  year: "i år",
  all: "totalt",
};

const PERIOD_EMPTY: Record<HighscorePeriod, string> = {
  week: "veckan",
  month: "månaden",
  year: "året",
  all: "listan",
};

const COLLAPSED = 3;

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}

function IconCalendarGrid() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 16.5h.01M12 16.5h.01" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function IconCrown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 17.5 3 7.5l5 4 4-6 4 6 5-4-1 10H4ZM4.5 20.5h15" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 21s6-5.2 6-10.2A6 6 0 0 0 6 10.8C6 15.8 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  );
}

function IconBars() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 19v-4M10 19v-8M15 19V8M20 19V5" />
    </svg>
  );
}

function Trophy() {
  return (
    <svg className="kt-trophy" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="kt-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe48a" />
          <stop offset="0.55" stopColor="#f2b52e" />
          <stop offset="1" stopColor="#b87412" />
        </linearGradient>
      </defs>
      <path
        d="M14 6h20v10a10 10 0 0 1-20 0V6Z"
        fill="url(#kt-gold)"
      />
      <path
        d="M14 9H8.5a5.5 5.5 0 0 0 6.2 9.4M34 9h5.5a5.5 5.5 0 0 1-6.2 9.4"
        fill="none"
        stroke="url(#kt-gold)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M21 26h6l-1 7h-4l-1-7Z" fill="url(#kt-gold)" />
      <rect x="15" y="34" width="18" height="6" rx="2" fill="url(#kt-gold)" />
    </svg>
  );
}

function Laurel({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className={flip ? "kt-laurel kt-laurel-flip" : "kt-laurel"}
      viewBox="0 0 16 32"
      aria-hidden
    >
      <path d="M12 30C5 25 3 16 7 4" />
      <path d="M7.5 8c-3-.5-4.5-2.5-4.5-4.5 2.5 0 4.2 1.6 4.5 4.5ZM6.2 14c-3-.3-4.8-2.2-5-4.4 2.6-.2 4.5 1.5 5 4.4ZM6 20c-2.8.2-4.9-1.4-5.4-3.6 2.6-.5 4.7.9 5.4 3.6ZM7.6 25.5c-2.6.7-5-.6-5.8-2.7 2.4-.8 4.8.3 5.8 2.7Z" />
    </svg>
  );
}

function SmallCrown() {
  return (
    <svg className="kt-crown" viewBox="0 0 24 18" aria-hidden>
      <path
        d="M2.5 15.5 1.5 4l6 4.5L12 1.5l4.5 7 6-4.5-1 11.5h-19Z"
        fill="#f6c443"
        stroke="#ffe48a"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain";
  if (tone === "plain") {
    return <span className="kt-rank kt-rank-plain">{rank}</span>;
  }
  return (
    <span className={`kt-rank kt-rank-${tone}`}>
      <Laurel />
      <span className="kt-rank-num">{rank}</span>
      <Laurel flip />
    </span>
  );
}

/** Line-art silhouettes so species read at a glance, matching the app's mono icons. */
function SpeciesArt({ species }: { species: string }) {
  const s = species.toLowerCase();
  if (s.startsWith("gädd") || s.startsWith("gadd")) {
    return (
      <svg className="kt-fish" viewBox="0 0 96 32" aria-hidden>
        <path d="M6 16c10-6 30-8 52-7 10 .5 18 2.6 24 7-6 4.4-14 6.5-24 7-22 1-42-1-52-7Z" />
        <path d="M82 16l10-7v14l-10-7ZM52 9l6-4 4 4M54 23l5 4 3-4M14 15.5l6 .5" />
        <circle cx="14" cy="14" r="1.2" className="kt-fish-eye" />
        <path d="M30 12l2 2M38 11l2 2M46 11l2 2M34 19l2-2M42 20l2-2" />
      </svg>
    );
  }
  if (s.startsWith("skrubb")) {
    return (
      <svg className="kt-fish" viewBox="0 0 96 32" aria-hidden>
        <path d="M18 16c4-9 16-13 30-13s24 4 28 13c-4 9-14 13-28 13s-26-4-30-13Z" />
        <path d="M76 16l12-7v14l-12-7ZM24 9c8 2 40 2 48 0M24 23c8-2 40-2 48 0" />
        <circle cx="26" cy="13" r="1.2" className="kt-fish-eye" />
        <circle cx="29" cy="11" r="1.2" className="kt-fish-eye" />
      </svg>
    );
  }
  if (s.startsWith("torsk")) {
    return (
      <svg className="kt-fish" viewBox="0 0 96 32" aria-hidden>
        <path d="M8 17c8-9 22-12 38-11 14 .8 24 4.5 32 11-8 6.5-18 9.6-32 10-16 .6-30-2-38-10Z" />
        <path d="M78 17l12-8v16l-12-8ZM34 6l4-3 4 3 4-3 4 3M40 27l4 3 4-3M14 21l-2 6" />
        <circle cx="17" cy="15" r="1.3" className="kt-fish-eye" />
      </svg>
    );
  }
  if (s.startsWith("abborr")) {
    return (
      <svg className="kt-fish" viewBox="0 0 96 32" aria-hidden>
        <path d="M10 18c8-9 20-13 34-12 12 .8 22 5 30 12-8 6-18 9-30 9.5-14 .5-26-2.5-34-9.5Z" />
        <path d="M74 18l14-8v16l-14-8Z" />
        <path d="M26 9l3-6 3 5 3-6 3 5 3-5 3 5 3-4 2 5" />
        <path d="M34 11v13M44 10v15M54 11v13M63 13v10" className="kt-fish-bars" />
        <circle cx="18" cy="16" r="1.3" className="kt-fish-eye" />
      </svg>
    );
  }
  return (
    <svg className="kt-fish" viewBox="0 0 96 32" aria-hidden>
      <path d="M10 16c9-8 22-11 36-10.5 12 .5 22 4 30 10.5-8 6.5-18 10-30 10.5C32 27 19 24 10 16Z" />
      <path d="M76 16l12-8v16l-12-8ZM40 6l6-3 6 3M42 26l5 3 4-3" />
      <circle cx="18" cy="14.5" r="1.3" className="kt-fish-eye" />
    </svg>
  );
}

function Skyline() {
  return (
    <svg className="kt-skyline" viewBox="0 0 360 56" preserveAspectRatio="none" aria-hidden>
      <path
        className="kt-skyline-fill"
        d="M0 56V44h10v-6h8v6h6V36h4v-6h2v6h4v8h10v-4h12v4h6V30l4-6 4 6v14h8v-8h10v8h8v-6h6v-4h4v4h6v6h10v-10h8v10h6V38h10v6h8v-8l6-6 6 6v8h10v-6h8v6h12V34h4v-8h2v8h4v10h10v-6h8v6h8v-4h10v4h8V40h6v4h8v-10h4v-4h2v4h4v10h8v-6h10v6h8V12l2-6 2 6v32h6v-10h10v10h8v-6h8v6h12V56H0Z"
      />
      <path
        className="kt-skyline-torso"
        d="M276 44V12c0-1 1.2-2 2-6 .8 4 2 5 2 6v32"
      />
      <path className="kt-skyline-water" d="M0 50c30-3 60 3 90 0s60-3 90 0 60 3 90 0 60-3 90 0" />
    </svg>
  );
}

function formatValue(r: HighscoreRow): string {
  if (r.lengthCm != null) return `${Math.round(r.lengthCm)} cm`;
  if (r.weightKg != null) return `${r.weightKg.toFixed(r.weightKg < 10 ? 1 : 0)} kg`;
  return "–";
}

export function KanalToppen({ period, onPeriod, rows, loading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows.slice(0, 20) : rows.slice(0, COLLAPSED);
  const count = rows.length;

  return (
    <section className="kt" aria-labelledby="kt-title">
      <header className="kt-head">
        <Trophy />
        <div className="kt-title-wrap">
          <h1 id="kt-title" className="kt-title">
            Kanal-toppen
          </h1>
          <p className="kt-sub">Kanalens vassaste fiskare · Största fångster</p>
        </div>
        <span className="kt-badge">
          <Laurel />
          <span>Topplista</span>
          <Laurel flip />
        </span>
      </header>

      <div className="kt-periods" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className={period === p.id ? "kt-period on" : "kt-period"}
            onClick={() => {
              onPeriod(p.id);
              setExpanded(false);
            }}
          >
            <p.Icon />
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <ol className="kt-list" aria-live="polite">
        {loading && <li className="kt-empty">Hämtar topplista…</li>}
        {!loading && rows.length === 0 && (
          <li className="kt-empty">
            Inga fångster i {PERIOD_EMPTY[period]} än.
            <span>Bli först — logga din fångst.</span>
          </li>
        )}
        {!loading &&
          visible.map((r, i) => {
            const rank = i + 1;
            return (
              <li
                key={r.id}
                className={`kt-row${rank === 1 ? " kt-row-first" : ""}${
                  rank > 3 ? " kt-row-rest" : ""
                }`}
              >
                {rank === 1 && <SmallCrown />}
                <RankBadge rank={rank} />
                <span className="kt-who">
                  <strong>{r.displayName}</strong>
                  <small>
                    <IconPin />
                    {r.zoneName || "Kanalen"}
                  </small>
                </span>
                <span className="kt-species">
                  <SpeciesArt species={r.species} />
                  <small>{r.species}</small>
                </span>
                <span className="kt-value">{formatValue(r)}</span>
              </li>
            );
          })}
      </ol>

      {!loading && count > 0 && (
        <div className="kt-meta">
          <span className="kt-count">
            <IconBars />
            {count} {count === 1 ? "fångst" : "fångster"} registrerade{" "}
            {PERIOD_NOUN[period]}
          </span>
          {count > COLLAPSED && (
            <button
              type="button"
              className="kt-more"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Visa topp 3" : "Visa hela topplistan"}
              <span aria-hidden>{expanded ? "↑" : "→"}</span>
            </button>
          )}
        </div>
      )}

      <div className="kt-footer" aria-hidden>
        <Skyline />
      </div>
    </section>
  );
}
