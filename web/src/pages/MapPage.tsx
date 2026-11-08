import { useState } from "react";
import { Link } from "react-router-dom";
import { CanalMap } from "../map/CanalMap";
import { PresenceList } from "../map/PresenceList";
import { useAuth } from "../lib/AuthContext";
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
  const auth = useAuth();
  const [toggles, setToggles] = useState<LayerToggles>(INITIAL);
  const [layersOpen, setLayersOpen] = useState(false);
  const [uteOpen, setUteOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  function toggle(key: keyof LayerToggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openLayers() {
    setUteOpen(false);
    setAdminOpen(false);
    setLayersOpen((v) => !v);
  }

  function openUte(open: boolean) {
    if (open) {
      setLayersOpen(false);
      setAdminOpen(false);
    }
    setUteOpen(open);
  }

  function openAdmin() {
    setUteOpen(false);
    setLayersOpen(false);
    setAdminOpen((v) => !v);
  }

  return (
    <div className={`app map-app${auth.isAdmin ? " is-admin" : ""}`}>
      <header className="map-chrome">
        <nav className="hud-rail" aria-label="Meny">
          <Link
            className="hud-brand"
            to="/"
            aria-label="KanalHugget hem"
          >
            <img
              className="hud-brand-logo"
              src="/brand/kanalhugget-logo.png"
              alt=""
              width={120}
              height={44}
              decoding="async"
            />
          </Link>
          <Link className="hud-item" to="/">
            Hem
          </Link>
          <PresenceList open={uteOpen} onOpenChange={openUte} />
          <button
            type="button"
            className={layersOpen ? "hud-item on" : "hud-item"}
            aria-expanded={layersOpen}
            aria-controls="layer-panel"
            onClick={openLayers}
          >
            Lager
          </button>
          {auth.isAdmin && (
            <button
              type="button"
              className={adminOpen ? "hud-item on admin" : "hud-item admin"}
              aria-expanded={adminOpen}
              aria-controls="admin-panel"
              onClick={openAdmin}
            >
              Admin
            </button>
          )}
        </nav>
      </header>

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

      <CanalMap toggles={toggles} adminOpen={adminOpen} />
    </div>
  );
}
