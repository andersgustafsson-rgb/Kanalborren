import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CanalMap } from "../map/CanalMap";
import {
  eveningActive,
  loadEveningPref,
  saveEveningPref,
  type EveningPref,
} from "../map/eveningMode";
import { LayerPanel } from "../map/LayerPanel";
import { PresenceList } from "../map/PresenceList";
import { useAuth } from "../lib/AuthContext";
import type { LayerToggles, MapBasemap } from "../map/types";

const INITIAL: LayerToggles = {
  canal: true,
  spots: true,
  zones: false,
  bridges: false,
  rules: false,
  catches: false,
  parking: false,
};

const BASEMAP_STORAGE_KEY = "kanalhugget.basemap.v1";

function loadBasemap(): MapBasemap {
  try {
    const raw = localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (raw === "street" || raw === "satellite" || raw === "hybrid") return raw;
  } catch {
    /* ignore */
  }
  return "satellite";
}

function saveBasemap(next: MapBasemap) {
  try {
    localStorage.setItem(BASEMAP_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function MapPage() {
  const auth = useAuth();
  const [toggles, setToggles] = useState<LayerToggles>(INITIAL);
  const [basemap, setBasemap] = useState<MapBasemap>(() => loadBasemap());
  const [eveningPref, setEveningPref] = useState<EveningPref>(() =>
    loadEveningPref(),
  );
  const [nowTick, setNowTick] = useState(0);
  const [layersOpen, setLayersOpen] = useState(false);
  const [uteOpen, setUteOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const evening = eveningActive(eveningPref);

  useEffect(() => {
    if (eveningPref !== "auto") return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [eveningPref]);
  void nowTick;

  function toggle(key: keyof LayerToggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function chooseBasemap(next: MapBasemap) {
    setBasemap(next);
    saveBasemap(next);
  }

  function toggleEvening() {
    const next: EveningPref = evening ? "off" : "on";
    setEveningPref(next);
    saveEveningPref(next);
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
    <div
      className={`app map-app${auth.isAdmin ? " is-admin" : ""}${evening ? " evening" : ""}`}
    >
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
        <LayerPanel
          basemap={basemap}
          onBasemap={chooseBasemap}
          evening={evening}
          eveningAuto={eveningPref === "auto"}
          onToggleEvening={toggleEvening}
          toggles={toggles}
          onToggle={toggle}
          onClose={() => setLayersOpen(false)}
        />
      )}

      <CanalMap
        toggles={toggles}
        adminOpen={adminOpen}
        basemap={basemap}
        evening={evening}
        onToggleParking={() => toggle("parking")}
      />
    </div>
  );
}
