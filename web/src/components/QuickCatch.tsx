import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  deleteCatchReport,
  submitCatchReport,
  updateCatchMeasures,
} from "../lib/catchReports";
import {
  loadLastPrivate,
  loadLastSpecies,
  openQuickCatch,
  QUICK_CATCH_OPEN_EVENT,
  saveLastPrivate,
  saveLastSpecies,
} from "../lib/quickCatchPrefs";
import { QUICK_ZONES, SPECIES } from "../lib/species";
import { loadSession } from "../map/checkinStorage";
import "./QuickCatch.css";

type ToastState = {
  id: string;
  species: string;
  zoneName: string | null;
  expiresAt: number;
};

const UNDO_MS = 12_000;

export function QuickCatch() {
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [species, setSpecies] = useState(() => loadLastSpecies());
  const [isPrivate, setIsPrivate] = useState(() => loadLastPrivate());
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lengthDraft, setLengthDraft] = useState("");
  const [addingLength, setAddingLength] = useState(false);
  const [sessionTick, setSessionTick] = useState(0);

  const session = useMemo(() => loadSession(), [open, sessionTick]);
  const checkedInZone =
    session && session.zoneId && session.zoneName
      ? { id: session.zoneId, name: session.zoneName }
      : null;

  const selectedZone =
    (zoneId && QUICK_ZONES.find((z) => z.id === zoneId)) ||
    (checkedInZone &&
      (QUICK_ZONES.find((z) => z.id === checkedInZone.id) || checkedInZone)) ||
    null;

  useEffect(() => {
    function onOpen() {
      const sess = loadSession();
      setSpecies(loadLastSpecies());
      setIsPrivate(loadLastPrivate());
      setError(null);
      setSessionTick((n) => n + 1);
      // Prefill check-in zone when present; otherwise clear so user picks.
      setZoneId(sess?.zoneId && sess?.zoneName ? sess.zoneId : null);
      setOpen(true);
    }
    window.addEventListener(QUICK_CATCH_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_CATCH_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const left = toast.expiresAt - Date.now();
    if (left <= 0) {
      setToast(null);
      setAddingLength(false);
      setLengthDraft("");
      return;
    }
    const t = window.setTimeout(() => {
      setToast(null);
      setAddingLength(false);
      setLengthDraft("");
    }, left);
    return () => window.clearTimeout(t);
  }, [toast]);

  const hideFab =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/integritet") ||
    location.pathname.startsWith("/villkor");

  function resolvePlace(): { id: string; name: string } | null {
    if (zoneId) {
      const fromList = QUICK_ZONES.find((z) => z.id === zoneId);
      if (fromList) return fromList;
      if (checkedInZone && checkedInZone.id === zoneId) return checkedInZone;
    }
    return checkedInZone;
  }

  async function saveQuick(
    nextSpecies: string,
    place: { id: string; name: string },
  ) {
    if (!auth.user) {
      setError("Logga in för att spara fångst");
      return;
    }
    setBusy(true);
    setError(null);
    saveLastSpecies(nextSpecies);
    saveLastPrivate(isPrivate);
    const { error: err, id } = await submitCatchReport(auth.user.id, {
      species: nextSpecies,
      lengthCm: null,
      weightKg: null,
      zoneId: place.id,
      zoneName: place.name,
      bait: "",
      note: "",
      caughtAt: new Date().toISOString(),
      isPrivate,
    });
    setBusy(false);
    if (err || !id) {
      setError(err || "Kunde inte spara");
      return;
    }
    setOpen(false);
    setAddingLength(false);
    setLengthDraft("");
    setToast({
      id,
      species: nextSpecies,
      zoneName: place.name,
      expiresAt: Date.now() + UNDO_MS,
    });
  }

  async function onPickSpecies(next: string) {
    setSpecies(next);
    const place = resolvePlace();
    if (!place) {
      setError("Välj en zon först");
      return;
    }
    await saveQuick(next, place);
  }

  async function onPickZone(z: { id: string; name: string }) {
    setZoneId(z.id);
    setError(null);
    // If species already chosen visually, save on zone tap (fast path).
    await saveQuick(species, z);
  }

  async function undo() {
    if (!toast) return;
    const id = toast.id;
    setToast(null);
    setAddingLength(false);
    await deleteCatchReport(id);
  }

  async function saveLength() {
    if (!toast) return;
    const n = Number(lengthDraft.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 200) {
      setError("Ange längd 1–200 cm");
      return;
    }
    setBusy(true);
    const { error: err } = await updateCatchMeasures(toast.id, {
      lengthCm: n,
      weightKg: null,
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setToast(null);
    setAddingLength(false);
    setLengthDraft("");
  }

  if (!auth.ready || !auth.user || hideFab) return null;

  const activeZoneId = selectedZone?.id ?? zoneId;

  return (
    <>
      <button
        type="button"
        className="qc-fab"
        aria-label="Logga fångst snabbt"
        title="Logga fångst"
        onClick={() => openQuickCatch()}
      >
        <img src="/species/abborre.svg" alt="" width={22} height={22} />
        <span className="qc-fab-label">Logga fisk</span>
      </button>

      {open && (
        <div
          className="qc-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="qc-sheet"
            role="dialog"
            aria-label="Snabb fångst"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="qc-head">
              <div>
                <p className="qc-kicker">Snabbregg</p>
                <h2>
                  {selectedZone ? `I ${selectedZone.name}` : "Vilken art?"}
                </h2>
              </div>
              <button
                type="button"
                className="qc-close"
                onClick={() => setOpen(false)}
              >
                Stäng
              </button>
            </header>

            <div className="qc-species" role="group" aria-label="Art">
              {SPECIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={
                    species === s.id ? "qc-species-btn on" : "qc-species-btn"
                  }
                  disabled={busy}
                  onClick={() => void onPickSpecies(s.id)}
                >
                  <img src={s.img} alt="" />
                  <span>{s.id}</span>
                </button>
              ))}
            </div>

            <div className="qc-zones" role="group" aria-label="Zon">
              <p className="qc-hint">
                {checkedInZone
                  ? "Zon från check-in — byt om du vill, annars tryck art"
                  : "Välj zon — sparar direkt"}
              </p>
              <div className="qc-zone-row">
                {checkedInZone &&
                  !QUICK_ZONES.some((z) => z.id === checkedInZone.id) && (
                    <button
                      type="button"
                      className={
                        activeZoneId === checkedInZone.id
                          ? "qc-zone on"
                          : "qc-zone"
                      }
                      disabled={busy}
                      onClick={() => {
                        setZoneId(checkedInZone.id);
                        setError(null);
                      }}
                    >
                      {checkedInZone.name}
                    </button>
                  )}
                {QUICK_ZONES.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    className={activeZoneId === z.id ? "qc-zone on" : "qc-zone"}
                    disabled={busy}
                    onClick={() => void onPickZone(z)}
                  >
                    {z.name}
                  </button>
                ))}
              </div>
            </div>

            <label className="qc-private">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Dold fångst (bara du ser den)
            </label>

            {error && <p className="qc-error">{error}</p>}
            <p className="qc-foot">
              {selectedZone
                ? "Tryck art = sparad. Tid och zon fylls i automatiskt."
                : "Välj art och zon. Du kan lägga till längd efteråt."}{" "}
              <Link to="/#catch" onClick={() => setOpen(false)}>
                Full rapport
              </Link>
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div className="qc-toast" role="status">
          <div className="qc-toast-main">
            <strong>{toast.species} sparad</strong>
            {toast.zoneName ? <span>· {toast.zoneName}</span> : null}
          </div>
          {addingLength ? (
            <div className="qc-toast-length">
              <input
                type="number"
                inputMode="decimal"
                placeholder="cm"
                value={lengthDraft}
                onChange={(e) => setLengthDraft(e.target.value)}
                aria-label="Längd i cm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveLength()}
              >
                Spara
              </button>
            </div>
          ) : (
            <div className="qc-toast-actions">
              <button type="button" onClick={() => void undo()}>
                Ångra
              </button>
              <button type="button" onClick={() => setAddingLength(true)}>
                + längd
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
