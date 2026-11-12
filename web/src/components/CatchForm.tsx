import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { FeatureCollection } from "geojson";
import { useAuth } from "../lib/AuthContext";
import { submitCatchReport } from "../lib/catchReports";
import {
  fetchMyCatches,
  isLengthPersonalBest,
  isWeightPersonalBest,
} from "../lib/myCatches";
import { loadSpeciesPbs, saveSpeciesPb } from "../lib/profileStorage";
import { SPECIES } from "../lib/species";
import { fetchSpots } from "../lib/spotsApi";
import { saveShareDraft } from "../lib/shareDraft";
import { loadSession } from "../map/checkinStorage";
import { resolveZone, type ResolvedZone } from "../map/geo";
import { CatchPlacePicker, type CatchPlace } from "./CatchPlacePicker";
import {
  ShareAfterCatchModal,
  type ShareAfterCatchInfo,
} from "./ShareAfterCatchModal";

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
  const [placeSource, setPlaceSource] = useState<
    "gps" | "list" | "map" | "checkin"
  >("gps");
  const [listOpen, setListOpen] = useState(false);
  const [spots, setSpots] = useState<PlaceOption[]>([]);
  const [spotsGeo, setSpotsGeo] = useState<FeatureCollection | null>(null);
  const [zonesGeo, setZonesGeo] = useState<FeatureCollection | null>(null);
  const [geoReady, setGeoReady] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsResolveSource, setGpsResolveSource] = useState<
    ResolvedZone["source"] | null
  >(null);
  const [bait, setBait] = useState("");
  const [note, setNote] = useState("");
  const [caughtDate, setCaughtDate] = useState(() => toLocalDate());
  const [caughtTime, setCaughtTime] = useState(() => toLocalTime());
  const [whenOpen, setWhenOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);
  const [sharePrompt, setSharePrompt] = useState<ShareAfterCatchInfo | null>(
    null,
  );
  const [artOpen, setArtOpen] = useState(false);

  function say(text: string | null, ok = false) {
    setMsg(text);
    setMsgOk(ok);
  }

  function setCaughtToNow() {
    const now = new Date();
    setCaughtDate(toLocalDate(now));
    setCaughtTime(toLocalTime(now));
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchSpots().then(async (cloud) => {
        if (cloud) return cloud;
        const r = await fetch("/geo/lokala-platser.geojson");
        return (await r.json()) as FeatureCollection;
      }),
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
        setGeoReady(true);
      })
      .catch(() => {
        if (!cancelled) setGeoReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyPlace(
    place: CatchPlace,
    source: "gps" | "list" | "map" | "checkin",
    resolveSource?: ResolvedZone["source"] | null,
  ) {
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
    setPlaceSource(source);
    setGpsResolveSource(source === "gps" ? resolveSource ?? null : null);
    if (source !== "list") setListOpen(false);
  }

  /** Prefer active check-in zone — same place you already chose on the map. */
  function applyCheckInPlace(): boolean {
    const session = loadSession();
    if (!session?.zoneId || !session.zoneName) return false;
    if (Date.parse(session.expiresAt) <= Date.now()) return false;
    applyPlace(
      { id: session.zoneId, name: session.zoneName },
      "checkin",
    );
    return true;
  }

  function resolveFromCoords(lat: number, lng: number): ResolvedZone | null {
    if (!spotsGeo) return null;
    const zones =
      zonesGeo ||
      ({ type: "FeatureCollection", features: [] } as FeatureCollection);
    return resolveZone(lat, lng, spotsGeo, zones);
  }

  function useGpsPlace() {
    if (!spotsGeo) {
      say("Platser laddas…");
      return;
    }

    // If already checked in, keep that zone unless GPS finds a named place.
    const session = loadSession();
    const hasCheckIn =
      Boolean(session?.zoneId && session.zoneName) &&
      Date.parse(session!.expiresAt) > Date.now();

    if (!navigator.geolocation) {
      if (applyCheckInPlace()) {
        say("GPS saknas — använder din check-in");
        return;
      }
      say("GPS saknas — välj plats eller karta i stället");
      return;
    }

    setGpsBusy(true);
    say(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const z = resolveFromCoords(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        setGpsBusy(false);
        if (!z) {
          if (!applyCheckInPlace()) {
            say("Kunde inte koppla plats — välj i lista eller karta");
          }
          return;
        }
        // Named spot/zone from GPS wins; broad fallback yields to check-in.
        if (z.source === "fallback" && hasCheckIn) {
          applyCheckInPlace();
          say(`GPS för vag — använder ${session!.zoneName}`);
          return;
        }
        applyPlace({ id: z.id, name: z.name }, "gps", z.source);
      },
      () => {
        setGpsBusy(false);
        if (applyCheckInPlace()) {
          say("Kunde inte hämta GPS — använder din check-in");
          return;
        }
        say("Kunde inte hämta position — välj plats eller karta");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10_000 },
    );
  }

  const autoPlaceRef = useRef(false);
  // Default: check-in zone first, otherwise GPS once geo is ready.
  useEffect(() => {
    if (!auth.user || !geoReady || !spotsGeo || autoPlaceRef.current) return;
    autoPlaceRef.current = true;
    if (applyCheckInPlace()) return;
    // No check-in: try resolving from last private fix stored by map, else GPS.
    const session = loadSession();
    if (session?.privateLat != null && session?.privateLng != null) {
      const z = resolveFromCoords(session.privateLat, session.privateLng);
      if (z && z.source !== "fallback") {
        applyPlace({ id: z.id, name: z.name }, "gps", z.source);
        return;
      }
    }
    useGpsPlace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once when geo+auth ready
  }, [auth.user, geoReady, spotsGeo]);

  useEffect(() => {
    function applyPref() {
      try {
        const pref = sessionStorage.getItem("kanalhugget.catchSpecies");
        if (pref && SPECIES.some((s) => s.id === pref)) {
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
      say("Logga in under Profil först");
      return;
    }
    const len = parseNum(lengthCm);
    const w = parseNum(weightKg);
    if (Number.isNaN(len as number)) {
      say("Ogiltig längd (cm)");
      return;
    }
    if (Number.isNaN(w as number)) {
      say("Ogiltig vikt (kg)");
      return;
    }
    if (len != null && (len <= 0 || len > 200)) {
      say("Längd måste vara mellan 0 och 200 cm");
      return;
    }
    if (w != null && (w <= 0 || w > 50)) {
      say("Vikt måste vara mellan 0 och 50 kg");
      return;
    }
    if (len == null && w == null) {
      say("Ange längd, vikt eller båda");
      return;
    }

    const caughtAt = dateTimeToIso(caughtDate, caughtTime);
    if (!caughtAt) {
      say("Välj giltigt datum och tid");
      return;
    }
    if (new Date(caughtAt).getTime() > Date.now() + 60_000) {
      say("Tidpunkten kan inte vara i framtiden");
      return;
    }

    setBusy(true);
    say(null);
    setSharePrompt(null);
    const place =
      (customPlace && customPlace.id === placeId ? customPlace : null) ||
      ZONES.find((z) => z.id === placeId) ||
      spots.find((s) => s.id === placeId) ||
      ZONES[0];
    const prior = await fetchMyCatches(400);
    const declared = loadSpeciesPbs()[species];
    const lengthPb = isLengthPersonalBest(
      prior,
      species,
      len,
      declared?.lengthCm,
    );
    const weightPb = isWeightPersonalBest(
      prior,
      species,
      w,
      declared?.weightKg,
    );
    const { error } = await submitCatchReport(auth.user.id, {
      species,
      lengthCm: len,
      weightKg: w,
      zoneId: place.id,
      zoneName: place.name,
      bait,
      note,
      caughtAt,
      isPrivate,
    });
    setBusy(false);
    if (error) {
      say(
        /relation .* does not exist|schema cache|weight_kg|is_private/i.test(
          error,
        )
          ? "Databas saknar fält — kör catch_reports_private.sql i Supabase."
          : error,
      );
      return;
    }
    if (lengthPb || weightPb) {
      saveSpeciesPb(species, {
        ...(lengthPb && len != null ? { lengthCm: len } : {}),
        ...(weightPb && w != null ? { weightKg: w } : {}),
      });
    }
    saveShareDraft({
      species,
      lengthCm: len,
      weightKg: w,
      placeName: place.name,
      isPrivate,
      isLengthPb: lengthPb,
      isWeightPb: weightPb,
      caughtAt,
      savedAt: new Date().toISOString(),
    });
    setSharePrompt({
      species,
      lengthCm: len,
      weightKg: w,
      placeName: place.name,
      isLengthPb: lengthPb,
      isWeightPb: weightPb,
    });
    say(
      isPrivate
        ? "Sparad privat · syns bara i din historik"
        : "Fångst sparad · syns i Kanal-toppen",
      true,
    );
    setLengthCm("");
    setWeightKg("");
    setNote("");
    setIsPrivate(false);
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

  const placeName =
    (customPlace && customPlace.id === placeId ? customPlace : null)?.name ||
    ZONES.find((z) => z.id === placeId)?.name ||
    spots.find((s) => s.id === placeId)?.name ||
    "Okänd plats";
  const placeHint =
    placeSource === "checkin"
      ? "från din check-in"
      : placeSource === "gps"
        ? gpsResolveSource === "fallback"
          ? "ungefärlig plats — välj mer precis"
          : "närmast din GPS"
        : placeSource === "map"
          ? "vald på kartan"
          : "vald i listan";
  const whenLabel = whenOpen
    ? `${caughtDate} · ${caughtTime}`
    : "Just nu";

  return (
    <section className="home-board catch-board" aria-labelledby="catch-title">
      <header className="home-board-head">
        <h2 id="catch-title">Rapportera fångst</h2>
        <p>Välj art, fyll i längd eller vikt, kolla platsen.</p>
      </header>
      <form className="catch-form" onSubmit={onSubmit}>
        <button
          type="button"
          className="catch-preview"
          aria-expanded={artOpen}
          aria-haspopup="dialog"
          onClick={() => setArtOpen(true)}
        >
          <img
            className="catch-swatch-img"
            src={
              SPECIES.find((s) => s.id === species)?.img ||
              "/species/annan.svg"
            }
            alt=""
            width={48}
            height={48}
          />
          <div className="catch-preview-copy">
            <strong>{species}</strong>
            <small>
              {lengthCm.trim()
                ? `${lengthCm.replace(",", ".")} cm`
                : "längd saknas"}
              {weightKg.trim()
                ? ` · ${weightKg.replace(",", ".")} kg`
                : ""}
              {" · "}
              {gpsBusy ? "hämtar plats…" : placeName}
            </small>
          </div>
          <span className="catch-preview-byt">Byt art</span>
        </button>

        <fieldset className="catch-block">
          <legend>Mått</legend>
          <p className="catch-hint">Ett av fälten räcker.</p>
          <div className="catch-measures">
            <label className="catch-measure">
              <span>Längd</span>
              <input
                inputMode="decimal"
                value={lengthCm}
                onChange={(e) => setLengthCm(e.target.value)}
                placeholder="43"
                aria-label="Längd i centimeter"
              />
              <em>cm</em>
            </label>
            <label className="catch-measure">
              <span>Vikt</span>
              <input
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="0,8"
                aria-label="Vikt i kilogram"
              />
              <em>kg</em>
            </label>
          </div>
        </fieldset>

        <fieldset className="catch-block catch-place">
          <legend>Plats</legend>
          <div className="catch-place-current" aria-live="polite">
            {gpsBusy ? (
              <strong>Hämtar din position…</strong>
            ) : (
              <>
                <strong>{placeName}</strong>
                <span>{placeHint}</span>
              </>
            )}
            <button
              type="button"
              className="catch-inline"
              disabled={gpsBusy}
              onClick={useGpsPlace}
            >
              Uppdatera
            </button>
          </div>
          <div className="catch-place-row">
            <button
              type="button"
              className={listOpen ? "catch-place-btn on" : "catch-place-btn"}
              onClick={() => setListOpen((v) => !v)}
              aria-expanded={listOpen}
            >
              Välj i lista
            </button>
            <button
              type="button"
              className="catch-place-btn"
              onClick={() => setMapOpen(true)}
            >
              Välj på kartan
            </button>
          </div>
          {listOpen && (
            <select
              value={placeId}
              aria-label="Platslista"
              onChange={(e) => {
                const id = e.target.value;
                const place =
                  ZONES.find((z) => z.id === id) ||
                  spots.find((s) => s.id === id) ||
                  (customPlace && customPlace.id === id ? customPlace : null);
                if (place) applyPlace(place, "list");
                else {
                  setPlaceId(id);
                  setPlaceSource("list");
                  if (customPlace && id !== customPlace.id) setCustomPlace(null);
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
          )}
        </fieldset>

        <CatchPlacePicker
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          onPick={(place) => applyPlace(place, "map")}
          spotsGeo={spotsGeo}
          zonesGeo={zonesGeo}
        />

        <div className="catch-fold">
          <button
            type="button"
            className="catch-fold-btn"
            aria-expanded={whenOpen}
            onClick={() => setWhenOpen((v) => !v)}
          >
            Tid · {whenLabel}
          </button>
          {whenOpen && (
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
              <button
                type="button"
                className="catch-inline"
                onClick={() => {
                  setCaughtToNow();
                  setWhenOpen(false);
                }}
              >
                Sätt till nu
              </button>
            </div>
          )}
        </div>

        <div className="catch-fold">
          <button
            type="button"
            className="catch-fold-btn"
            aria-expanded={extraOpen}
            onClick={() => setExtraOpen((v) => !v)}
          >
            Bete och notering
            {bait || note ? " · ifyllt" : " · valfritt"}
          </button>
          {extraOpen && (
            <div className="catch-extra">
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
            </div>
          )}
        </div>

        <label className="catch-private">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span>
            <strong>Bara för mig</strong>
            <small>
              Sparas i din historik, men syns inte på kartan, i toppen eller för
              andra.
            </small>
          </span>
        </label>

        <button type="submit" className="cta catch-submit" disabled={busy}>
          {busy
            ? "Sparar…"
            : isPrivate
              ? "Spara privat fångst"
              : "Spara fångst"}
        </button>
        {msg && (
          <p className={msgOk ? "catch-msg ok" : "catch-msg"} role="status">
            {msg}
          </p>
        )}
      </form>
      <ShareAfterCatchModal
        open={!!sharePrompt}
        info={sharePrompt}
        onClose={() => setSharePrompt(null)}
      />
      {artOpen &&
        createPortal(
          <div
            className="catch-species-overlay"
            role="presentation"
            onClick={() => setArtOpen(false)}
          >
            <div
              className="catch-species-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="catch-species-title"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="catch-species-head">
                <h3 id="catch-species-title">Välj art</h3>
                <button
                  type="button"
                  className="chip"
                  onClick={() => setArtOpen(false)}
                >
                  Stäng
                </button>
              </header>
              <div
                className="catch-species catch-species-popup"
                role="radiogroup"
                aria-label="Art"
              >
                {SPECIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={species === s.id}
                    className={
                      species === s.id
                        ? "catch-species-btn on"
                        : "catch-species-btn"
                    }
                    onClick={() => {
                      setSpecies(s.id);
                      setArtOpen(false);
                    }}
                  >
                    <img src={s.img} alt="" width={28} height={28} />
                    <span>{s.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
