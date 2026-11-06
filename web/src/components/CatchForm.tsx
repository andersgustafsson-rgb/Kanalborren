import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { submitCatchReport } from "../lib/catchReports";

const SPECIES = ["Abborre", "Gädda", "Sutare", "Mört", "Annan"];

const ZONES = [
  { id: "slottsparken", name: "Slottsparken" },
  { id: "kungsparken", name: "Kungsparken" },
  { id: "malmohus", name: "Malmöhus" },
  { id: "centralen", name: "Centralen" },
  { id: "davidshall", name: "Davidshall" },
  { id: "triangeln_soder", name: "Södra kanalen" },
  { id: "neptuni", name: "Neptuni" },
  { id: "suell", name: "Suell" },
];

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Local wall-clock for <input type="datetime-local"> */
function toLocalInputValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type Props = {
  onSubmitted?: () => void;
};

export function CatchForm({ onSubmitted }: Props) {
  const auth = useAuth();
  const [species, setSpecies] = useState("Abborre");
  const [lengthCm, setLengthCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [zoneId, setZoneId] = useState(ZONES[0].id);
  const [bait, setBait] = useState("");
  const [note, setNote] = useState("");
  const [useNow, setUseNow] = useState(true);
  const [caughtLocal, setCaughtLocal] = useState(() => toLocalInputValue());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) {
      setMsg("Logga in under Profil först");
      return;
    }
    const len = parseNum(lengthCm);
    const w = parseNum(weightKg);
    if (Number.isNaN(len as number)) {
      setMsg("Ogiltig längd (cm)");
      return;
    }
    if (Number.isNaN(w as number)) {
      setMsg("Ogiltig vikt (kg)");
      return;
    }
    if (len != null && (len <= 0 || len > 200)) {
      setMsg("Längd måste vara mellan 0 och 200 cm");
      return;
    }
    if (w != null && (w <= 0 || w > 50)) {
      setMsg("Vikt måste vara mellan 0 och 50 kg");
      return;
    }
    if (len == null && w == null) {
      setMsg("Ange längd, vikt eller båda");
      return;
    }

    const caughtAt = useNow
      ? new Date().toISOString()
      : localInputToIso(caughtLocal);
    if (!caughtAt) {
      setMsg("Välj giltigt datum och tid");
      return;
    }
    if (new Date(caughtAt).getTime() > Date.now() + 60_000) {
      setMsg("Tidpunkten kan inte vara i framtiden");
      return;
    }

    setBusy(true);
    setMsg(null);
    const zone = ZONES.find((z) => z.id === zoneId) || ZONES[0];
    const { error } = await submitCatchReport(auth.user.id, {
      species,
      lengthCm: len,
      weightKg: w,
      zoneId: zone.id,
      zoneName: zone.name,
      bait,
      note,
      caughtAt,
    });
    setBusy(false);
    if (error) {
      setMsg(
        /relation .* does not exist|schema cache|weight_kg/i.test(error)
          ? "Databas saknar fält — kör catch_reports.sql i Supabase SQL Editor."
          : error,
      );
      return;
    }
    setMsg("Fångst sparad · syns i Kanal-toppen");
    setLengthCm("");
    setWeightKg("");
    setNote("");
    setUseNow(true);
    setCaughtLocal(toLocalInputValue());
    onSubmitted?.();
  }

  if (!auth.configured) {
    return (
      <section className="home-board catch-board">
        <header className="home-board-head">
          <h2>Rapportera fångst</h2>
          <p>
            Molnet är inte inkopplat ännu — fångster kan inte sparas. Kolla att
            miljövariablerna finns på Render och gör en ny deploy.
          </p>
        </header>
      </section>
    );
  }

  if (!auth.user) {
    return (
      <section className="home-board catch-board">
        <header className="home-board-head">
          <h2>Rapportera fångst</h2>
          <p>
            <Link to="/profil#konto">Logga in med e-post</Link> under Profil →
            Konto. Visningsnamnet ovan räcker inte — det är bara en lokal
            profil.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="home-board catch-board" aria-labelledby="catch-title">
      <header className="home-board-head">
        <h2 id="catch-title">Rapportera fångst</h2>
        <p>Minst längd eller vikt · välj tid om du rapporterar senare</p>
      </header>
      <form className="catch-form" onSubmit={onSubmit}>
        <label className="profile-field">
          Art
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            {SPECIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="catch-measures">
          <label className="profile-field">
            Längd (cm)
            <input
              inputMode="decimal"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
              placeholder="valfritt"
            />
          </label>
          <label className="profile-field">
            Vikt (kg)
            <input
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="valfritt"
            />
          </label>
        </div>

        <fieldset className="catch-when">
          <legend>När fångades den?</legend>
          <label className="catch-check">
            <input
              type="radio"
              name="when"
              checked={useNow}
              onChange={() => {
                setUseNow(true);
                setCaughtLocal(toLocalInputValue());
              }}
            />
            Nu (aktuell tid)
          </label>
          <label className="catch-check">
            <input
              type="radio"
              name="when"
              checked={!useNow}
              onChange={() => {
                setUseNow(false);
                setCaughtLocal(toLocalInputValue());
              }}
            />
            Välj datum & tid
          </label>
          {!useNow && (
            <label className="profile-field">
              Datum och tid
              <input
                type="datetime-local"
                required={!useNow}
                value={caughtLocal}
                max={toLocalInputValue()}
                onChange={(e) => setCaughtLocal(e.target.value)}
              />
            </label>
          )}
        </fieldset>

        <label className="profile-field">
          Zon
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            {ZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        <label className="profile-field">
          Bete / teknik
          <input
            value={bait}
            onChange={(e) => setBait(e.target.value)}
            maxLength={80}
            placeholder="jigg, ul…"
          />
        </label>
        <label className="profile-field">
          Kort notering
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="valfritt"
          />
        </label>
        <button type="submit" className="cta" disabled={busy}>
          {busy ? "Sparar…" : "Skicka fångst"}
        </button>
        {msg && <p className="catch-msg">{msg}</p>}
      </form>
    </section>
  );
}
