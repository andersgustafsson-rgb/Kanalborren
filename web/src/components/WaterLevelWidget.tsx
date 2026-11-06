import { useEffect, useState } from "react";
import "./WaterLevelWidget.css";

type SkyKind =
  | "sun"
  | "partly"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder"
  | "wind";

type Conditions = {
  waterCm: number | null;
  waterStation: string;
  tempC: number | null;
  windMs: number | null;
  gustMs: number | null;
  windDir: number | null;
  precipMm: number | null;
  sky: SkyKind;
  skyLabel: string;
  time: string | null;
  error: string | null;
};

function compass(deg: number | null): string {
  if (deg == null || !Number.isFinite(deg)) return "–";
  const dirs = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[i];
}

function windLabel(ms: number | null): string {
  if (ms == null) return "–";
  if (ms < 0.5) return "stiltje";
  if (ms < 3.5) return "svag";
  if (ms < 8) return "måttlig";
  if (ms < 14) return "frisk";
  return "hård";
}

function skyFromCode(code: number, windMs: number | null): {
  sky: SkyKind;
  skyLabel: string;
} {
  if (code === 0) return { sky: "sun", skyLabel: "Klart" };
  if (code === 1 || code === 2) return { sky: "partly", skyLabel: "Växlande" };
  if (code === 3) return { sky: "cloud", skyLabel: "Mulet" };
  if (code === 45 || code === 48) return { sky: "fog", skyLabel: "Dimma" };
  if (code >= 51 && code <= 57) return { sky: "drizzle", skyLabel: "Duggregn" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { sky: "rain", skyLabel: "Regn" };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return { sky: "snow", skyLabel: "Snö" };
  if (code >= 95) return { sky: "thunder", skyLabel: "Åska" };
  if (windMs != null && windMs >= 8) return { sky: "wind", skyLabel: "Blåsigt" };
  return { sky: "cloud", skyLabel: "Mulet" };
}

function lastValue(json: {
  value?: { value: number | string; date: number | string }[];
}): { value: number | null; time: string | null } {
  const last = json.value?.[json.value.length - 1];
  if (!last) return { value: null, time: null };
  const n = typeof last.value === "number" ? last.value : Number(last.value);
  const time =
    last.date == null
      ? null
      : typeof last.date === "number"
        ? new Date(last.date).toISOString()
        : String(last.date);
  return {
    value: Number.isFinite(n) ? n : null,
    time,
  };
}

const SKY_EMOJI: Record<SkyKind, string> = {
  sun: "☀️",
  partly: "⛅",
  cloud: "☁️",
  fog: "🌫️",
  drizzle: "🌦️",
  rain: "🌧️",
  snow: "🌨️",
  thunder: "⛈️",
  wind: "💨",
};

function WeatherIcon({ kind, large = false }: { kind: SkyKind; large?: boolean }) {
  return (
    <span
      className={large ? "wx-emoji wx-emoji-lg" : "wx-emoji"}
      aria-hidden
    >
      {SKY_EMOJI[kind]}
    </span>
  );
}

async function fetchCanalConditions(): Promise<Conditions> {
  try {
    const waterUrl =
      "https://opendata-download-ocobs.smhi.se/api/version/1.0/parameter/6/station/35152/period/latest-day/data.json";
    const meteoUrl =
      "https://api.open-meteo.com/v1/forecast?latitude=55.605&longitude=12.995&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation&wind_speed_unit=ms&timezone=Europe%2FStockholm";

    const [waterRes, meteoRes] = await Promise.all([
      fetch(waterUrl),
      fetch(meteoUrl),
    ]);
    if (!waterRes.ok && !meteoRes.ok) throw new Error("Kunde inte hämta väder");

    const water = waterRes.ok ? await waterRes.json() : null;
    const meteo = meteoRes.ok
      ? ((await meteoRes.json()) as {
          current?: {
            time?: string;
            temperature_2m?: number;
            weather_code?: number;
            wind_speed_10m?: number;
            wind_direction_10m?: number;
            wind_gusts_10m?: number;
            precipitation?: number;
          };
        })
      : null;

    const w = water ? lastValue(water) : { value: null, time: null };
    const c = meteo?.current;
    const windMs = typeof c?.wind_speed_10m === "number" ? c.wind_speed_10m : null;
    const code = typeof c?.weather_code === "number" ? c.weather_code : 3;
    let { sky, skyLabel } = skyFromCode(code, windMs);
    if (windMs != null && windMs >= 10 && sky === "sun") {
      sky = "wind";
      skyLabel = "Blåsigt";
    }

    return {
      waterCm: w.value,
      waterStation: "Malmö Hamn",
      tempC: typeof c?.temperature_2m === "number" ? c.temperature_2m : null,
      windMs,
      gustMs: typeof c?.wind_gusts_10m === "number" ? c.wind_gusts_10m : null,
      windDir:
        typeof c?.wind_direction_10m === "number" ? c.wind_direction_10m : null,
      precipMm: typeof c?.precipitation === "number" ? c.precipitation : null,
      sky,
      skyLabel,
      time: c?.time ? new Date(c.time).toISOString() : w.time,
      error: null,
    };
  } catch (e) {
    return {
      waterCm: null,
      waterStation: "Malmö Hamn",
      tempC: null,
      windMs: null,
      gustMs: null,
      windDir: null,
      precipMm: null,
      sky: "cloud",
      skyLabel: "–",
      time: null,
      error: e instanceof Error ? e.message : "Fel",
    };
  }
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function WaterLevelWidget() {
  const [data, setData] = useState<Conditions | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCanalConditions().then((r) => {
      if (!cancelled) setData(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="home-board water-widget" aria-label="Väder och vatten">
      <header className="home-board-head conditions-head">
        <div>
          <h2>Väder & vatten</h2>
          <p>Malmö kanal · vattenstånd via Öresund (SMHI)</p>
        </div>
        {data && !data.error && (
          <div className="conditions-sky" title={data.skyLabel}>
            <WeatherIcon kind={data.sky} large />
            <span>{data.skyLabel}</span>
          </div>
        )}
      </header>
      {!data && <p className="water-muted">Hämtar…</p>}
      {data?.error && <p className="water-muted">{data.error}</p>}
      {data && !data.error && (
        <>
          <ul className="conditions-grid">
            <li>
              <span className="conditions-label">
                <WeatherIcon kind={data.sky} />
                Luft
              </span>
              <strong>
                {data.tempC != null ? `${data.tempC.toFixed(1)} °C` : "–"}
              </strong>
              <small>{data.skyLabel}</small>
            </li>
            <li>
              <span className="conditions-label">
                <WeatherIcon kind="wind" />
                Vind
              </span>
              <strong>
                {data.windMs != null ? `${data.windMs.toFixed(1)} m/s` : "–"}
              </strong>
              <small>
                {compass(data.windDir)} · {windLabel(data.windMs)}
                {data.gustMs != null ? ` · by ${data.gustMs.toFixed(1)}` : ""}
              </small>
            </li>
            <li>
              <span className="conditions-label">
                <WeatherIcon
                  kind={
                    data.sky === "rain" ||
                    data.sky === "drizzle" ||
                    data.sky === "thunder"
                      ? data.sky
                      : data.precipMm && data.precipMm > 0
                        ? "rain"
                        : "cloud"
                  }
                />
                Nederbörd
              </span>
              <strong>
                {data.precipMm != null ? `${data.precipMm.toFixed(1)} mm` : "–"}
              </strong>
              <small>just nu</small>
            </li>
            <li>
              <span className="conditions-label">Vattenstånd</span>
              <strong>
                {data.waterCm != null ? `${data.waterCm.toFixed(1)} cm` : "–"}
              </strong>
              <small>{data.waterStation}</small>
            </li>
          </ul>
          {data.time && (
            <p className="water-muted conditions-time">
              Uppdaterad {fmtTime(data.time)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
