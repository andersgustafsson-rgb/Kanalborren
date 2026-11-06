import { useEffect, useState } from "react";
import "./WaterLevelWidget.css";

type Reading = {
  value: number | null;
  time: string | null;
  station: string;
  error: string | null;
};

/** SMHI Öresund proxy — Malmö Hamn (35152). */
async function fetchMalmoLevel(): Promise<Reading> {
  const station = "Malmö Hamn (SMHI)";
  try {
    const url =
      "https://opendata-download-ocobs.smhi.se/api/version/latest/parameter/4/station/35152/period/latest-hour/data.json";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Kunde inte hämta SMHI");
    const json = (await res.json()) as {
      value?: { value: number; date: string }[];
    };
    const last = json.value?.[json.value.length - 1];
    return {
      value: typeof last?.value === "number" ? last.value : null,
      time: last?.date || null,
      station,
      error: null,
    };
  } catch (e) {
    return {
      value: null,
      time: null,
      station,
      error: e instanceof Error ? e.message : "Fel",
    };
  }
}

export function WaterLevelWidget() {
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMalmoLevel().then((r) => {
      if (!cancelled) setReading(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="home-board water-widget" aria-label="Vattenstånd">
      <header className="home-board-head">
        <h2>Öresunds vattenstånd</h2>
        <p>Proxy via SMHI — inte mätning i kanalen</p>
      </header>
      {!reading && <p className="water-muted">Hämtar…</p>}
      {reading?.error && <p className="water-muted">{reading.error}</p>}
      {reading && !reading.error && (
        <p className="water-value">
          <strong>
            {reading.value != null ? `${reading.value.toFixed(1)} cm` : "–"}
          </strong>
          <span>
            {reading.station}
            {reading.time
              ? ` · ${new Date(reading.time).toLocaleString("sv-SE", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}`
              : ""}
          </span>
        </p>
      )}
    </section>
  );
}
