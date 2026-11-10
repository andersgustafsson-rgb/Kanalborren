import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { removePhotoBackground } from "../lib/cutout";
import "./CutoutLabPage.css";

type Status = "idle" | "loading_model" | "running" | "done" | "failed";

const SAMPLE = "/labb/test-catch.jpg";

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
      await setSourceFromBlob(await res.blob(), SAMPLE);
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

    let input: Blob | null = sourceBlob;
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
    const { blob, error: err } = await removePhotoBackground(
      input,
      (key, current, total) => {
        if (!total) return;
        const pct = Math.round((current / total) * 100);
        setProgress(`${key}: ${pct}%`);
        setStatus(
          key.toLowerCase().includes("model") || pct < 100
            ? "loading_model"
            : "running",
        );
      },
    );

    if (!blob) {
      setStatus("failed");
      setProgress(null);
      setError(
        err ||
          "Friläggningen gav ett dåligt resultat — originalet behålls. Prova annat foto.",
      );
      return;
    }

    const url = URL.createObjectURL(blob);
    resultObjectUrl.current = url;
    setResultUrl(url);
    setShowResult(true);
    setStatus("done");
    setProgress(null);
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
              AI-tjänst.{" "}
              <Link to="/dela">Gå till Dela fångst →</Link>
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
        </section>
      </div>
    </div>
  );
}
