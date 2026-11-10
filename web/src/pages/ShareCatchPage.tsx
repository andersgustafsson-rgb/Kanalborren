import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { removePhotoBackground } from "../lib/cutout";
import { SPECIES } from "../lib/species";
import {
  composeShareCard,
  shareOrDownloadBlob,
  type ShareMode,
} from "../lib/shareCard";
import { loadShareDraft } from "../lib/shareDraft";
import "./ShareCatchPage.css";

const SAMPLE = "/labb/test-catch.jpg";

type Busy = null | "cutout" | "compose" | "share";

function draftLength(v: number | null): string {
  return v != null ? String(v).replace(".", ",") : "";
}

export function ShareCatchPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = useMemo(() => loadShareDraft(), []);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<ShareMode>("photo");
  const [species, setSpecies] = useState(draft?.species || "Abborre");
  const [lengthCm, setLengthCm] = useState(draftLength(draft?.lengthCm ?? null));
  const [weightKg, setWeightKg] = useState(draftLength(draft?.weightKg ?? null));
  const [placeName, setPlaceName] = useState(draft?.placeName || "");
  const [showPlace, setShowPlace] = useState(
    draft ? !draft.isPrivate && Boolean(draft.placeName) : true,
  );
  const [caughtAt] = useState(
    () => draft?.caughtAt || new Date().toISOString(),
  );
  const [fromCatch] = useState(() => Boolean(draft));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);

  const photoObject = useRef<string | null>(null);
  const cutoutObject = useRef<string | null>(null);
  const previewObject = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoObject.current) URL.revokeObjectURL(photoObject.current);
      if (cutoutObject.current) URL.revokeObjectURL(cutoutObject.current);
      if (previewObject.current) URL.revokeObjectURL(previewObject.current);
    };
  }, []);

  const needsCutout = mode === "template" || mode === "blur";

  const meta = useMemo(() => {
    const n = Number(String(lengthCm).replace(",", "."));
    const w = Number(String(weightKg).replace(",", "."));
    return {
      species,
      lengthCm: Number.isFinite(n) && n > 0 ? n : null,
      weightKg: Number.isFinite(w) && w > 0 ? w : null,
      caughtAt,
      placeName: placeName.trim() || null,
      showPlace,
    };
  }, [species, lengthCm, weightKg, caughtAt, placeName, showPlace]);

  async function ensurePhotoBlob(): Promise<Blob> {
    if (photoBlob) return photoBlob;
    throw new Error("Välj ett foto först");
  }

  function clearCutout() {
    if (cutoutObject.current) {
      URL.revokeObjectURL(cutoutObject.current);
      cutoutObject.current = null;
    }
    setCutoutBlob(null);
    setCutoutUrl(null);
  }

  function clearPreview() {
    if (previewObject.current) {
      URL.revokeObjectURL(previewObject.current);
      previewObject.current = null;
    }
    setPreviewUrl(null);
  }

  async function setPhoto(blob: Blob, preview?: string) {
    clearCutout();
    clearPreview();
    if (photoObject.current) {
      URL.revokeObjectURL(photoObject.current);
      photoObject.current = null;
    }
    const url = preview || URL.createObjectURL(blob);
    if (!preview) photoObject.current = url;
    setPhotoBlob(blob);
    setPhotoUrl(url);
    setMsg(null);
  }

  async function loadSample() {
    const res = await fetch(SAMPLE);
    await setPhoto(await res.blob(), SAMPLE);
  }

  async function ensureCutout(photo: Blob): Promise<Blob | null> {
    if (cutoutBlob) return cutoutBlob;
    setBusy("cutout");
    setMsg(null);
    const { blob, error } = await removePhotoBackground(photo);
    setBusy(null);
    if (!blob) {
      setMsg(error || "Kunde inte frilägga");
      setMsgOk(false);
      return null;
    }
    if (cutoutObject.current) URL.revokeObjectURL(cutoutObject.current);
    const url = URL.createObjectURL(blob);
    cutoutObject.current = url;
    setCutoutBlob(blob);
    setCutoutUrl(url);
    return blob;
  }

  async function buildPreview() {
    setMsg(null);
    try {
      const photo = await ensurePhotoBlob();
      let cut: Blob | null = null;
      if (needsCutout) {
        cut = await ensureCutout(photo);
        if (!cut && mode === "template") {
          setMsgOk(false);
          setMsg(
            "Friläggning misslyckades — förhandsvisar mall med fotoplatta i stället.",
          );
        }
        if (!cut && mode === "blur") {
          setMsgOk(false);
          setMsg(
            "Friläggning misslyckades — visar skarpt foto utan blur-lager.",
          );
        }
      }
      setBusy("compose");
      const out = await composeShareCard({
        mode,
        photo,
        cutout: cut,
        meta,
      });
      clearPreview();
      const url = URL.createObjectURL(out);
      previewObject.current = url;
      setPreviewUrl(url);
      setBusy(null);
      if (!msg) {
        setMsgOk(true);
        setMsg("Förhandsvisning klar");
      }
    } catch (e) {
      setBusy(null);
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : "Kunde inte bygga bild");
    }
  }

  async function onShare() {
    setMsg(null);
    try {
      const photo = await ensurePhotoBlob();
      let cut: Blob | null = cutoutBlob;
      if (needsCutout && !cut) cut = await ensureCutout(photo);
      setBusy("compose");
      const out = await composeShareCard({
        mode,
        photo,
        cutout: cut,
        meta,
      });
      clearPreview();
      const url = URL.createObjectURL(out);
      previewObject.current = url;
      setPreviewUrl(url);
      setBusy("share");
      const how = await shareOrDownloadBlob(out);
      setBusy(null);
      setMsgOk(true);
      setMsg(
        how === "shared"
          ? "Öppnade delning"
          : "Bilden laddades ner (dela manuellt)",
      );
    } catch (e) {
      setBusy(null);
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : "Kunde inte dela");
    }
  }

  const busyLabel =
    busy === "cutout"
      ? "Jobbar…"
      : busy === "compose"
        ? "Bygger bild…"
        : busy === "share"
          ? "Delar…"
          : null;

  return (
    <div className="share-catch">
      <div className="share-catch-stack">
        <header className="share-catch-head">
          <Link to="/profil">← Profil</Link>
          <div>
            <p className="share-catch-kicker">Dela</p>
            <h1>Dela din fångst</h1>
            <p>
              {fromCatch
                ? "Art, mått och plats hämtades från din fångst. Välj foto och look."
                : "Välj foto och look. Allt byggs lokalt på telefonen."}
            </p>
          </div>
        </header>

        <section className="share-catch-board">
          {fromCatch && (
            <p className="share-catch-draft">
              Från senaste fångsten · {species}
              {meta.lengthCm != null ? ` · ${meta.lengthCm} cm` : ""}
              {meta.weightKg != null ? ` · ${meta.weightKg} kg` : ""}
              {showPlace && placeName ? ` · ${placeName}` : ""}
            </p>
          )}
          <div className="share-catch-actions">
            <button
              type="button"
              className="cta"
              disabled={!!busy}
              onClick={() => fileRef.current?.click()}
            >
              Välj foto
            </button>
            <button
              type="button"
              className="chip"
              disabled={!!busy}
              onClick={() => void loadSample()}
            >
              Testbild
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void setPhoto(f);
                e.target.value = "";
              }}
            />
          </div>

          <p className="share-catch-label">Look</p>
          <div className="share-catch-modes" role="radiogroup" aria-label="Look">
            {(
              [
                ["photo", "Eget foto"],
                ["template", "Malmö-mall"],
                ["blur", "Blur bakgrund"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mode === id}
                className={mode === id ? "chip on" : "chip"}
                disabled={!!busy}
                onClick={() => {
                  setMode(id);
                  clearPreview();
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="share-catch-hint">
            {mode === "photo" && "Originalfoto + logo och text ovanpå."}
            {mode === "template" &&
              "Frilägger och zoomar in dig+fisk på Malmö-mallen."}
            {mode === "blur" &&
              "Frilägger och zoomar in motivet mot suddig bakgrund."}
          </p>

          {!fromCatch && (
            <>
              <label className="share-catch-field">
                Art
                <select
                  value={species}
                  disabled={!!busy}
                  onChange={(e) => {
                    setSpecies(e.target.value);
                    clearPreview();
                  }}
                >
                  {SPECIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}
                    </option>
                  ))}
                </select>
              </label>

              <div className="share-catch-row">
                <label className="share-catch-field">
                  Längd (cm)
                  <input
                    inputMode="decimal"
                    value={lengthCm}
                    disabled={!!busy}
                    placeholder="32"
                    onChange={(e) => {
                      setLengthCm(e.target.value);
                      clearPreview();
                    }}
                  />
                </label>
                <label className="share-catch-field">
                  Vikt (kg)
                  <input
                    inputMode="decimal"
                    value={weightKg}
                    disabled={!!busy}
                    placeholder="0,8"
                    onChange={(e) => {
                      setWeightKg(e.target.value);
                      clearPreview();
                    }}
                  />
                </label>
              </div>

              {showPlace && (
                <label className="share-catch-field">
                  Plats
                  <input
                    value={placeName}
                    disabled={!!busy}
                    placeholder="t.ex. Slottsparken"
                    onChange={(e) => {
                      setPlaceName(e.target.value);
                      clearPreview();
                    }}
                  />
                </label>
              )}
            </>
          )}

          <label className="share-catch-check">
            <input
              type="checkbox"
              checked={showPlace}
              disabled={!!busy}
              onChange={(e) => {
                setShowPlace(e.target.checked);
                clearPreview();
              }}
            />
            Visa plats på bilden
            {fromCatch && draft?.isPrivate ? " (fångsten var privat)" : ""}
          </label>

          <div className="share-catch-actions">
            <button
              type="button"
              className="chip"
              disabled={!!busy || !photoUrl}
              onClick={() => void buildPreview()}
            >
              Förhandsvisa
            </button>
            <button
              type="button"
              className="cta"
              disabled={!!busy || !photoUrl}
              onClick={() => void onShare()}
            >
              Dela
            </button>
          </div>

          {busyLabel && (
            <p className="share-catch-status" role="status">
              {busyLabel}
            </p>
          )}
          {msg && (
            <p className={msgOk ? "share-catch-msg ok" : "share-catch-msg"}>
              {msg}
            </p>
          )}

          <div className="share-catch-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Förhandsvisning av delningsbild" />
            ) : photoUrl ? (
              <div className="share-catch-source">
                <img src={photoUrl} alt="Valt foto" />
                {cutoutUrl && mode !== "photo" && (
                  <img
                    className="share-catch-cutout-thumb"
                    src={cutoutUrl}
                    alt="Frilagt motiv"
                  />
                )}
              </div>
            ) : (
              <p className="share-catch-empty">Välj ett foto för att börja.</p>
            )}
          </div>
        </section>

        <p className="share-catch-foot">
          <Link to="/labb/frilagg">Öppna bara friläggningslabbet</Link>
        </p>
      </div>
    </div>
  );
}
