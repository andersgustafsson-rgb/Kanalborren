import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./CutoutLabPage.css";

type Status =
  | "idle"
  | "loading_model"
  | "running"
  | "done"
  | "failed";

const SAMPLE = "/labb/test-catch.jpg";

/** Rough quality check — mostly-transparent PNG is a failed cutout. */
async function looksLikeFailedCutout(blob: Blob): Promise<boolean> {
  if (blob.size < 2_000) return true;
  try {
    const bmp = await createImageBitmap(blob);
    const w = Math.min(64, bmp.width);
    const h = Math.min(64, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return false;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const { data } = ctx.getImageData(0, 0, w, h);
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 24) opaque += 1;
    }
    const ratio = opaque / (w * h);
    return ratio < 0.02 || ratio > 0.98;
  } catch {
    return false;
  }
}

export function CutoutLabPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(SAMPLE);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(true);
  const sourceObjectUrl = useRef<string | null>(null);
  const resultObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (sourceObjectUrl.current) URL.revokeObjectURL(sourceObjectUrl.current);
      if (resultObjectUrl.current) URL.revokeObjectURL(resultObjectUrl.current);
    };
  }, []);

  function clearResult() {
    if (resultObjectUrl.current) {
      URL.revokeObjectURL(resultObjectUrl.current);
      resultObjectUrl.current = null;
    }
    setResultUrl(null);
    setError(null);
    setProgress(null);
    setStatus("idle");
  }

  async function setSourceFromBlob(blob: Blob, previewUrl?: string) {
    clearResult();
    if (sourceObjectUrl.current) {
      URL.revokeObjectURL(sourceObjectUrl.current);
      sourceObjectUrl.current = null;
    }
    const url = previewUrl || URL.createObjectURL(blob);
    if (!previewUrl) sourceObjectUrl.current = url;
    setSourceBlob(blob);
    setSourceUrl(url);
  }

  async function loadSample() {
    try {
      const res = await fetch(SAMPLE);
      if (!res.ok) throw new Error("Kunde inte hämta testbilden");
      const blob = await res.blob();
      await setSourceFromBlob(blob, SAMPLE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ladda testbild");
    }
  }

  function onPickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Välj en bildfil (jpg/png/webp)");
      return;
    }
    void setSourceFromBlob(file);
  }

  async function runCutout() {
    setError(null);
    setProgress(null);
    if (resultObjectUrl.current) {
      URL.revokeObjectURL(resultObjectUrl.current);
      resultObjectUrl.current = null;
    }
    setResultUrl(null);

    let input: Blob | string | null = sourceBlob;
    if (!input && sourceUrl) {
      try {
        const res = await fetch(sourceUrl);
        input = await res.blob();
        setSourceBlob(input);
      } catch {
        setStatus("failed");
        setError("Kunde inte läsa fotot");
        return;
      }
    }
    if (!input) {
      setStatus("failed");
      setError("Välj ett foto först");
      return;
    }

    setStatus("loading_model");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      setStatus("running");
      const blob = await removeBackground(input, {
        model: "isnet_fp16",
        output: { format: "image/png", quality: 0.9 },
        progress: (key, current, total) => {
          if (!total) return;
          const pct = Math.round((current / total) * 100);
          setProgress(`${key}: ${pct}%`);
          if (key.toLowerCase().includes("model") || pct < 100) {
            setStatus("loading_model");
          } else {
            setStatus("running");
          }
        },
      });

      if (await looksLikeFailedCutout(blob)) {
        setStatus("failed");
        setError(
          "Friläggningen gav ett dåligt resultat — originalet behålls. Prova annat foto eller ljusare bakgrund.",
        );
        return;
      }

      const url = URL.createObjectURL(blob);
      resultObjectUrl.current = url;
      setResultUrl(url);
      setShowResult(true);
      setStatus("done");
      setProgress(null);
    } catch (e) {
      console.warn("cutout failed", e);
      setStatus("failed");
      setProgress(null);
      setError(
        e instanceof Error
          ? `Kunde inte frilägga: ${e.message}`
          : "Kunde inte frilägga — originalet behålls",
      );
    }
  }

  const busy = status === "loading_model" || status === "running";
  const statusLabel =
    status === "loading_model"
      ? "Laddar modell…"
      : status === "running"
        ? "Frilägger…"
        : status === "done"
          ? "Klart"
          : status === "failed"
            ? "Misslyckades"
            : "Redo";

  return (
    <div className="cutout-lab">
      <div className="cutout-lab-stack">
        <header className="cutout-lab-head">
          <Link to="/profil">← Profil</Link>
          <div>
            <p className="cutout-lab-kicker">Labb</p>
            <h1>Friläggning</h1>
            <p>
              Lokal bakgrundsborttagning i telefonen — ingen uppladdning till
              AI-tjänst. Spike innan Dela fångst.
            </p>
          </div>
        </header>

        <section className="cutout-lab-board">
          <div className="cutout-lab-actions">
            <button
              type="button"
              className="cta"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Välj foto
            </button>
            <button
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void loadSample()}
            >
              Ladda testbild
            </button>
            <button
              type="button"
              className="chip"
              disabled={busy || !sourceUrl}
              onClick={() => void runCutout()}
            >
              {busy ? statusLabel : "Frilägg"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>

          <p className="cutout-lab-status" role="status">
            {statusLabel}
            {progress ? ` · ${progress}` : ""}
          </p>
          {error && <p className="cutout-lab-error">{error}</p>}

          {resultUrl && (
            <div className="cutout-lab-toggle" role="group" aria-label="Vy">
              <button
                type="button"
                className={!showResult ? "chip on" : "chip"}
                onClick={() => setShowResult(false)}
              >
                Original
              </button>
              <button
                type="button"
                className={showResult ? "chip on" : "chip"}
                onClick={() => setShowResult(true)}
              >
                Frilagd
              </button>
            </div>
          )}

          <div className="cutout-lab-preview">
            {!sourceUrl && (
              <p className="cutout-lab-empty">Välj foto eller ladda testbilden.</p>
            )}
            {sourceUrl && (!resultUrl || !showResult) && (
              <img src={sourceUrl} alt="Originalfoto" />
            )}
            {resultUrl && showResult && (
              <div className="cutout-lab-cutout">
                <img src={resultUrl} alt="Frilagd motiv" />
              </div>
            )}
          </div>

          {resultUrl && status === "done" && (
            <p className="cutout-lab-note">
              Schackrutig bakgrund = transparent. Bedöm om person + fisk håller
              ihop innan vi bygger delningsmallar.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
