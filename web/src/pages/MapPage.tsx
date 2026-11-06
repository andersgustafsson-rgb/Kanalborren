import { useState } from "react";
import { Link } from "react-router-dom";
import { CanalMap } from "../map/CanalMap";
import type { LayerToggles } from "../map/types";

const INITIAL: LayerToggles = {
  canal: true,
  spots: true,
  zones: false,
  bridges: false,
  rules: false,
  catches: false,
};

export function MapPage() {
  const [toggles, setToggles] = useState<LayerToggles>(INITIAL);
  const [layersOpen, setLayersOpen] = useState(false);

  function toggle(key: keyof LayerToggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="app map-app">
      <Link className="brand-logo-link" to="/" aria-label="KanalHugget hem">
        <img
          className="brand-logo"
          src="/brand/kanalhugget-logo.png"
          alt="KanalHugget"
          width={280}
          height={100}
          decoding="async"
        />
      </Link>

      <div className="hud-actions">
        <Link className="fab" to="/">
          Hem
        </Link>
        <Link className="fab" to="/hjalp">
          Hjälp
        </Link>
        <Link className="fab" to="/profil">
          Profil
        </Link>
        <button
          type="button"
          className={layersOpen ? "fab on" : "fab"}
          aria-expanded={layersOpen}
          aria-controls="layer-panel"
          onClick={() => setLayersOpen((v) => !v)}
        >
          Lager
        </button>
      </div>

      {layersOpen && (
        <div
          id="layer-panel"
          className="layer-sheet"
          role="group"
          aria-label="Kartlager"
        >
          {(
            [
              ["canal", "Kanal"],
              ["spots", "Platser"],
              ["zones", "Zoner"],
              ["catches", "Fångster (7d)"],
              ["bridges", "Broar"],
              ["rules", "Regler"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={toggles[key] ? "chip on" : "chip"}
              aria-pressed={toggles[key]}
              onClick={() => toggle(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <CanalMap toggles={toggles} />
    </div>
  );
}
