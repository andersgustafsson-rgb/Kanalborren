import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  listChallengeTargets,
  listMyChallenges,
  loadChallengeScores,
  resolveChallenge,
  respondChallenge,
  sendChallenge,
  type Challenge,
  type ChallengeMetric,
  type ChallengeScores,
  type ChallengeTarget,
} from "../lib/challenges";
import { SPECIES_IDS as SPECIES } from "../lib/species";
import "./ChallengeBoard.css";

const HOURS = [
  { h: 6, label: "6 tim" },
  { h: 12, label: "12 tim" },
  { h: 24, label: "24 tim" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function metricLabel(m: ChallengeMetric) {
  return m === "weight_kg" ? "vikt" : "längd";
}

function fmtScore(n: number | null, m: ChallengeMetric) {
  if (n == null) return "–";
  return m === "weight_kg" ? `${n.toFixed(2)} kg` : `${n.toFixed(1)} cm`;
}

function IconRods() {
  return (
    <svg viewBox="0 0 40 40" className="ch-icon-rods" aria-hidden>
      <path
        d="M8 32 L28 8"
        stroke="#f4c430"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M12 32 L32 8"
        stroke="#dff56a"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M28 8c3 0 5 2 5 4M32 8c3 0 5 2 5 4"
        stroke="#8febf5"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="8" cy="32" r="2" fill="#f4c430" />
      <circle cx="12" cy="32" r="2" fill="#dff56a" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconFish() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M3 12c4-5 9-7 14-5 2 .8 3.5 2.2 4.5 4-1 1.8-2.5 3.2-4.5 4-5 2-10 0-14-5z"
        fill="currentColor"
      />
      <circle cx="8.5" cy="11.2" r="1.1" fill="#061018" />
    </svg>
  );
}

function IconRuler() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect
        x="3.5"
        y="8"
        width="17"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M7 8v3M10 8v2M13 8v3M16 8v2M19 8v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 12l15-7-5 15-2.5-6.5L4 12z" fill="currentColor" />
    </svg>
  );
}

type Props = {
  /** Bump after a catch is saved so scoreboards refresh. */
  reloadToken?: number;
};

export function ChallengeBoard({ reloadToken = 0 }: Props) {
  const auth = useAuth();
  const [rows, setRows] = useState<Challenge[]>([]);
  const [scores, setScores] = useState<Map<string, ChallengeScores>>(new Map());
  const [targets, setTargets] = useState<ChallengeTarget[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [pickedName, setPickedName] = useState("");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [species, setSpecies] = useState("Abborre");
  const [metric, setMetric] = useState<ChallengeMetric>("length_cm");
  const [hours, setHours] = useState(12);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!auth.user) {
      setRows([]);
      setScores(new Map());
      setTargets([]);
      return;
    }
    const ch = await listMyChallenges();
    setRows(ch);
    const needScores = ch.filter((c) =>
      ["active", "completed"].includes(c.status),
    );
    setScores(await loadChallengeScores(needScores));
  }, [auth.user]);

  useEffect(() => {
    void reload();
  }, [reload, reloadToken]);

  useEffect(() => {
    if (!auth.user) {
      setTargets([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void listChallengeTargets(query).then((tg) => {
        if (!cancelled) setTargets(tg);
      });
    }, query.trim() ? 180 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [auth.user, query, reloadToken]);

  const pendingIn = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.status === "pending" &&
          auth.user &&
          r.toUserId === auth.user.id,
      ),
    [rows, auth.user],
  );

  const active = useMemo(
    () => rows.filter((r) => r.status === "active"),
    [rows],
  );

  const recent = useMemo(
    () =>
      rows.filter(
        (r) =>
          ["completed", "declined", "expired", "pending"].includes(r.status) &&
          !(
            r.status === "pending" &&
            auth.user &&
            r.toUserId === auth.user.id
          ),
      ),
    [rows, auth.user],
  );

  async function createChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!toUserId) {
      setMsg("Välj vem du utmanar");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await sendChallenge({
      toUserId,
      species,
      metric,
      hours,
      message: `${hours}h i kanalen · störst ${species.toLowerCase()} på ${metricLabel(metric)}`,
    });
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    setMsg("Utmaning skickad");
    setToUserId("");
    setPickedName("");
    setQuery("");
    setPickerOpen(false);
    void reload();
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true);
    setMsg(null);
    const { error } = await respondChallenge(id, accept);
    setBusy(false);
    if (error) setMsg(error);
    else setMsg(accept ? "Utmaning accepterad — fisk på!" : "Nekad");
    void reload();
  }

  async function finish(id: string) {
    setBusy(true);
    setMsg(null);
    const { error, winnerId } = await resolveChallenge(id);
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    if (!winnerId) setMsg("Klart · oavgjort eller ingen fångst rapporterad");
    else if (winnerId === auth.user?.id) setMsg("Du vann!");
    else setMsg("Utmaningen avgjord");
    void reload();
  }

  const head = (
    <header className="ch-head">
      <div className="ch-head-copy">
        <div className="ch-title-row">
          <IconRods />
          <h2 id="challenge-title">
            UTMANA <span>FISKARE</span>
          </h2>
        </div>
        <p>
          Sök upp någon — även hemma får de notis. Folk vid kanalen syns först.
          Störst {metricLabel(metric)} vinner.{" "}
          <Link to="/hjalp#utmana">Så funkar det ›</Link>
        </p>
      </div>
      <div className="ch-hero" aria-hidden>
        <img
          src="/challenge/challenge-hero-abborre.jpg"
          alt=""
          width={320}
          height={320}
        />
      </div>
    </header>
  );

  if (!auth.configured) {
    return (
      <section className="challenge-board" aria-labelledby="challenge-title">
        {head}
        <p className="ch-gate">Molnet saknas — utmaningar kräver inloggning.</p>
      </section>
    );
  }

  if (!auth.user) {
    return (
      <section className="challenge-board" aria-labelledby="challenge-title">
        {head}
        <p className="ch-gate">
          <Link to="/profil#konto">Logga in</Link> för att utmana någon till
          största fångsten.
        </p>
      </section>
    );
  }

  return (
    <section className="challenge-board" aria-labelledby="challenge-title">
      {head}

      <form className="challenge-form" onSubmit={createChallenge}>
        <div className="challenge-picker">
          {pickedName ? (
            <button
              type="button"
              className="challenge-picked"
              onClick={() => {
                setToUserId("");
                setPickedName("");
                setPickerOpen(true);
              }}
            >
              <strong>{pickedName}</strong>
              <span>Byt</span>
            </button>
          ) : (
            <label className="ch-search">
              <span className="ch-search-icon">
                <IconSearch />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                placeholder="Sök namn..."
                autoComplete="off"
                aria-label="Sök fiskare"
              />
            </label>
          )}
          {pickerOpen && !pickedName && (
            <ul className="challenge-suggest" role="listbox">
              {targets.length === 0 && (
                <li className="challenge-suggest-empty">
                  {query.trim()
                    ? "Ingen träff"
                    : "Ingen ute just nu — sök på namn"}
                </li>
              )}
              {targets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={toUserId === t.id}
                    onClick={() => {
                      setToUserId(t.id);
                      setPickedName(t.displayName);
                      setQuery("");
                      setPickerOpen(false);
                    }}
                  >
                    <strong>{t.displayName}</strong>
                    <span>
                      {t.atCanal
                        ? t.openForCompany
                          ? `${t.zoneName || "Kanalen"} · öppen för sällskap`
                          : `${t.zoneName || "Kanalen"} · ute`
                        : "Hemma"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="challenge-row">
          <label className="ch-field">
            <span className="ch-field-label">
              <IconFish /> Art
            </span>
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            >
              {SPECIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-field">
            <span className="ch-field-label">
              <IconRuler /> Vinner på
            </span>
            <select
              value={metric}
              onChange={(e) =>
                setMetric(e.target.value as ChallengeMetric)
              }
            >
              <option value="length_cm">Längd (cm)</option>
              <option value="weight_kg">Vikt (kg)</option>
            </select>
          </label>
        </div>

        <div className="challenge-hours" role="group" aria-label="Tid">
          <span className="ch-hours-icon" aria-hidden>
            <IconClock />
          </span>
          {HOURS.map((o) => (
            <button
              key={o.h}
              type="button"
              className={hours === o.h ? "ch-hour on" : "ch-hour"}
              onClick={() => setHours(o.h)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          className="ch-send"
          disabled={busy || !toUserId}
        >
          <IconSend />
          Skicka utmaning
        </button>
      </form>

      {pendingIn.length > 0 && (
        <div className="challenge-block">
          <h3>Inkommande</h3>
          <ul>
            {pendingIn.map((c) => (
              <li key={c.id}>
                <strong>{c.fromName || "Fiskare"}</strong>
                <span>
                  {c.species} · {metricLabel(c.metric)} · till {fmt(c.endsAt)}
                </span>
                <div className="challenge-actions">
                  <button
                    type="button"
                    className="ch-send compact"
                    disabled={busy}
                    onClick={() => void respond(c.id, true)}
                  >
                    Anta
                  </button>
                  <button
                    type="button"
                    className="ch-ghost"
                    disabled={busy}
                    onClick={() => void respond(c.id, false)}
                  >
                    Neka
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active.length > 0 && (
        <div className="challenge-block">
          <h3>Pågår</h3>
          <ul>
            {active.map((c) => {
              const iAmFrom = c.fromUserId === auth.user!.id;
              const other = iAmFrom ? c.toName : c.fromName;
              const s = scores.get(c.id);
              const myScore = iAmFrom ? s?.fromScore ?? null : s?.toScore ?? null;
              const theirScore = iAmFrom ? s?.toScore ?? null : s?.fromScore ?? null;
              return (
                <li key={c.id}>
                  <strong>vs {other || "Fiskare"}</strong>
                  <span>
                    {c.species} · {metricLabel(c.metric)} · till {fmt(c.endsAt)}
                  </span>
                  <p className="challenge-score">
                    <span>
                      Du <strong>{fmtScore(myScore, c.metric)}</strong>
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {other || "Motståndare"}{" "}
                      <strong>{fmtScore(theirScore, c.metric)}</strong>
                    </span>
                  </p>
                  <div className="challenge-actions">
                    <Link
                      className="ch-ghost"
                      to="/#catch"
                      onClick={() => {
                        try {
                          sessionStorage.setItem(
                            "kanalhugget.catchSpecies",
                            c.species,
                          );
                          window.dispatchEvent(
                            new Event("kanalhugget-catch-species"),
                          );
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Till fliken Fångst
                    </Link>
                    <button
                      type="button"
                      className="ch-send compact"
                      disabled={busy}
                      onClick={() => void finish(c.id)}
                    >
                      Avgör nu
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <div className="challenge-block">
          <h3>Senaste</h3>
          <ul>
            {recent.slice(0, 8).map((c) => {
              const iAmFrom = c.fromUserId === auth.user!.id;
              const other = iAmFrom ? c.toName : c.fromName;
              let result: string = c.status;
              if (c.status === "completed") {
                if (!c.winnerUserId) result = "oavgjort";
                else if (c.winnerUserId === auth.user!.id) result = "du vann";
                else result = `${c.winnerName || other} vann`;
              }
              const s = scores.get(c.id);
              const myScore = iAmFrom ? s?.fromScore ?? null : s?.toScore ?? null;
              const theirScore = iAmFrom ? s?.toScore ?? null : s?.fromScore ?? null;
              return (
                <li key={c.id}>
                  <strong>vs {other || "Fiskare"}</strong>
                  <span>
                    {c.species} · {result}
                    {c.status === "completed"
                      ? ` · du ${fmtScore(myScore, c.metric)} / ${other || "motståndare"} ${fmtScore(theirScore, c.metric)}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {msg && <p className="challenge-msg">{msg}</p>}
    </section>
  );
}
