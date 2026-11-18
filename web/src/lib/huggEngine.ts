import * as SunCalc from "suncalc";
import { MALMO_LAT, MALMO_LON, malmoSunTimes } from "./solarMalmo";

export type HuggHourInput = {
  time: Date;
  windMs: number | null;
  /** Meteorological wind_from_direction (degrees), when available */
  windDirDeg: number | null;
  precipMm: number | null;
  pressureHpa: number | null;
  /** SMHI symbol_code when available */
  symbolCode: number | null;
};

/** 0 = crystal clear, 10 = very murky (proxy, not measured Secchi). */
export type TurbidityEstimate = {
  index: number;
  label: "klart" | "måttligt" | "grumligt";
  detail: string;
};

export type HuggFactor = {
  id: string;
  label: string;
  /** Contribution to the day read: up / down / neutral */
  tone: "up" | "down" | "neutral";
  detail: string;
};

export type HuggWindow = {
  start: Date;
  end: Date;
  score: number;
  label: string;
};

export type HuggHourPoint = {
  time: Date;
  score: number;
  /** Short reasons for this hour (shown when a chart bar is selected). */
  why: string[];
};

export type HuggForecast = {
  /** Score for the current / nearest hour (1–10). */
  nowScore: number;
  /** Mean of today's better hours (incl. canal night) — used for the headline. */
  dayScore: number;
  label: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  factors: HuggFactor[];
  hours: HuggHourPoint[];
  windows: HuggWindow[];
  why: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function hourScoreLabel(score: number): string {
  if (score <= 3.5) return "Svårt";
  if (score <= 5.5) return "Blandat";
  if (score <= 7) return "Okej fönster";
  return "Starkare fönster";
}

function dayLabel(score: number): string {
  if (score <= 3.5) return "Svårt";
  if (score <= 5.2) return "Blandat";
  if (score <= 6.8) return "Okej med rätt timing";
  return "Lovande fönster";
}

function isCloudy(symbol: number | null): boolean {
  if (symbol == null) return false;
  return symbol >= 5 && symbol <= 7;
}

function isWet(symbol: number | null, precip: number | null): boolean {
  if (precip != null && precip > 0.15) return true;
  if (symbol == null) return false;
  return symbol >= 8 && symbol !== 15; // drizzle/rain/thunder-ish, not pure snow emphasis
}

function isThunder(symbol: number | null): boolean {
  return symbol === 11 || symbol === 21;
}

function lightBoost(at: Date): number {
  const { sunrise, sunset, dawn, dusk } = malmoSunTimes(at);
  const t = at.getTime();
  const near = (center: Date, radiusMin: number) =>
    Math.abs(t - center.getTime()) <= radiusMin * 60_000;

  if (near(dawn, 40) || near(dusk, 40)) return 2.0;
  if (near(sunrise, 75) || near(sunset, 75)) return 1.4;
  // Midday often quieter in canal, especially under building high pressure.
  const hour = at.getHours() + at.getMinutes() / 60;
  if (hour >= 10.5 && hour <= 14.5) return -0.6;
  // Malmö canal night stays productive (street lights) — unlike dark rural water.
  if (t < dawn.getTime() || t > dusk.getTime()) {
    // Prime lit evening into late night; deep early morning a bit softer.
    if (hour >= 18 || hour < 1) return 0.9;
    return 0.55;
  }
  return 0.2;
}

type SolunarKind = "major" | "minor" | null;

type SolunarHit = {
  kind: Exclude<SolunarKind, null>;
  label: string;
  boost: number;
};

const solunarCache = new Map<string, ReturnType<typeof SunCalc.getMoonTimes>>();

function moonTimesForDay(at: Date) {
  const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
  let cached = solunarCache.get(key);
  if (!cached) {
    const noon = new Date(at);
    noon.setHours(12, 0, 0, 0);
    cached = SunCalc.getMoonTimes(noon, MALMO_LAT, MALMO_LON);
    solunarCache.set(key, cached);
  }
  return cached;
}

/**
 * Classic solunar windows from suncalc moon times for Malmö:
 * major ≈ overhead / underfoot transit, minor ≈ moonrise / moonset.
 * Kept modest — useful timing hint, not stronger than pressure/light.
 */
function solunarAt(at: Date): SolunarHit | null {
  const times = moonTimesForDay(at);
  const t = at.getTime();
  const near = (center: Date | undefined, radiusMin: number) =>
    center instanceof Date &&
    Number.isFinite(center.getTime()) &&
    Math.abs(t - center.getTime()) <= radiusMin * 60_000;

  if (near(times.transit, 55)) {
    return { kind: "major", label: "Solunar major (månen i zenit)", boost: 0.85 };
  }
  if (near(times.lowerTransit, 55)) {
    return {
      kind: "major",
      label: "Solunar major (månen under foten)",
      boost: 0.85,
    };
  }
  if (near(times.rise, 40)) {
    return { kind: "minor", label: "Solunar minor (månoppgång)", boost: 0.4 };
  }
  if (near(times.set, 40)) {
    return { kind: "minor", label: "Solunar minor (månnedgång)", boost: 0.4 };
  }
  return null;
}

function fmtHm(d: Date): string {
  return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function solunarDayWindows(at: Date): string {
  const times = moonTimesForDay(at);
  const parts: string[] = [];
  if (times.transit instanceof Date) parts.push(`major ${fmtHm(times.transit)}`);
  if (times.lowerTransit instanceof Date) {
    parts.push(`major ${fmtHm(times.lowerTransit)}`);
  }
  if (times.rise instanceof Date) parts.push(`minor ${fmtHm(times.rise)}`);
  if (times.set instanceof Date) parts.push(`minor ${fmtHm(times.set)}`);
  return parts.length ? parts.join(" · ") : "inga tydliga fönster";
}

function nearestPressureAt(
  series: HuggHourInput[],
  targetMs: number,
  fromIndex: number,
  toIndex: number,
): { hpa: number; time: Date } | null {
  let best: { hpa: number; time: Date } | null = null;
  let bestDist = Infinity;
  const lo = Math.max(0, fromIndex);
  const hi = Math.min(series.length - 1, toIndex);
  for (let i = lo; i <= hi; i++) {
    const row = series[i];
    if (row?.pressureHpa == null) continue;
    const dist = Math.abs(row.time.getTime() - targetMs);
    if (dist < bestDist) {
      bestDist = dist;
      best = { hpa: row.pressureHpa, time: row.time };
    }
  }
  return best;
}

/**
 * Prefer lookback (what already happened). If the SMHI series has no past
 * hours — common for snow1g point forecasts — fall back to forward delta
 * over the same window so rising/falling high pressure still registers.
 */
function pressureDeltaAt(
  series: HuggHourInput[],
  index: number,
  windowHours: number,
): number | null {
  const cur = series[index];
  if (cur?.pressureHpa == null) return null;

  const backTarget = cur.time.getTime() - windowHours * 3600_000;
  const back = nearestPressureAt(series, backTarget, 0, index - 1);
  if (back) {
    const hoursBack =
      (cur.time.getTime() - back.time.getTime()) / 3600_000;
    if (hoursBack >= windowHours * 0.45) {
      return cur.pressureHpa - back.hpa;
    }
  }

  const fwdTarget = cur.time.getTime() + windowHours * 3600_000;
  const fwd = nearestPressureAt(
    series,
    fwdTarget,
    index + 1,
    series.length - 1,
  );
  if (!fwd) return null;
  const hoursFwd = (fwd.time.getTime() - cur.time.getTime()) / 3600_000;
  if (hoursFwd < windowHours * 0.45) return null;
  return fwd.hpa - cur.pressureHpa;
}

/**
 * Canal turbidity proxy from wind mixing, rain runoff and water-level swing.
 * Not a lab measurement — tuned for Malmö canal fishing heuristics.
 */
function estimateTurbidity(
  series: HuggHourInput[],
  index: number,
  waterAbsDelta3hCm: number | null,
): TurbidityEstimate {
  const cur = series[index];
  if (!cur) {
    return { index: 5, label: "måttligt", detail: "Otillräcklig data för siktproxy" };
  }

  const windowStart = cur.time.getTime() - 12 * 3600_000;
  let windSum = 0;
  let windN = 0;
  let gustyHours = 0;
  let precipSum = 0;
  let westishBoost = 0;

  for (let i = 0; i <= index; i++) {
    const row = series[i];
    if (!row || row.time.getTime() < windowStart) continue;
    if (row.windMs != null) {
      windSum += row.windMs;
      windN += 1;
      if (row.windMs >= 8) gustyHours += 1;
      // W–NW–N sector often drives Öresund/Malmö level & exchange.
      if (
        row.windDirDeg != null &&
        row.windMs >= 5 &&
        ((row.windDirDeg >= 240 && row.windDirDeg <= 360) ||
          row.windDirDeg <= 20)
      ) {
        westishBoost = Math.max(westishBoost, 0.7);
      }
    }
    if (row.precipMm != null && row.precipMm > 0) precipSum += row.precipMm;
  }

  const avgWind = windN ? windSum / windN : 0;
  let turb = 2.2; // neutral-ish canal baseline
  turb += clamp(avgWind * 0.5, 0, 4.2);
  turb += clamp(gustyHours * 0.35, 0, 1.4);
  turb += clamp(precipSum * 1.1, 0, 3.2);
  turb += westishBoost;
  if (waterAbsDelta3hCm != null) {
    // Fast level change ⇒ exchange/current ⇒ more suspended matter.
    turb += clamp(Math.abs(waterAbsDelta3hCm) / 5, 0, 2.2);
  }
  // Settling after calm + dry.
  if (avgWind < 2.2 && precipSum < 0.25) turb -= 1.6;
  if (avgWind < 1.2 && precipSum < 0.1) turb -= 0.8;

  const index10 = clamp(round1(turb), 0, 10);
  let label: TurbidityEstimate["label"] = "måttligt";
  if (index10 <= 3.2) label = "klart";
  else if (index10 >= 6) label = "grumligt";

  const bits: string[] = [];
  if (avgWind >= 6) bits.push(`blåst ~${avgWind.toFixed(1)} m/s`);
  else if (avgWind < 2.2) bits.push("lugnt");
  if (precipSum >= 0.5) bits.push(`regn ${precipSum.toFixed(1)} mm/12h`);
  if (waterAbsDelta3hCm != null && Math.abs(waterAbsDelta3hCm) >= 4) {
    bits.push(`nivå ±${Math.abs(waterAbsDelta3hCm).toFixed(0)} cm`);
  }
  if (westishBoost > 0) bits.push("västlig pålandsvind");
  const detail =
    bits.length > 0
      ? `Siktproxy: ${label} (${bits.join(" · ")})`
      : `Siktproxy: ${label}`;

  return { index: index10, label, detail };
}

function scoreHour(
  row: HuggHourInput,
  pressureDelta6h: number | null,
  waterTempC: number | null,
  waterRising: boolean,
  turbidity: TurbidityEstimate,
): { score: number; why: string[] } {
  // Honest baseline — not "already good".
  let score = 4.0;
  const why: string[] = [];

  // Pressure movement is the heaviest weather lever.
  if (pressureDelta6h != null) {
    const sign = pressureDelta6h > 0 ? "+" : "";
    if (pressureDelta6h <= -6) {
      score += 1.2;
      why.push(`Snabb tryckfall ${pressureDelta6h.toFixed(1)} hPa/6h`);
    } else if (pressureDelta6h <= -3) {
      score += 2.2;
      why.push(`Fallande tryck ${pressureDelta6h.toFixed(1)} hPa/6h — aktiverar`);
    } else if (pressureDelta6h <= -1) {
      score += 1.2;
      why.push(`Lätt fallande tryck ${pressureDelta6h.toFixed(1)} hPa/6h`);
    } else if (pressureDelta6h >= 5) {
      score -= 2.4;
      why.push(`Stark tryckuppgång ${sign}${pressureDelta6h.toFixed(1)} hPa/6h — dämpar`);
    } else if (pressureDelta6h >= 2.5) {
      score -= 1.6;
      why.push(`Stigande tryck ${sign}${pressureDelta6h.toFixed(1)} hPa/6h — dämpar`);
    } else if (pressureDelta6h >= 1) {
      score -= 0.7;
      why.push(`Lätt stigande tryck ${sign}${pressureDelta6h.toFixed(1)} hPa/6h`);
    } else {
      why.push(`Stabilt tryck (${sign}${pressureDelta6h.toFixed(1)} hPa/6h)`);
    }
  }

  if (row.windMs != null) {
    if (row.windMs >= 2 && row.windMs <= 7) {
      score += 0.75;
      why.push(`Lagom vind ${row.windMs.toFixed(1)} m/s`);
    } else if (row.windMs > 7 && row.windMs < 11) {
      score += 0.05;
      why.push(`Lite blåsigt ${row.windMs.toFixed(1)} m/s`);
    } else if (row.windMs >= 11 && row.windMs < 14) {
      score -= 1.2;
      why.push(`Hård vind ${row.windMs.toFixed(1)} m/s`);
    } else if (row.windMs >= 14) {
      score -= 2.2;
      why.push(`Mycket hård vind ${row.windMs.toFixed(1)} m/s`);
    } else if (row.windMs < 1) {
      score -= 0.9;
      why.push("Stiltje — spegelblank yta");
    }
  }

  if (waterTempC != null) {
    if (waterTempC >= 8 && waterTempC <= 16) score += 0.55;
    else if (waterTempC >= 5 && waterTempC < 8) score += 0.2;
    else if (waterTempC < 4) score -= 0.8;
    else if (waterTempC > 18) score -= 0.4;
  }

  const precip = row.precipMm;
  if (isThunder(row.symbolCode)) {
    score -= 2.2;
    why.push("Åska — undvik");
  } else if (precip != null) {
    if (precip > 0.15 && precip <= 1.2) {
      score += 0.45;
      why.push(`Lätt regn ${precip.toFixed(1)} mm`);
    } else if (precip > 1.2 && precip <= 3) {
      score -= 0.4;
      why.push(`Regn ${precip.toFixed(1)} mm`);
    } else if (precip > 3) {
      score -= 1.1;
      why.push(`Kraftigt regn ${precip.toFixed(1)} mm`);
    }
  } else if (isWet(row.symbolCode, null)) {
    score += 0.2;
  }

  if (isCloudy(row.symbolCode)) score += 0.25;
  else if (row.symbolCode === 1 || row.symbolCode === 2) {
    // Bright high-pressure midday is often harder in the canal.
    if (pressureDelta6h != null && pressureDelta6h > 1.5) score -= 0.35;
    // Clear water + bright sun stacks — fish get a better look at the lure.
    if (turbidity.label === "klart") score -= 0.45;
  }

  // Clear water → harder; stirred/murky → often better canal fishing.
  if (turbidity.label === "grumligt") {
    score += 0.85;
    why.push("Grumligt vatten (proxy) — oftast bättre");
  } else if (turbidity.index >= 4.5) {
    score += 0.35;
    why.push("Måttligt grumligt (proxy)");
  } else if (turbidity.label === "klart") {
    score -= 0.95;
    why.push("Klart vatten (proxy) — fisken ser bättre");
  }

  let light = lightBoost(row.time);
  const { dawn, dusk } = malmoSunTimes(row.time);
  const t = row.time.getTime();
  const hour = row.time.getHours() + row.time.getMinutes() / 60;
  if (Math.abs(t - dawn.getTime()) <= 40 * 60_000) why.push("Gryningsfönster");
  else if (Math.abs(t - dusk.getTime()) <= 40 * 60_000) why.push("Skymningsfönster");
  else if (hour >= 10.5 && hour <= 14.5) why.push("Mitt på dagen — oftast lugnare");
  else if (t < dawn.getTime() || t > dusk.getTime()) {
    why.push(
      hour >= 18 || hour < 1
        ? "Natt i kanalen (gatubelysning)"
        : "Tidig natt/morgon i kanalen",
    );
  }

  // Under rising pressure, light edges matter more; midday penalty harder.
  if (pressureDelta6h != null && pressureDelta6h >= 2) {
    if (light > 0) light *= 1.25;
    if (light < 0) light *= 1.35;
  }
  score += light;

  if (waterRising) {
    score += 0.35;
    why.push("Stigande vattenstånd");
  }

  const solunar = solunarAt(row.time);
  if (solunar) {
    score += solunar.boost;
    why.push(solunar.label);
  }

  // Mild phase effect on top of solunar windows.
  const moon = SunCalc.getMoonIllumination(row.time);
  const illum = moon.fraction;
  if (illum < 0.12 || illum > 0.88) score += 0.2;
  else if (illum > 0.4 && illum < 0.6) score -= 0.1;

  // Malmö canal abborre: move in autumn, stay through spring — reverse of
  // "dead winter canal". Summer is often quieter in the canal itself.
  const month = row.time.getMonth();
  if (isCanalAbborrePeak(month)) {
    score += 0.35;
    why.push("Kanalsäsong — abborre inne (höst–vår)");
  } else if (isCanalAbborreShoulder(month)) {
    score += 0.15;
  } else if (isCanalAbborreQuiet(month)) {
    score -= 0.45;
    why.push("Sommar i kanalen — abborre oftast mer ute");
  }

  return { score: clamp(round1(score), 1, 10), why: why.slice(0, 5) };
}

/** Oct–Mar: core canal perch season. */
function isCanalAbborrePeak(month: number): boolean {
  return month === 9 || month === 10 || month === 11 || month <= 2;
}

/** Sep + Apr: fish moving in / starting to leave. */
function isCanalAbborreShoulder(month: number): boolean {
  return month === 8 || month === 3;
}

/** May–Aug: canal often quieter for abborre. */
function isCanalAbborreQuiet(month: number): boolean {
  return month >= 4 && month <= 7;
}

function mergeWindows(hours: HuggHourPoint[]): HuggWindow[] {
  if (!hours.length) return [];
  const threshold = Math.max(
    5.8,
    hours.reduce((s, h) => s + h.score, 0) / hours.length + 0.4,
  );
  const strong = hours.filter((h) => h.score >= threshold);
  if (!strong.length) {
    // Fallback: single best 2h block.
    let bestStart = 0;
    let bestAvg = -1;
    for (let i = 0; i < hours.length; i++) {
      const a = hours[i]?.score ?? 0;
      const b = hours[i + 1]?.score ?? a;
      const avg = (a + b) / 2;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestStart = i;
      }
    }
    const start = hours[bestStart]!;
    const end = hours[Math.min(bestStart + 1, hours.length - 1)]!;
    return [
      {
        start: start.time,
        end: new Date(end.time.getTime() + 60 * 60 * 1000),
        score: round1(bestAvg),
        label: hourScoreLabel(bestAvg),
      },
    ];
  }

  const windows: HuggWindow[] = [];
  let run: HuggHourPoint[] = [];
  const flush = () => {
    if (!run.length) return;
    const avg =
      run.reduce((s, h) => s + h.score, 0) / run.length;
    const last = run[run.length - 1]!;
    windows.push({
      start: run[0]!.time,
      end: new Date(last.time.getTime() + 60 * 60 * 1000),
      score: round1(avg),
      label: hourScoreLabel(avg),
    });
    run = [];
  };

  for (const h of hours) {
    if (h.score >= threshold) run.push(h);
    else flush();
  }
  flush();

  return windows
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function buildFactors(input: {
  pressureDelta6h: number | null;
  windMs: number | null;
  precipMm: number | null;
  waterTempC: number | null;
  symbolCode: number | null;
  waterRising: boolean;
  turbidity: TurbidityEstimate | null;
  now: Date;
}): HuggFactor[] {
  const factors: HuggFactor[] = [];
  const { sunrise, sunset } = malmoSunTimes(input.now);

  if (input.pressureDelta6h != null) {
    const d = input.pressureDelta6h;
    const sign = d > 0 ? "+" : "";
    if (d >= 2.5) {
      factors.push({
        id: "pressure",
        label: "Lufttryck",
        tone: "down",
        detail: `Stigande ${sign}${d.toFixed(1)} hPa / 6 h — ofta trögare hugg, särskilt mitt på dagen`,
      });
    } else if (d <= -2.5) {
      factors.push({
        id: "pressure",
        label: "Lufttryck",
        tone: "up",
        detail: `Fallande ${d.toFixed(1)} hPa / 6 h — klassiskt aktiverande läge`,
      });
    } else {
      factors.push({
        id: "pressure",
        label: "Lufttryck",
        tone: "neutral",
        detail: `Ganska stabilt (${sign}${d.toFixed(1)} hPa / 6 h) — timing vid gryning/skymning väger tyngre`,
      });
    }
  }

  {
    const { dawn, dusk } = malmoSunTimes(input.now);
    const nowT = input.now.getTime();
    const isNight = nowT < dawn.getTime() || nowT > dusk.getTime();
    factors.push({
      id: "light",
      label: "Ljus",
      tone: "up",
      detail: isNight
        ? `Natt i kanalen — gatubelysning håller oftast fisken aktiv`
        : `Sol ${sunrise.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}–${sunset.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} · gryning/skymning + natt i kanalen`,
    });
  }

  {
    const hit = solunarAt(input.now);
    const illum = SunCalc.getMoonIllumination(input.now).fraction;
    const phasePct = Math.round(illum * 100);
    factors.push({
      id: "solunar",
      label: "Solunar",
      tone: hit ? "up" : "neutral",
      detail: hit
        ? `${hit.label} nu · dagens fönster: ${solunarDayWindows(input.now)} · måne ${phasePct}%`
        : `Dagens fönster: ${solunarDayWindows(input.now)} · måne ${phasePct}%`,
    });
  }

  if (input.windMs != null) {
    if (input.windMs >= 2 && input.windMs <= 7) {
      factors.push({
        id: "wind",
        label: "Vind",
        tone: "up",
        detail: `${input.windMs.toFixed(1)} m/s — lagom krusad yta`,
      });
    } else if (input.windMs < 1) {
      factors.push({
        id: "wind",
        label: "Vind",
        tone: "down",
        detail: "Stiltje — spegelblank yta gör fisken försiktigare",
      });
    } else if (input.windMs >= 11) {
      factors.push({
        id: "wind",
        label: "Vind",
        tone: "down",
        detail: `${input.windMs.toFixed(1)} m/s — hårt, svårt i kanalen`,
      });
    } else {
      factors.push({
        id: "wind",
        label: "Vind",
        tone: "neutral",
        detail: `${input.windMs.toFixed(1)} m/s`,
      });
    }
  }

  if (input.waterTempC != null) {
    const t = input.waterTempC;
    factors.push({
      id: "waterTemp",
      label: "Vattentemp",
      tone: t >= 8 && t <= 16 ? "up" : t < 5 ? "down" : "neutral",
      detail: `${t.toFixed(1)} °C · Malmö Hamn`,
    });
  }

  if (input.precipMm != null && input.precipMm > 0.15) {
    factors.push({
      id: "precip",
      label: "Nederbörd",
      tone: input.precipMm <= 1.2 ? "up" : "down",
      detail:
        input.precipMm <= 1.2
          ? `Lätt regn (${input.precipMm.toFixed(1)} mm) kan hjälpa`
          : `Kraftigare nederbörd (${input.precipMm.toFixed(1)} mm)`,
    });
  } else if (isCloudy(input.symbolCode)) {
    factors.push({
      id: "cloud",
      label: "Moln",
      tone: "up",
      detail: "Mulet/molnigt — jämnare ljus, ofta bättre än blank sol",
    });
  }

  if (input.waterRising) {
    factors.push({
      id: "level",
      label: "Vattenstånd",
      tone: "up",
      detail: "Stigande nivå — ofta mer rörelse längs kanterna",
    });
  }

  if (input.turbidity) {
    const t = input.turbidity;
    factors.push({
      id: "turbidity",
      label: "Sikt / grumlighet",
      tone:
        t.label === "grumligt" ? "up" : t.label === "klart" ? "down" : "neutral",
      detail:
        t.label === "grumligt"
          ? `${t.detail} — oftast bättre fiske`
          : t.label === "klart"
            ? `${t.detail} — oftast svårare fiske`
            : t.detail,
    });
  }

  {
    const month = input.now.getMonth();
    if (isCanalAbborrePeak(month)) {
      factors.push({
        id: "season",
        label: "Säsong",
        tone: "up",
        detail:
          "Abborre går in i kanalen på hösten och stannar till våren — säsongen är stark nu",
      });
    } else if (isCanalAbborreShoulder(month)) {
      factors.push({
        id: "season",
        label: "Säsong",
        tone: "up",
        detail: "Övergångstid — abborre på väg in i / ut ur kanalen",
      });
    } else if (isCanalAbborreQuiet(month)) {
      factors.push({
        id: "season",
        label: "Säsong",
        tone: "down",
        detail: "Sommar — abborre håller oftast mer ute än i kanalen",
      });
    }
  }

  return factors;
}

/**
 * KanalHugget bite forecast from SMHI hourly series + canal water context.
 * Designed to be conservative: rising high pressure should not read as "peak day".
 */
export function computeHuggForecast(input: {
  series: HuggHourInput[];
  now?: Date;
  waterTempC: number | null;
  waterRising?: boolean;
  /** Absolute water-level change over ~3 h (cm), from SMHI ocobs. */
  waterAbsDelta3hCm?: number | null;
}): HuggForecast {
  const now = input.now ?? new Date();
  const waterRising = Boolean(input.waterRising);
  const waterAbsDelta3hCm =
    input.waterAbsDelta3hCm != null && Number.isFinite(input.waterAbsDelta3hCm)
      ? Math.abs(input.waterAbsDelta3hCm)
      : null;
  const sorted = [...input.series].sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  );

  if (sorted.length === 0) {
    return {
      nowScore: 5,
      dayScore: 5,
      label: "Otillräcklig data",
      summary: "Kunde inte bygga en prognos — saknar SMHI-timmar.",
      confidence: "low",
      factors: [],
      hours: [],
      windows: [],
      why: "saknar väderdata",
    };
  }

  const scored: HuggHourPoint[] = sorted.map((row, index) => {
    const dP = pressureDeltaAt(sorted, index, 6);
    const turbidity = estimateTurbidity(sorted, index, waterAbsDelta3hCm);
    const scoredHour = scoreHour(
      row,
      dP,
      input.waterTempC,
      waterRising,
      turbidity,
    );
    return {
      time: row.time,
      score: scoredHour.score,
      why: scoredHour.why,
    };
  });

  // Prefer "today" in local time for windows / day score.
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = dayKey(now);
  let todayHours = scored.filter((h) => dayKey(h.time) === todayKey);
  if (todayHours.length < 4) {
    // Fallback: next 16 hours from now.
    todayHours = scored.filter(
      (h) =>
        h.time.getTime() >= now.getTime() - 30 * 60_000 &&
        h.time.getTime() <= now.getTime() + 16 * 3600_000,
    );
  }

  const nearest = scored.reduce((best, h) => {
    const bd = Math.abs(best.time.getTime() - now.getTime());
    const hd = Math.abs(h.time.getTime() - now.getTime());
    return hd < bd ? h : best;
  }, scored[0]!);

  // Honest day score: mean of all hours, lightly pulled toward the better ones.
  const pool = todayHours.length ? todayHours : scored.slice(0, 16);
  const meanAll =
    pool.reduce((s, h) => s + h.score, 0) / Math.max(1, pool.length);
  const sortedScores = [...pool].map((h) => h.score).sort((a, b) => b - a);
  const topN = sortedScores.slice(
    0,
    Math.max(2, Math.ceil(sortedScores.length * 0.25)),
  );
  const meanTop =
    topN.reduce((s, n) => s + n, 0) / Math.max(1, topN.length);
  const dayScore = round1(meanAll * 0.65 + meanTop * 0.35);

  const windows = mergeWindows(todayHours.length ? todayHours : scored.slice(0, 16));
  const nearestIndex = Math.max(
    0,
    sorted.findIndex((r) => r.time.getTime() === nearest.time.getTime()),
  );
  const current = sorted[nearestIndex];
  const pressureDelta6h = pressureDeltaAt(sorted, nearestIndex, 6);
  const turbidityNow = estimateTurbidity(
    sorted,
    nearestIndex,
    waterAbsDelta3hCm,
  );

  const factors = buildFactors({
    pressureDelta6h,
    windMs: current?.windMs ?? null,
    precipMm: current?.precipMm ?? null,
    waterTempC: input.waterTempC,
    symbolCode: current?.symbolCode ?? null,
    waterRising,
    turbidity: turbidityNow,
    now,
  });

  const dataPoints = sorted.filter(
    (r) => r.pressureHpa != null && r.windMs != null,
  ).length;
  const confidence: HuggForecast["confidence"] =
    dataPoints >= 12 ? "high" : dataPoints >= 6 ? "medium" : "low";

  const windowText =
    windows.length > 0
      ? windows
          .map((w) => {
            const a = w.start.toLocaleTimeString("sv-SE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const b = w.end.toLocaleTimeString("sv-SE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return `${a}–${b}`;
          })
          .join(" · ")
      : "inga tydliga toppar";

  let summary: string;
  if (turbidityNow.label === "klart") {
    summary = `Klart vatten (proxy) gör ofta fisket svårare. Bästa fönster: ${windowText}.`;
  } else if (turbidityNow.label === "grumligt") {
    summary = `Grumligare vatten (proxy efter vind/regn/nivå) talar för bättre förutsättningar. Bästa fönster: ${windowText}.`;
  } else if (pressureDelta6h != null && pressureDelta6h >= 2.5) {
    summary = `Stigande lufttryck dämpar oftast hugget mitt på dagen. Sikta på ${windowText} — inte “hela dagen”.`;
  } else if (pressureDelta6h != null && pressureDelta6h <= -2.5) {
    summary = `Fallande tryck talar för mer aktivitet. Bästa fönster: ${windowText}.`;
  } else {
    summary = `Blandat dygn — timing spelar roll. Bästa fönster: ${windowText}.`;
  }
  summary += " Prognos om förutsättningar, inte garanterad fångst.";

  const why = factors
    .slice(0, 4)
    .map((f) => f.detail.split("—")[0]?.trim() || f.label)
    .join(" · ");

  // Keep a unused-geo touch so tree-shaking doesn't drop coords if needed later.
  void (MALMO_LAT + MALMO_LON);

  return {
    nowScore: nearest.score,
    dayScore,
    label: dayLabel(dayScore),
    summary,
    confidence,
    factors,
    hours: todayHours.length ? todayHours : scored.slice(0, 24),
    windows,
    why,
  };
}
