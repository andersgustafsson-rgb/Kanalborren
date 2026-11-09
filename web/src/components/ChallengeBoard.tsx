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

type Props = {
  /** Bump after a catch is saved so scoreboards refresh. */
  reloadToken?: number;
};

export function ChallengeBoard({ reloadToken = 0 }: Props) {
  const auth = useAuth();
  const [rows, setRows] = useState<Challenge[]>([]);
  const [scores, setScores] = useState<Map<string, ChallengeScores>>(new Map());
  const [targets, setTargets] = useState<{ id: string; displayName: string }[]>(
    [],
  );
  const [toUserId, setToUserId] = useState("");
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
    const [ch, tg] = await Promise.all([
      listMyChallenges(),
      listChallengeTargets(),
    ]);
    setRows(ch);
    setTargets(tg);
    const needScores = ch.filter((c) =>
      ["active", "completed"].includes(c.status),
    );
    setScores(await loadChallengeScores(needScores));
  }, [auth.user]);

  useEffect(() => {
    void reload();
  }, [reload, reloadToken]);

  useEffect(() => {
    if (!toUserId && targets[0]) setToUserId(targets[0].id);
  }, [targets, toUserId]);

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
      message: `Utmaning: störst ${species.toLowerCase()} på ${metricLabel(metric)}`,
    });
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    setMsg("Utmaning skickad");
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

  if (!auth.configured) {
    return (
      <section className="home-board challenge-board">
        <header className="home-board-head">
          <h2>Utmana fiskare</h2>
          <p>Molnet saknas — utmaningar kräver inloggning.</p>
        </header>
      </section>
    );
  }

  if (!auth.user) {
    return (
      <section className="home-board challenge-board">
        <header className="home-board-head">
          <h2>Utmana fiskare</h2>
          <p>
            <Link to="/profil#konto">Logga in</Link> för att utmana någon till
            största fångsten.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="home-board challenge-board" aria-labelledby="challenge-title">
      <header className="home-board-head">
        <h2 id="challenge-title">Utmana fiskare</h2>
        <p>
          Skicka en duell · båda rapporterar fångst · störst {metricLabel(metric)}{" "}
          vinner. Efter sluttid avgörs den automatiskt och försvinner inom ett
          dygn.{" "}
          <Link to="/hjalp#utmana">Så funkar det</Link>
        </p>
      </header>

      <form className="challenge-form" onSubmit={createChallenge}>
        <label className="profile-field">
          Utmana
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            required
          >
            {targets.length === 0 && (
              <option value="">Inga andra användare ännu</option>
            )}
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="challenge-row">
          <label className="profile-field">
            Art
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
          <label className="profile-field">
            Vinner på
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
          {HOURS.map((o) => (
            <button
              key={o.h}
              type="button"
              className={hours === o.h ? "period on" : "period"}
              onClick={() => setHours(o.h)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button type="submit" className="cta" disabled={busy || !toUserId}>
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
                    className="cta"
                    disabled={busy}
                    onClick={() => void respond(c.id, true)}
                  >
                    Anta
                  </button>
                  <button
                    type="button"
                    className="chip"
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
                      className="chip"
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
                      className="cta"
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
