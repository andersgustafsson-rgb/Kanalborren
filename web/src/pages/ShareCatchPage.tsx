import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { removePhotoBackground } from "../lib/cutout";
import { SPECIES } from "../lib/species";
import {
  composeShareCard,
  composeShareThumb,
  downloadShareBlob,
  shareOrDownloadBlob,
  type ShareCatchMeta,
  type ShareMode,
} from "../lib/shareCard";
import { loadShareDraft } from "../lib/shareDraft";
import "./ShareCatchPage.css";

const SAMPLE = "/labb/test-catch.jpg";

const LOOKS: { id: ShareMode; label: string }[] = [
  { id: "photo", label: "Eget foto" },
  { id: "template", label: "Malmö-mall" },
  { id: "blur", label: "Blur" },
];

type Busy = null | "cutout" | "compose" | "share" | "save";
type ThumbMap = Partial<Record<ShareMode, string>>;

function draftLength(v: number | null): string {
  return v != null ? String(v).replace(".", ",") : "";
}

function revokeMap(map: ThumbMap) {
  for (const url of Object.values(map)) {
    if (url) URL.revokeObjectURL(url);
  }
}

export function ShareCatchPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = useMemo(() => loadShareDraft(), []);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null);
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
  const [thumbs, setThumbs] = useState<ThumbMap>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);

  const photoObject = useRef<string | null>(null);
  const cutoutObject = useRef<string | null>(null);
  const thumbsRef = useRef<ThumbMap>({});
  const genRef = useRef(0);
  const userPickedLook = useRef(false);

  useEffect(() => {
    return () => {
      genRef.current += 1;
      if (photoObject.current) URL.revokeObjectURL(photoObject.current);
      if (cutoutObject.current) URL.revokeObjectURL(cutoutObject.current);
      revokeMap(thumbsRef.current);
    };
  }, []);

  const meta = useMemo<ShareCatchMeta>(() => {
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

  function clearThumbs() {
    revokeMap(thumbsRef.current);
    thumbsRef.current = {};
    setThumbs({});
  }

  function clearCutout() {
    if (cutoutObject.current) {
      URL.revokeObjectURL(cutoutObject.current);
      cutoutObject.current = null;
    }
    setCutoutBlob(null);
  }

  function putThumb(id: ShareMode, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const prev = thumbsRef.current[id];
    if (prev) URL.revokeObjectURL(prev);
    thumbsRef.current = { ...thumbsRef.current, [id]: url };
    setThumbs({ ...thumbsRef.current });
    return url;
  }

  async function buildLooks(photo: Blob, nextMeta: ShareCatchMeta) {
    const gen = ++genRef.current;
    clearThumbs();
    clearCutout();
    setMsg(null);
    setMode("photo");

    try {
      setBusy("compose");
      const photoThumb = await composeShareThumb({
        mode: "photo",
        photo,
        cutout: null,
        meta: nextMeta,
      });
      if (gen !== genRef.current) return;
      putThumb("photo", photoThumb);

      setBusy("cutout");
      const { blob: cut, error } = await removePhotoBackground(photo);
      if (gen !== genRef.current) return;

      if (!cut) {
        setBusy(null);
        setMsgOk(false);
        setMsg(
          error ||
            "Kunde inte frilägga — du kan fortfarande använda Eget foto.",
        );
        return;
      }

      const cutUrl = URL.createObjectURL(cut);
      if (cutoutObject.current) URL.revokeObjectURL(cutoutObject.current);
      cutoutObject.current = cutUrl;
      setCutoutBlob(cut);

      setBusy("compose");
      const [templateThumb, blurThumb] = await Promise.all([
        composeShareThumb({
          mode: "template",
          photo,
          cutout: cut,
          meta: nextMeta,
        }),
        composeShareThumb({
          mode: "blur",
          photo,
          cutout: cut,
          meta: nextMeta,
        }),
      ]);
      if (gen !== genRef.current) return;
      putThumb("template", templateThumb);
      putThumb("blur", blurThumb);
      if (!userPickedLook.current) setMode("template");
      setBusy(null);
      setMsgOk(true);
      setMsg("Välj en look");
    } catch (e) {
      if (gen !== genRef.current) return;
      setBusy(null);
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : "Kunde inte bygga looks");
    }
  }

  async function setPhoto(blob: Blob, preview?: string) {
    genRef.current += 1;
    clearThumbs();
    clearCutout();
    if (photoObject.current) {
      URL.revokeObjectURL(photoObject.current);
      photoObject.current = null;
    }
    const url = preview || URL.createObjectURL(blob);
    if (!preview) photoObject.current = url;
    setPhotoBlob(blob);
    setPhotoUrl(url);
    setMsg(null);
    userPickedLook.current = false;
    await buildLooks(blob, meta);
  }

  async function loadSample() {
    const res = await fetch(SAMPLE);
    await setPhoto(await res.blob(), SAMPLE);
  }

  // Rebuild thumbs when catch text on the card changes (not on first photo pick).
  const metaKey = useMemo(() => JSON.stringify(meta), [meta]);
  const metaKeyRef = useRef(metaKey);
  useEffect(() => {
    if (!photoBlob) {
      metaKeyRef.current = metaKey;
      return;
    }
    if (metaKeyRef.current === metaKey) return;
    metaKeyRef.current = metaKey;
    const handle = window.setTimeout(() => {
      void buildLooks(photoBlob, meta);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [metaKey, meta, photoBlob]);

  async function renderCard(): Promise<Blob> {
    if (!photoBlob) throw new Error("Välj ett foto först");
    let cut: Blob | null = cutoutBlob;
    if ((mode === "template" || mode === "blur") && !cut) {
      setBusy("cutout");
      const { blob } = await removePhotoBackground(photoBlob);
      cut = blob;
      if (blob) {
        if (cutoutObject.current) URL.revokeObjectURL(cutoutObject.current);
        cutoutObject.current = URL.createObjectURL(blob);
        setCutoutBlob(blob);
      }
    }
    setBusy("compose");
    return composeShareCard({
      mode,
      photo: photoBlob,
      cutout: cut,
      meta,
    });
  }

  async function onSave() {
    setMsg(null);
    try {
      const out = await renderCard();
      setBusy("save");
      downloadShareBlob(out);
      setBusy(null);
      setMsgOk(true);
      setMsg("Bilden sparades");
    } catch (e) {
      setBusy(null);
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : "Kunde inte spara");
    }
  }

  async function onShare() {
    setMsg(null);
    try {
      const out = await renderCard();
      setBusy("share");
      const how = await shareOrDownloadBlob(out);
      setBusy(null);
      setMsgOk(true);
      setMsg(
        how === "shared"
          ? "Öppnade delning"
          : "Bilden sparades — dela den från Filmer/Bilder",
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
        ? "Bygger looks…"
        : busy === "save"
          ? "Sparar…"
          : busy === "share"
            ? "Delar…"
            : null;

  const selectedThumb = thumbs[mode] || null;
  const canExport = !!photoBlob && !!thumbs.photo && !busy;

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

          {!fromCatch && (
            <>
              <label className="share-catch-field">
                Art
                <select
                  value={species}
                  disabled={!!busy}
                  onChange={(e) => setSpecies(e.target.value)}
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
                    onChange={(e) => setLengthCm(e.target.value)}
                  />
                </label>
                <label className="share-catch-field">
                  Vikt (kg)
                  <input
                    inputMode="decimal"
                    value={weightKg}
                    disabled={!!busy}
                    placeholder="0,8"
                    onChange={(e) => setWeightKg(e.target.value)}
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
                    onChange={(e) => setPlaceName(e.target.value)}
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
              onChange={(e) => setShowPlace(e.target.checked)}
            />
            Visa plats på bilden
            {fromCatch && draft?.isPrivate ? " (fångsten var privat)" : ""}
          </label>

          {photoUrl && (
            <>
              <p className="share-catch-label">Välj look</p>
              <div
                className="share-catch-looks"
                role="radiogroup"
                aria-label="Look"
              >
                {LOOKS.map(({ id, label }) => {
                  const url = thumbs[id];
                  const waiting =
                    !url &&
                    !!busy &&
                    (id === "photo"
                      ? busy === "compose" && !thumbs.photo
                      : true);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={mode === id}
                      className={
                        mode === id
                          ? "share-catch-look on"
                          : "share-catch-look"
                      }
                      disabled={!url || !!busy}
                      onClick={() => {
                        userPickedLook.current = true;
                        setMode(id);
                      }}
                    >
                      <span className="share-catch-look-frame">
                        {url ? (
                          <img src={url} alt="" />
                        ) : (
                          <span className="share-catch-look-skel">
                            {waiting ? "…" : "—"}
                          </span>
                        )}
                      </span>
                      <span className="share-catch-look-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="share-catch-actions">
            <button
              type="button"
              className="chip"
              disabled={!canExport}
              onClick={() => void onSave()}
            >
              Spara
            </button>
            <button
              type="button"
              className="cta"
              disabled={!canExport}
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
            {selectedThumb ? (
              <img src={selectedThumb} alt="Vald look" />
            ) : photoUrl ? (
              <img src={photoUrl} alt="Valt foto" />
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
