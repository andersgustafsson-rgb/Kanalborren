import type { ReactElement, ReactNode } from "react";
import type { LayerToggles, MapBasemap } from "./types";
import "./LayerPanel.css";

type Props = {
  basemap: MapBasemap;
  onBasemap: (next: MapBasemap) => void;
  evening: boolean;
  eveningAuto: boolean;
  onToggleEvening: () => void;
  toggles: LayerToggles;
  onToggle: (key: keyof LayerToggles) => void;
  onClose: () => void;
};

type Icon = () => ReactElement;

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="lp-icon" viewBox="0 0 24 24" aria-hidden>
      {children}
    </svg>
  );
}

const IconLayers: Icon = () => (
  <Svg>
    <path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" />
    <path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5" />
  </Svg>
);

const IconMap: Icon = () => (
  <Svg>
    <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20V6.5Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Svg>
);

const IconImage: Icon = () => (
  <Svg>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
  </Svg>
);

const IconMoon: Icon = () => (
  <Svg>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
  </Svg>
);

const IconFish: Icon = () => (
  <Svg>
    <path d="M7 12c2.4-3 5.2-4.4 8.4-4.4 2 0 3.8.7 5.3 2L22 12l-1.3 2.4c-1.5 1.3-3.3 2-5.3 2-3.2 0-6-1.4-8.4-4.4Z" />
    <path d="M7 12 2.5 8.2v7.6L7 12Z" />
    <circle cx="17.3" cy="11.4" r="0.9" className="lp-fill" />
  </Svg>
);

const IconPin: Icon = () => (
  <Svg>
    <path d="M12 21s6-5.2 6-10.2A6 6 0 0 0 6 10.8C6 15.8 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2.2" />
  </Svg>
);

const IconZone: Icon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2.5" strokeDasharray="3 2.2" />
    <path d="M7 12c1.6-1.8 3.5-2.7 5.7-2.7 1.4 0 2.6.4 3.6 1.2L17.5 12l-1.2 1.5c-1 .8-2.2 1.2-3.6 1.2-2.2 0-4.1-.9-5.7-2.7Z" />
  </Svg>
);

const IconParking: Icon = () => (
  <Svg>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M9.5 16.5v-9h3.2a2.7 2.7 0 0 1 0 5.4H9.5" />
  </Svg>
);

const IconBars: Icon = () => (
  <Svg>
    <path d="M5 19v-4M10 19v-8M15 19V8M20 19V5" />
  </Svg>
);

const IconBridge: Icon = () => (
  <Svg>
    <path d="M2.5 15h19M2.5 15c3-5 6-7 9.5-7s6.5 2 9.5 7M6 15v4M18 15v4M9 10.5V15M15 10.5V15M12 8v7" />
  </Svg>
);

const IconRules: Icon = () => (
  <Svg>
    <path d="M7 3.5h7.5L19 8v12.5H7V3.5Z" />
    <path d="M14.5 3.5V8H19M9.5 12h7M9.5 15h7M9.5 18h4.5" />
  </Svg>
);

const IconClose: Icon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

const BASEMAPS: { id: MapBasemap; label: string; Icon: Icon }[] = [
  { id: "street", label: "Karta", Icon: IconMap },
  { id: "satellite", label: "Satellit", Icon: IconImage },
  { id: "hybrid", label: "Hybrid", Icon: IconLayers },
];

const LAYERS: { key: keyof LayerToggles; label: string; Icon: Icon; tone: string }[] = [
  { key: "canal", label: "Kanal", Icon: IconFish, tone: "cyan" },
  { key: "spots", label: "Platser", Icon: IconPin, tone: "lime" },
  { key: "zones", label: "Zoner", Icon: IconZone, tone: "cyan" },
  { key: "parking", label: "Parkering", Icon: IconParking, tone: "lime" },
  { key: "catches", label: "Fångster (7d)", Icon: IconBars, tone: "lime" },
  { key: "bridges", label: "Broar", Icon: IconBridge, tone: "white" },
  { key: "rules", label: "Regler", Icon: IconRules, tone: "violet" },
];

export function LayerPanel({
  basemap,
  onBasemap,
  evening,
  eveningAuto,
  onToggleEvening,
  toggles,
  onToggle,
  onClose,
}: Props) {
  return (
    <div id="layer-panel" className="lp" role="dialog" aria-label="Kartlager">
      <header className="lp-head">
        <span className="lp-head-icon">
          <IconLayers />
        </span>
        <h2>Lager</h2>
        <button
          type="button"
          className="lp-close"
          aria-label="Stäng lager"
          onClick={onClose}
        >
          <IconClose />
        </button>
      </header>

      <p className="lp-label">
        Vy <span>(kartläge)</span>
      </p>
      <div className="lp-views" role="radiogroup" aria-label="Kartvy">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={basemap === b.id}
            className={basemap === b.id ? "lp-view on" : "lp-view"}
            onClick={() => onBasemap(b.id)}
          >
            <b.Icon />
            <span>{b.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={evening ? "lp-view on lp-view-evening" : "lp-view lp-view-evening"}
          aria-pressed={evening}
          onClick={onToggleEvening}
          title={
            eveningAuto
              ? "Auto efter skymning — tryck för att låsa"
              : evening
                ? "Kvällsläge på"
                : "Kvällsläge av"
          }
        >
          <IconMoon />
          <span>Kväll</span>
        </button>
      </div>

      <p className="lp-label">
        Lager <span>(visa på kartan)</span>
      </p>
      <ul className="lp-layers">
        {LAYERS.map(({ key, label, Icon, tone }) => (
          <li key={key}>
            <button
              type="button"
              role="switch"
              aria-checked={toggles[key]}
              className={toggles[key] ? "lp-layer on" : "lp-layer"}
              onClick={() => onToggle(key)}
            >
              <span className={`lp-layer-icon lp-tone-${tone}`}>
                <Icon />
              </span>
              <span className="lp-layer-label">{label}</span>
              <span className="lp-switch" aria-hidden>
                <span className="lp-switch-knob" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
