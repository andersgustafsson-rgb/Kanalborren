import { useEffect, useMemo, useState } from "react";
import {
  fmtSunClock,
  isMalmoDarkHours,
  isMalmoGoldenHour,
  malmoSunTimes,
} from "../lib/solarMalmo";
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

type WaterTrend = "rising" | "falling" | "stable" | "unknown";

type FishingScore = {
  score: number;
  label: string;
  why: string;
};

type Conditions = {
  waterCm: number | null;
  waterTrend: WaterTrend;
  /** cm change over ~last 3 hours (latest − ~3h ago). */
  waterDelta3hCm: number | null;
  waterTempC: number | null;
  waterStation: string;
  tempC: number | null;
  feelsLikeC: number | null;
  windMs: number | null;
  gustMs: number | null;
  windDir: number | null;
  precipMm: number | null;
  pressureHpa: number | null;
  pressureTrend: "rising" | "falling" | "stable" | "unknown";
  /** hPa change over ~last 6 hours (latest − ~6h ago). */
  pressureDelta6h: number | null;
  /**
   * Rough inverted barometer effect on water level from pressure change:
   * ≈ −1 cm per +1 hPa over the same window.
   */
  pressureWaterImpactCm: number | null;
  sky: SkyKind;
  skyLabel: string;
  photo: string;
  fishing: FishingScore;
  time: string | null;
  error: string | null;
};

const LEVEL_MIN_CM = -50;
const LEVEL_MAX_CM = 100;

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

/** SMHI Wsymb2 / SNOW symbol_code (1–27). */
function skyFromSmhiSymbol(
  code: number,
  windMs: number | null,
): {
  sky: SkyKind;
  skyLabel: string;
} {
  if (code === 1) return { sky: "sun", skyLabel: "Klart" };
  if (code === 2) return { sky: "sun", skyLabel: "Nästan klart" };
  if (code === 3 || code === 4) return { sky: "partly", skyLabel: "Växlande" };
  if (code === 5) return { sky: "cloud", skyLabel: "Molnigt" };
  if (code === 6) return { sky: "cloud", skyLabel: "Mulet" };
  if (code === 7) return { sky: "fog", skyLabel: "Dimma" };
  if (code === 8) return { sky: "drizzle", skyLabel: "Lätta regnskurar" };
  if (code === 9) return { sky: "rain", skyLabel: "Regnskurar" };
  if (code === 10) return { sky: "rain", skyLabel: "Kraftiga skurar" };
  if (code === 11) return { sky: "thunder", skyLabel: "Åska" };
  if (code === 12 || code === 13 || code === 14)
    return { sky: "rain", skyLabel: "Snöblandat regn" };
  if (code === 15) return { sky: "snow", skyLabel: "Snöbyar" };
  if (code === 18) return { sky: "rain", skyLabel: "Regn" };
  if (code === 19) return { sky: "rain", skyLabel: "Måttligt regn" };
  if (code === 20) return { sky: "rain", skyLabel: "Kraftigt regn" };
  if (code === 21) return { sky: "thunder", skyLabel: "Åska" };
  if (code === 22 || code === 23 || code === 24)
    return { sky: "snow", skyLabel: "Snöblandat regn" };
  if (code === 25 || code === 26 || code === 27)
    return { sky: "snow", skyLabel: "Snö" };
  if (code === 16 || code === 17) return { sky: "snow", skyLabel: "Snö" };
  if (windMs != null && windMs >= 8) return { sky: "wind", skyLabel: "Blåsigt" };
  return { sky: "cloud", skyLabel: "Mulet" };
}

function feelsLikeC(tempC: number | null, windMs: number | null): number | null {
  if (tempC == null || !Number.isFinite(tempC)) return null;
  if (windMs == null || windMs < 1.3 || tempC > 10) return Math.round(tempC);
  const vKmh = windMs * 3.6;
  const chill =
    13.12 +
    0.6215 * tempC -
    11.37 * vKmh ** 0.16 +
    0.3965 * tempC * vKmh ** 0.16;
  return Math.round(chill);
}

function finiteOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n !== 9999 ? n : null;
}

function parseSmhiNumber(raw: number | string): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function smhiSeries(json: {
  value?: { value: number | string; date: number | string }[];
}): { value: number; time: string | null }[] {
  if (!json.value?.length) return [];
  return json.value
    .map((row) => {
      const value = parseSmhiNumber(row.value);
      if (value == null) return null;
      const time =
        row.date == null
          ? null
          : typeof row.date === "number"
            ? new Date(row.date).toISOString()
            : String(row.date);
      return { value, time };
    })
    .filter((row): row is { value: number; time: string | null } => row != null);
}

function trendFromSeries(
  values: number[],
  threshold = 1,
): WaterTrend | "rising" | "falling" | "stable" | "unknown" {
  if (values.length < 2) return "unknown";
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  if (Math.abs(delta) < threshold) return "stable";
  return delta > 0 ? "rising" : "falling";
}

function weatherPhoto(sky: SkyKind, at = new Date()): string {
  const precip =
    sky === "drizzle" ||
    sky === "rain" ||
    sky === "thunder" ||
    sky === "snow";

  if (
    (sky === "sun" || sky === "partly") &&
    isMalmoGoldenHour(at)
  ) {
    return "/weather/solnedgang.jpg";
  }

  if (isMalmoDarkHours(at) && !precip) {
    return "/weather/skymning.jpg";
  }

  switch (sky) {
    case "sun":
    case "partly":
      return "/weather/soligt.jpg";
    case "snow":
      return "/weather/sno.jpg";
    case "drizzle":
    case "rain":
    case "thunder":
      return "/weather/regn.jpg";
    case "cloud":
    case "fog":
    case "wind":
    default:
      return "/weather/mulet.jpg";
  }
}

function levelMeterPct(cm: number | null): number {
  if (cm == null || !Number.isFinite(cm)) return 0;
  const pct =
    ((cm - LEVEL_MIN_CM) / (LEVEL_MAX_CM - LEVEL_MIN_CM)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function deltaAround3h(
  series: { value: number; time: string | null }[],
): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const lastMs = last.time ? Date.parse(last.time) : NaN;
  if (!Number.isFinite(lastMs)) {
    return last.value - series[0].value;
  }
  const target = lastMs - 3 * 60 * 60 * 1000;
  let best = series[0];
  let bestDelta = Math.abs((best.time ? Date.parse(best.time) : 0) - target);
  for (const row of series) {
    if (!row.time) continue;
    const t = Date.parse(row.time);
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - target);
    if (d < bestDelta) {
      best = row;
      bestDelta = d;
    }
  }
  // Need a point that is at least ~90 min back to call it a 3h change.
  if (!best.time || lastMs - Date.parse(best.time) < 90 * 60 * 1000) {
    return null;
  }
  return last.value - best.value;
}

function fishingScore(input: {
  windMs: number | null;
  waterTempC: number | null;
  precipMm: number | null;
  sky: SkyKind;
  pressureTrend: Conditions["pressureTrend"];
  waterTrend: WaterTrend;
}): FishingScore {
  let score = 6;
  const reasons: string[] = [];

  if (input.windMs != null) {
    if (input.windMs >= 2 && input.windMs <= 7) {
      score += 2;
      reasons.push("lagom vind");
    } else if (input.windMs > 7 && input.windMs < 11) {
      reasons.push("lite blåsigt");
    } else if (input.windMs >= 11) {
      score -= 2;
      reasons.push("hård vind");
    } else if (input.windMs < 1) {
      score -= 1;
      reasons.push("stiltje");
    }
  }

  if (input.waterTempC != null) {
    if (input.waterTempC >= 8 && input.waterTempC <= 18) {
      score += 2;
      reasons.push("bra vattentemp");
    } else if (input.waterTempC >= 5 && input.waterTempC < 8) {
      score += 1;
      reasons.push("sval vattentemp");
    } else if (input.waterTempC > 18 && input.waterTempC <= 22) {
      reasons.push("varmt vatten");
    } else {
      score -= 1;
      reasons.push("ogynnsam vattentemp");
    }
  }

  if (input.precipMm != null && input.precipMm > 0.5) {
    score -= 1;
    reasons.push("nederbörd");
  }
  if (input.sky === "thunder") {
    score -= 2;
    reasons.push("åska");
  } else if (input.sky === "rain" || input.sky === "drizzle") {
    score -= 1;
    if (!reasons.includes("nederbörd")) reasons.push("regn");
  }

  // Angler rule of thumb: falling pressure + rising water often wakes fish up.
  if (input.pressureTrend === "falling") {
    score += 1;
    reasons.push("sjunkande lufttryck");
  } else if (input.pressureTrend === "rising") {
    score -= 1;
    reasons.push("stigande lufttryck");
  }

  if (input.waterTrend === "rising") {
    score += 1;
    reasons.push("stigande vattennivå");
  } else if (input.waterTrend === "falling") {
    reasons.push("sjunkande vattennivå");
  }

  score = Math.max(1, Math.min(10, Math.round(score)));

  let label = "Okej";
  if (score <= 3) label = "Svårt";
  else if (score <= 5) label = "Okej";
  else if (score <= 7) label = "Intressanta förhållanden";
  else label = "Lovande";

  const why =
    reasons.length > 0
      ? reasons.slice(0, 4).join(" · ")
      : "baserat på vind, vatten och tryck";

  return { score, label, why };
}

function deltaAroundHours(
  series: { value: number; time: string | null }[],
  hours: number,
): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const lastMs = last.time ? Date.parse(last.time) : NaN;
  if (!Number.isFinite(lastMs)) {
    return last.value - series[0].value;
  }
  const target = lastMs - hours * 60 * 60 * 1000;
  let best = series[0];
  let bestDelta = Math.abs((best.time ? Date.parse(best.time) : 0) - target);
  for (const row of series) {
    if (!row.time) continue;
    const t = Date.parse(row.time);
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - target);
    if (d < bestDelta) {
      best = row;
      bestDelta = d;
    }
  }
  const minBackMs = Math.max(90, hours * 60 * 0.45) * 60 * 1000;
  if (!best.time || lastMs - Date.parse(best.time) < minBackMs) {
    return null;
  }
  return last.value - best.value;
}

async function fetchCanalConditions(): Promise<Conditions> {
  const empty: Conditions = {
    waterCm: null,
    waterTrend: "unknown",
    waterDelta3hCm: null,
    waterTempC: null,
    waterStation: "Malmö Hamn",
    tempC: null,
    feelsLikeC: null,
    windMs: null,
    gustMs: null,
    windDir: null,
    precipMm: null,
    pressureHpa: null,
    pressureTrend: "unknown",
    pressureDelta6h: null,
    pressureWaterImpactCm: null,
    sky: "cloud",
    skyLabel: "–",
    photo: "/weather/mulet.jpg",
    fishing: { score: 5, label: "Okej", why: "baserat på vind, vatten och tryck" },
    time: null,
    error: null,
  };

  try {
    const levelUrl =
      "https://opendata-download-ocobs.smhi.se/api/version/1.0/parameter/6/station/35152/period/latest-day/data.json";
    const waterTempUrl =
      "https://opendata-download-ocobs.smhi.se/api/version/1.0/parameter/5/station/35152/period/latest-day/data.json";
    // Same SMHI forecast product as smhi.se (SNOW1g — replaced old pmp3g).
    const meteoUrl =
      "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/12.995000/lat/55.605000/data.json?timeseries=4&parameters=air_temperature,wind_speed,wind_from_direction,wind_speed_of_gust,precipitation_amount_mean,air_pressure_at_mean_sea_level,symbol_code";

    const [levelRes, waterTempRes, meteoRes] = await Promise.all([
      fetch(levelUrl),
      fetch(waterTempUrl),
      fetch(meteoUrl),
    ]);
    if (!levelRes.ok && !waterTempRes.ok && !meteoRes.ok) {
      throw new Error("Kunde inte hämta väder");
    }

    const level = levelRes.ok ? await levelRes.json() : null;
    const waterTemp = waterTempRes.ok ? await waterTempRes.json() : null;
    const meteo = meteoRes.ok
      ? ((await meteoRes.json()) as {
          timeSeries?: {
            time?: string;
            data?: {
              air_temperature?: number;
              wind_speed?: number;
              wind_from_direction?: number;
              wind_speed_of_gust?: number;
              precipitation_amount_mean?: number;
              air_pressure_at_mean_sea_level?: number;
              symbol_code?: number;
            };
          }[];
        })
      : null;

    const levelSeries = level ? smhiSeries(level) : [];
    const waterTempSeries = waterTemp ? smhiSeries(waterTemp) : [];
    const lastLevel = levelSeries[levelSeries.length - 1] ?? null;
    const lastWaterTemp = waterTempSeries[waterTempSeries.length - 1] ?? null;
    const waterDelta3hCm = deltaAround3h(levelSeries);
    const waterTrend: WaterTrend =
      waterDelta3hCm == null
        ? "unknown"
        : Math.abs(waterDelta3hCm) < 1.5
          ? "stable"
          : waterDelta3hCm > 0
            ? "rising"
            : "falling";

    const series = meteo?.timeSeries ?? [];
    const nowMs = Date.now();
    // SMHI hours are valid FROM that timestamp. Prefer latest hour that has
    // already started (not the absolute closest, which jumps to the next hour
    // after xx:30).
    const started = series.filter((row) => {
      if (!row.time) return false;
      const t = Date.parse(row.time);
      return Number.isFinite(t) && t <= nowMs + 60_000;
    });
    const current =
      (started.length
        ? started.reduce<(typeof series)[number] | null>((best, row) => {
            if (!best?.time) return row;
            return Date.parse(row.time!) > Date.parse(best.time)
              ? row
              : best;
          }, null)
        : series.reduce<(typeof series)[number] | null>((best, row) => {
            if (!row.time) return best;
            if (!best?.time) return row;
            return Date.parse(row.time) < Date.parse(best.time) ? row : best;
          }, null)) ??
      series[0] ??
      null;
    const d = current?.data;
    const windMs = finiteOrNull(d?.wind_speed);
    const code = finiteOrNull(d?.symbol_code) ?? 6;
    let { sky, skyLabel } = skyFromSmhiSymbol(code, windMs);
    if (windMs != null && windMs >= 10 && (sky === "sun" || sky === "partly")) {
      sky = "wind";
      skyLabel = "Blåsigt";
    }

    const pressureSeries = (started.length ? started : series)
      .map((row) => {
        const value = finiteOrNull(row.data?.air_pressure_at_mean_sea_level);
        if (value == null) return null;
        return { value, time: row.time ?? null };
      })
      .filter((row): row is { value: number; time: string | null } => row != null)
      .sort((a, b) => {
        const ta = a.time ? Date.parse(a.time) : 0;
        const tb = b.time ? Date.parse(b.time) : 0;
        return ta - tb;
      });
    const pressures = pressureSeries.map((row) => row.value);
    const pressureTrend = trendFromSeries(
      pressures,
      0.4,
    ) as Conditions["pressureTrend"];
    const pressureDelta6h = deltaAroundHours(pressureSeries, 6);
    const pressureWaterImpactCm =
      pressureDelta6h != null && Number.isFinite(pressureDelta6h)
        ? -pressureDelta6h
        : null;

    const waterTempC = lastWaterTemp?.value ?? null;
    const precipMm = finiteOrNull(d?.precipitation_amount_mean);
    const tempC = finiteOrNull(d?.air_temperature);
    const fishing = fishingScore({
      windMs,
      waterTempC,
      precipMm,
      sky,
      pressureTrend,
      waterTrend,
    });

    const stamp = current?.time ? new Date(current.time) : new Date();
    return {
      waterCm: lastLevel?.value ?? null,
      waterTrend,
      waterDelta3hCm,
      waterTempC,
      waterStation: "Malmö Hamn",
      tempC,
      feelsLikeC: feelsLikeC(tempC, windMs),
      windMs,
      gustMs: finiteOrNull(d?.wind_speed_of_gust),
      windDir: finiteOrNull(d?.wind_from_direction),
      precipMm,
      pressureHpa: finiteOrNull(d?.air_pressure_at_mean_sea_level),
      pressureTrend,
      pressureDelta6h,
      pressureWaterImpactCm,
      sky,
      skyLabel,
      photo: weatherPhoto(sky, stamp),
      fishing,
      time: current?.time
        ? new Date(current.time).toISOString()
        : lastLevel?.time || lastWaterTemp?.time || null,
      error: null,
    };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "Fel",
    };
  }
}

function fmtClock(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function waterChangeLabel(deltaCm: number | null, trend: WaterTrend): string {
  if (deltaCm == null || !Number.isFinite(deltaCm)) {
    if (trend === "rising") return "Stigande";
    if (trend === "falling") return "Sjunkande";
    if (trend === "stable") return "Stabilt";
    return "–";
  }
  if (Math.abs(deltaCm) < 0.5) return "Oförändrat / 3 h";
  if (deltaCm > 0) return `Stigit ${deltaCm.toFixed(1)} cm / 3 h`;
  return `Sjunkit ${Math.abs(deltaCm).toFixed(1)} cm / 3 h`;
}

function pressureTrendLabel(trend: Conditions["pressureTrend"]): string {
  if (trend === "rising") return "Stigande";
  if (trend === "falling") return "Sjunkande";
  if (trend === "stable") return "Stabilt";
  return "–";
}

function pressureDeltaLabel(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return "–";
  if (Math.abs(delta) < 0.2) return "±0 hPa / 6 h";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)} hPa / 6 h`;
}

function pressureImpactLabel(cm: number | null): string {
  if (cm == null || !Number.isFinite(cm)) return "–";
  if (Math.abs(cm) < 0.5) return "≈ 0 cm";
  const sign = cm > 0 ? "+" : "";
  return `≈ ${sign}${cm.toFixed(0)} cm`;
}

function fishingTone(score: number): "low" | "mid" | "good" | "high" {
  if (score <= 3) return "low";
  if (score <= 5) return "mid";
  if (score <= 7) return "good";
  return "high";
}

const WX_ICONS = {
  wind: "/icons/weather/wind.svg",
  precip: "/icons/weather/precipitation.svg",
  waterTemp: "/icons/weather/water-temperature.svg",
  waterLevel: "/icons/weather/water-level.svg",
  airPressure: "/icons/weather/air-pressure.svg",
  trend: "/icons/weather/trend.svg",
  waterImpact: "/icons/weather/water-level-impact.svg",
} as const;

function WxIcon({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <img
      className={className ?? "wx-icon"}
      src={src}
      alt=""
      aria-hidden
      width={18}
      height={18}
      decoding="async"
    />
  );
}

function WindCompass({ deg }: { deg: number | null }) {
  // Meteorological wind_from_direction: arrow points where the wind comes from.
  const rotation = deg != null && Number.isFinite(deg) ? deg : 0;
  const ready = deg != null && Number.isFinite(deg);
  return (
    <span
      className={`wx-compass${ready ? "" : " wx-compass-empty"}`}
      aria-hidden
      title={ready ? `Vind från ${Math.round(deg)}°` : undefined}
    >
      <svg
        className="wx-compass-arrow"
        viewBox="0 0 24 24"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <path
          d="M12 3.2 16.2 12.5H13.1V20.8H10.9V12.5H7.8L12 3.2Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function WaterLevelWidget() {
  const [data, setData] = useState<Conditions | null>(null);
  const sunToday = useMemo(() => {
    const sun = malmoSunTimes();
    return {
      rise: fmtSunClock(sun.sunrise),
      set: fmtSunClock(sun.sunset),
    };
  }, []);

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
      <header className="wx-head">
        <h2>Väder & vatten</h2>
        <span className="wx-place">Malmö</span>
      </header>

      {!data && <p className="water-muted">Hämtar…</p>}
      {data?.error && <p className="water-muted">{data.error}</p>}

      {data && !data.error && (
        <>
          <div className="wx-hero">
            <img
              className="wx-hero-photo"
              src={data.photo}
              alt=""
              loading="lazy"
            />
            <div className="wx-hero-fade" aria-hidden />
            <p className="wx-sun-row" aria-label="Solens uppgång och nedgång">
              <span className="wx-sun-chip">
                Sol ↑ <strong>{sunToday.rise}</strong>
              </span>
              <span className="wx-sun-chip">
                Sol ↓ <strong>{sunToday.set}</strong>
              </span>
            </p>
            <div className="wx-hero-copy">
              <p className="wx-temp">
                {data.tempC != null ? `${data.tempC.toFixed(1)}°` : "–"}
              </p>
              <p className="wx-sky">{data.skyLabel}</p>
              <p className="wx-feels">
                {data.feelsLikeC != null
                  ? `Känns som ${data.feelsLikeC.toFixed(0)}° · Lufttemperatur`
                  : "Lufttemperatur"}
              </p>
            </div>
          </div>

          <ul className="wx-tiles">
            <li className="wx-tile">
              <span className="wx-tile-label">
                <WxIcon src={WX_ICONS.wind} />
                Vind
                <WindCompass deg={data.windDir} />
              </span>
              <strong>
                {data.windMs != null ? `${data.windMs.toFixed(1)} m/s` : "–"}
              </strong>
              <small>
                {compass(data.windDir)} · {windLabel(data.windMs)}
                {data.gustMs != null ? (
                  <span className="wx-gust"> · by {data.gustMs.toFixed(1)}</span>
                ) : null}
              </small>
            </li>
            <li className="wx-tile">
              <span className="wx-tile-label">
                <WxIcon src={WX_ICONS.precip} />
                Nederbörd
              </span>
              <strong>
                {data.precipMm != null
                  ? `${data.precipMm.toFixed(1)} mm`
                  : "–"}
              </strong>
              <small>Just nu</small>
            </li>
            <li className="wx-tile wx-tile-water">
              <span className="wx-tile-label">
                <WxIcon src={WX_ICONS.waterTemp} />
                Vattentemp
              </span>
              <strong>
                {data.waterTempC != null
                  ? `${data.waterTempC.toFixed(1)} °C`
                  : "–"}
              </strong>
              <small>{data.waterStation}</small>
            </li>
          </ul>

          <div className="wx-level">
            <div className="wx-level-top">
              <span className="wx-tile-label">
                <WxIcon src={WX_ICONS.waterLevel} />
                Vattenstånd · {data.waterStation}
              </span>
              <strong>
                {data.waterCm != null
                  ? `${data.waterCm > 0 ? "+" : ""}${data.waterCm.toFixed(1)} cm`
                  : "–"}
              </strong>
            </div>
            <div
              className="wx-level-track"
              role="meter"
              aria-valuemin={LEVEL_MIN_CM}
              aria-valuemax={LEVEL_MAX_CM}
              aria-valuenow={data.waterCm ?? undefined}
              aria-label="Vattenstånd Öresund"
            >
              <span
                className="wx-level-fill"
                style={{ width: `${levelMeterPct(data.waterCm)}%` }}
              />
            </div>
            <div className="wx-level-meta">
              <small>Öresund · RH2000</small>
              <small className={`wx-trend wx-trend-${data.waterTrend}`}>
                {waterChangeLabel(data.waterDelta3hCm, data.waterTrend)}
              </small>
            </div>
          </div>

          <div className="wx-pressure" aria-label="Lufttryck">
            <div className="wx-pressure-grid">
              <div className="wx-pressure-cell">
                <span className="wx-tile-label">
                  <WxIcon src={WX_ICONS.airPressure} />
                  Lufttryck
                </span>
                <strong>
                  {data.pressureHpa != null
                    ? `${Math.round(data.pressureHpa)} hPa`
                    : "–"}
                </strong>
              </div>
              <div className="wx-pressure-cell">
                <span className="wx-tile-label">
                  <WxIcon src={WX_ICONS.trend} />
                  Trend
                </span>
                <strong
                  className={`wx-pressure-trend wx-pressure-trend-${data.pressureTrend}`}
                >
                  {pressureTrendLabel(data.pressureTrend)}
                </strong>
                <small>{pressureDeltaLabel(data.pressureDelta6h)}</small>
              </div>
              <div className="wx-pressure-cell wx-pressure-impact">
                <span className="wx-tile-label">
                  <WxIcon src={WX_ICONS.waterImpact} />
                  Påverkan på vattennivå
                  <span
                    className="wx-info"
                    title="Tumregel: ≈ 1 cm vattennivå per 1 hPa tryckförändring, inverterat (sjunkande tryck → stigande vatten)."
                  >
                    i
                  </span>
                </span>
                <strong>
                  {pressureImpactLabel(data.pressureWaterImpactCm)}
                </strong>
                <small>i förhållande till tidigare tryck</small>
              </div>
            </div>
          </div>

          <div
            className={`wx-fishing wx-fishing-${fishingTone(data.fishing.score)}`}
            aria-label="Fiskeförhållanden"
          >
            <div className="wx-fishing-top">
              <span className="wx-tile-label">Fiskeförhållanden</span>
              <strong className="wx-fishing-num">
                {data.fishing.score}/10
              </strong>
            </div>
            <div
              className="wx-fishing-track"
              role="meter"
              aria-valuemin={1}
              aria-valuemax={10}
              aria-valuenow={data.fishing.score}
              aria-label="Fiskebetyg"
            >
              <span
                className="wx-fishing-fill"
                style={{ width: `${(data.fishing.score / 10) * 100}%` }}
              />
            </div>
            <p className="wx-fishing-score">
              <span>{data.fishing.label}</span>
            </p>
            <p className="wx-fishing-why">
              Därför: {data.fishing.why}
            </p>
          </div>

          <div className="conditions-actions">
            <a
              className="conditions-smhi"
              href="https://www.smhi.se/vader/prognoser-och-varningar/vaderprognos/q/Malm%C3%B6/Malm%C3%B6/2692969"
              target="_blank"
              rel="noreferrer"
            >
              Vädret nu · SMHI Malmö
            </a>
            {data.time && (
              <p className="water-muted conditions-time">
                Gäller {fmtClock(data.time)}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
