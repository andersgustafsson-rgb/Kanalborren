import { useEffect, useState } from "react";
import "./WaterLevelWidget.css";

type Conditions = {
  waterCm: number | null;
  waterStation: string;
  tempC: number | null;
  windMs: number | null;
  gustMs: number | null;
  windDir: number | null;
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

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunde inte hämta SMHI");
  return res.json();
}

/** SMHI: vatten Malmö Hamn + väder Malmö A. */
async function fetchCanalConditions(): Promise<Conditions> {
  try {
    const waterUrl =
      "https://opendata-download-ocobs.smhi.se/api/version/1.0/parameter/6/station/35152/period/latest-day/data.json";
    const base =
      "https://opendata-download-metobs.smhi.se/api/version/1.0/parameter";
    const station = "52350"; // Malmö A
    const period = "latest-hour";

    const [water, temp, wind, dir, gust] = await Promise.all([
      fetchJson(waterUrl),
      fetchJson(`${base}/1/station/${station}/period/${period}/data.json`),
      fetchJson(`${base}/4/station/${station}/period/${period}/data.json`),
      fetchJson(`${base}/3/station/${station}/period/${period}/data.json`),
      fetchJson(`${base}/21/station/${station}/period/${period}/data.json`),
    ]);

    const w = lastValue(water);
    const t = lastValue(temp);
    const wi = lastValue(wind);
    const d = lastValue(dir);
    const g = lastValue(gust);
    const time = t.time || wi.time || w.time;

    return {
      waterCm: w.value,
      waterStation: "Malmö Hamn",
      tempC: t.value,
      windMs: wi.value,
      gustMs: g.value,
      windDir: d.value,
      time,
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
      <header className="home-board-head">
        <h2>Väder & vatten</h2>
        <p>SMHI Malmö · vattenstånd är Öresund, inte kanalen</p>
      </header>
      {!data && <p className="water-muted">Hämtar…</p>}
      {data?.error && <p className="water-muted">{data.error}</p>}
      {data && !data.error && (
        <>
          <ul className="conditions-grid">
            <li>
              <span className="conditions-label">Luft</span>
              <strong>
                {data.tempC != null ? `${data.tempC.toFixed(1)} °C` : "–"}
              </strong>
            </li>
            <li>
              <span className="conditions-label">Vind</span>
              <strong>
                {data.windMs != null
                  ? `${data.windMs.toFixed(1)} m/s`
                  : "–"}
              </strong>
              <small>
                {compass(data.windDir)} · {windLabel(data.windMs)}
                {data.gustMs != null
                  ? ` · by ${data.gustMs.toFixed(1)}`
                  : ""}
              </small>
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
