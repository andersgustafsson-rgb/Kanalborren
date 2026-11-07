import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FeatureCollection } from "geojson";
import { useAuth } from "../lib/AuthContext";
import { submitCatchReport } from "../lib/catchReports";
import { resolveZone } from "../map/geo";
import { CatchPlacePicker, type CatchPlace } from "./CatchPlacePicker";

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

type PlaceOption = { id: string; name: string };

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTime(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateTimeToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
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
  const [placeId, setPlaceId] = useState(ZONES[0].id);
  const [customPlace, setCustomPlace] = useState<PlaceOption | null>(null);
  const [spots, setSpots] = useState<PlaceOption[]>([]);
  const [spotsGeo, setSpotsGeo] = useState<FeatureCollection | null>(null);
  const [zonesGeo, setZonesGeo] = useState<FeatureCollection | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [bait, setBait] = useState("");
  const [note, setNote] = useState("");
  const [caughtDate, setCaughtDate] = useState(() => toLocalDate());
  const [caughtTime, setCaughtTime] = useState(() => toLocalTime());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setCaughtToNow() {
    const now = new Date();
    setCaughtDate(toLocalDate(now));
    setCaughtTime(toLocalTime(now));
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/geo/lokala-platser.geojson").then((r) => r.json()),
      fetch("/geo/sociala-zoner.geojson").then((r) => r.json()).catch(() => null),
    ])
      .then(([spotsJson, zonesJson]) => {
        if (cancelled) return;
        const geo = spotsJson as FeatureCollection;
        setSpotsGeo(geo);
        if (zonesJson) setZonesGeo(zonesJson as FeatureCollection);
        const list = (geo.features || [])
          .map((f) => ({
            id: String(
              (f.properties as { id?: string; name?: string } | null)?.id || "",
            ),
            name: String(
              (f.properties as { id?: string; name?: string } | null)?.name ||
                "",
            ),
          }))
          .filter((p) => p.id && p.name)
          .sort((a, b) => a.name.localeCompare(b.name, "sv"));
        setSpots(list);
      })
      .catch(() => {
        /* keep zones only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyPlace(place: CatchPlace) {
    const known =
      ZONES.find((z) => z.id === place.id) ||
      spots.find((s) => s.id === place.id);
    if (known) {
      setCustomPlace(null);
      setPlaceId(known.id);
    } else {
      setCustomPlace(place);
      setPlaceId(place.id);
    }
    setMsg(`Plats: ${place.name}`);
  }

  function useGpsPlace() {
    if (!navigator.geolocation) {
      setMsg("GPS saknas — peka på kartan i stället");
      return;
    }
    if (!spotsGeo) {
      setMsg("Platser laddas… prova igen om en sekund");
      return;
    }
    setGpsBusy(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const zones = zonesGeo || ({ type: "FeatureCollection", features: [] } as FeatureCollection);
        const z = resolveZone(
          pos.coords.latitude,
          pos.coords.longitude,
          spotsGeo,
          zones,
        );
        applyPlace({ id: z.id, name: z.name });
        setGpsBusy(false);
      },
      () => {
        setGpsBusy(false);
        setMsg("Kunde inte hämta GPS — peka på kartan i stället");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10_000 },
    );
  }

  useEffect(() => {
    function applyPref() {
      try {
        const pref = sessionStorage.getItem("kanalhugget.catchSpecies");
        if (pref && SPECIES.includes(pref)) {
          setSpecies(pref);
          sessionStorage.removeItem("kanalhugget.catchSpecies");
        }
      } catch {
        /* ignore */
      }
    }
    applyPref();
    window.addEventListener("hashchange", applyPref);
    window.addEventListener("kanalhugget-catch-species", applyPref);
    return () => {
      window.removeEventListener("hashchange", applyPref);
      window.removeEventListener("kanalhugget-catch-species", applyPref);
    };
  }, []);

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

    const caughtAt = dateTimeToIso(caughtDate, caughtTime);
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
    const place =
      (customPlace && customPlace.id === placeId ? customPlace : null) ||
      ZONES.find((z) => z.id === placeId) ||
      spots.find((s) => s.id === placeId) ||
      ZONES[0];
    const { error } = await submitCatchReport(auth.user.id, {
      species,
      lengthCm: len,
      weightKg: w,
      zoneId: place.id,
      zoneName: place.name,
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
    setMsg("Fångst sparad · syns i Kanal-toppen och pågående utmaningar");
    setLengthCm("");
    setWeightKg("");
    setNote("");
    setCaughtToNow();
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
          <div className="catch-when-row">
            <label className="profile-field">
              Datum
              <input
                type="date"
                required
                value={caughtDate}
                max={toLocalDate()}
                onChange={(e) => setCaughtDate(e.target.value)}
              />
            </label>
            <label className="profile-field">
              Tid
              <input
                type="time"
                required
                value={caughtTime}
                onChange={(e) => setCaughtTime(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="chip"
            onClick={setCaughtToNow}
          >
            Sätt till nu
          </button>
        </fieldset>

        <fieldset className="catch-place">
          <legend>Plats / zon</legend>
          <p className="catch-place-lead">
            Välj plats manuellt, eller använd din position / kartan.
          </p>
          <div className="catch-place-row">
            <button
              type="button"
              className="catch-place-btn"
              disabled={gpsBusy}
              onClick={useGpsPlace}
            >
              {gpsBusy ? "Hämtar position…" : "Använd min position"}
            </button>
            <button
              type="button"
              className="catch-place-btn"
              onClick={() => setMapOpen(true)}
            >
              Välj på kartan
            </button>
          </div>
          <select
            value={placeId}
            aria-label="Platslista"
            onChange={(e) => {
              setPlaceId(e.target.value);
              if (customPlace && e.target.value !== customPlace.id) {
                setCustomPlace(null);
              }
            }}
          >
            <optgroup label="Zoner">
              {ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </optgroup>
            {spots.length > 0 && (
              <optgroup label="Platser">
                {spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {customPlace && (
              <optgroup label="Vald plats">
                <option value={customPlace.id}>{customPlace.name}</option>
              </optgroup>
            )}
          </select>
        </fieldset>
        <CatchPlacePicker
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          onPick={applyPlace}
          spotsGeo={spotsGeo}
          zonesGeo={zonesGeo}
        />
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
