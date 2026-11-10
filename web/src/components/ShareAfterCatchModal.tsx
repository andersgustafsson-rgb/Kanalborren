import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import "./ShareAfterCatchModal.css";

export type ShareAfterCatchInfo = {
  species: string;
  lengthCm?: number | null;
  weightKg?: number | null;
  placeName?: string | null;
};

type Props = {
  open: boolean;
  info: ShareAfterCatchInfo | null;
  onClose: () => void;
};

function summary(info: ShareAfterCatchInfo): string {
  const bits = [info.species];
  if (info.lengthCm != null && Number.isFinite(info.lengthCm)) {
    bits.push(`${String(info.lengthCm).replace(".", ",")} cm`);
  }
  if (info.weightKg != null && Number.isFinite(info.weightKg)) {
    bits.push(`${String(info.weightKg).replace(".", ",")} kg`);
  }
  if (info.placeName?.trim()) bits.push(info.placeName.trim());
  return bits.join(" · ");
}

export function ShareAfterCatchModal({ open, info, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !info) return null;

  return createPortal(
    <div
      className="share-after-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="share-after-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-after-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="share-after-kicker">Sparad</p>
        <h2 id="share-after-title">Vill du dela bilden?</h2>
        <p className="share-after-summary">{summary(info)}</p>
        <p className="share-after-hint">
          Välj foto och look — art, mått och plats följer med.
        </p>
        <div className="share-after-actions">
          <Link className="cta share-after-cta" to="/dela" onClick={onClose}>
            Dela bild
          </Link>
          <button type="button" className="chip" onClick={onClose}>
            Stäng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
