import * as SunCalc from "suncalc";
import { MALMO_LAT, MALMO_LON, malmoSunTimes } from "./solarMalmo";

export type HuggHourInput = {
  time: Date;
  windMs: number | null;
  precipMm: number | null;
  pressureHpa: number | null;
  /** SMHI symbol_code when available */
  symbolCode: number | null;
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
};

export type HuggForecast = {
  /** Score for the current / nearest hour (1–10). */
  nowScore: number;
  /** Mean of today's better daylight hours — used for the headline. */
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
  if (t < dawn.getTime() || t > dusk.getTime()) return -0.4;
  return 0.2;
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

function scoreHour(
  row: HuggHourInput,
  pressureDelta6h: number | null,
  waterTempC: number | null,
  waterRising: boolean,
): number {
  // Honest baseline — not "already good".
  let score = 4.4;

  // Pressure movement is the heaviest weather lever.
  if (pressureDelta6h != null) {
    if (pressureDelta6h <= -6) score += 1.2; // messy/fast drop
    else if (pressureDelta6h <= -3) score += 2.2; // classic pre-front feed
    else if (pressureDelta6h <= -1) score += 1.2;
    else if (pressureDelta6h >= 5) score -= 2.4; // building high — Saturday case
    else if (pressureDelta6h >= 2.5) score -= 1.6;
    else if (pressureDelta6h >= 1) score -= 0.7;
  }

  if (row.windMs != null) {
    if (row.windMs >= 2 && row.windMs <= 7) score += 1.1;
    else if (row.windMs > 7 && row.windMs < 11) score += 0.1;
    else if (row.windMs >= 11 && row.windMs < 14) score -= 1.2;
    else if (row.windMs >= 14) score -= 2.2;
    else if (row.windMs < 1) score -= 0.9;
  }

  if (waterTempC != null) {
    if (waterTempC >= 8 && waterTempC <= 16) score += 0.9;
    else if (waterTempC >= 5 && waterTempC < 8) score += 0.25;
    else if (waterTempC < 4) score -= 0.8;
    else if (waterTempC > 18) score -= 0.4;
  }

  const precip = row.precipMm;
  if (isThunder(row.symbolCode)) score -= 2.2;
  else if (precip != null) {
    if (precip > 0.15 && precip <= 1.2) score += 0.45; // light rain can help
    else if (precip > 1.2 && precip <= 3) score -= 0.4;
    else if (precip > 3) score -= 1.1;
  } else if (isWet(row.symbolCode, null)) {
    score += 0.2;
  }

  if (isCloudy(row.symbolCode)) score += 0.35;
  else if (row.symbolCode === 1 || row.symbolCode === 2) {
    // Bright high-pressure midday is often harder in the canal.
    if (pressureDelta6h != null && pressureDelta6h > 1.5) score -= 0.35;
  }

  let light = lightBoost(row.time);
  // Under rising pressure, light edges matter more; midday penalty harder.
  if (pressureDelta6h != null && pressureDelta6h >= 2) {
    if (light > 0) light *= 1.25;
    if (light < 0) light *= 1.35;
  }
  score += light;

  if (waterRising) score += 0.35;

  // Mild moon effect (major periods approx via illumination extremes).
  const moon = SunCalc.getMoonIllumination(row.time);
  const illum = moon.fraction;
  if (illum < 0.12 || illum > 0.88) score += 0.25;
  else if (illum > 0.4 && illum < 0.6) score -= 0.15;

  // November–February: fewer true peak days in Malmö canal.
  const month = row.time.getMonth();
  if (month === 10 || month === 11 || month <= 1) {
    score = Math.min(score, 7.6);
  }

  return clamp(round1(score), 1, 10);
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

  factors.push({
    id: "light",
    label: "Ljus",
    tone: "up",
    detail: `Sol ${sunrise.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}–${sunset.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} · gryning/skymning prioriteras`,
  });

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

  const month = input.now.getMonth();
  if (month === 10 || month === 11 || month <= 1) {
    factors.push({
      id: "season",
      label: "Säsong",
      tone: "down",
      detail: "Nov–feb: färre riktiga toppdagar i kanalen — var försiktig med höga betyg",
    });
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
}): HuggForecast {
  const now = input.now ?? new Date();
  const waterRising = Boolean(input.waterRising);
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
    return {
      time: row.time,
      score: scoreHour(row, dP, input.waterTempC, waterRising),
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

  const daylight = todayHours.filter((h) => {
    const { dawn, dusk } = malmoSunTimes(h.time);
    const t = h.time.getTime();
    return t >= dawn.getTime() - 30 * 60_000 && t <= dusk.getTime() + 30 * 60_000;
  });
  const pool = daylight.length ? daylight : todayHours;
  const sortedScores = [...pool].map((h) => h.score).sort((a, b) => b - a);
  const topN = sortedScores.slice(0, Math.max(3, Math.ceil(sortedScores.length * 0.35)));
  const dayScore = round1(
    topN.reduce((s, n) => s + n, 0) / Math.max(1, topN.length),
  );

  const windows = mergeWindows(todayHours.length ? todayHours : scored.slice(0, 16));
  const current = sorted.find(
    (r) => Math.abs(r.time.getTime() - nearest.time.getTime()) < 60_000,
  );
  const pressureDelta6h = pressureDeltaAt(
    sorted,
    Math.max(0, sorted.findIndex((r) => r.time.getTime() === nearest.time.getTime())),
    6,
  );

  const factors = buildFactors({
    pressureDelta6h,
    windMs: current?.windMs ?? null,
    precipMm: current?.precipMm ?? null,
    waterTempC: input.waterTempC,
    symbolCode: current?.symbolCode ?? null,
    waterRising,
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
  if (pressureDelta6h != null && pressureDelta6h >= 2.5) {
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
