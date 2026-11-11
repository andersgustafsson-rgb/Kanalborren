import type { Feature, FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";

export type ParkingProps = {
  taxa?: string;
  farg?: number;
  boende?: string;
  typ?: string;
  platser?: number;
};

/** Colors aligned with Malmö stad’s parking map. */
const TAXA_COLOR: Record<string, string> = {
  A: "#3b82f6",
  B: "#ef4444",
  C: "#94a3b8",
  D: "#22c55e",
  E: "#ec4899",
  F: "#f97316",
  P: "#a855f7",
};

let cache: FeatureCollection | null = null;
let inflight: Promise<FeatureCollection> | null = null;

export async function loadParkingFees(): Promise<FeatureCollection> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/geo/parkeringsavgifter.geojson")
    .then(async (res) => {
      if (!res.ok) throw new Error("Kunde inte ladda parkering");
      const fc = (await res.json()) as FeatureCollection;
      cache = fc;
      return fc;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function taxaKey(taxa: string | undefined): string {
  if (!taxa) return "?";
  if (/pendlar/i.test(taxa)) return "P";
  const m = taxa.match(/Taxa\s+([A-F])/i);
  return m?.[1]?.toUpperCase() || "?";
}

export function parkingStyle(props: ParkingProps): PathOptions {
  const key = taxaKey(props.taxa);
  return {
    color: TAXA_COLOR[key] || "#38bdf8",
    weight: 4,
    opacity: 0.88,
    lineCap: "round",
    lineJoin: "round",
  };
}

export function bindParkingPopup(feature: Feature, layer: Layer) {
  const p = (feature.properties || {}) as ParkingProps;
  const taxa = p.taxa || "Okänd taxa";
  const bits = [
    `<strong>${escapeHtml(taxa)}</strong>`,
    p.typ ? `Typ: ${escapeHtml(p.typ)}` : null,
    p.platser != null ? `Platser: ${p.platser}` : null,
    p.boende ? `Boende: ${escapeHtml(p.boende)}` : null,
    `<small>Korttidsparkering. Vägmärket på plats gäller alltid.</small>`,
  ].filter(Boolean);
  layer.bindPopup(bits.join("<br/>"), { maxWidth: 260 });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
