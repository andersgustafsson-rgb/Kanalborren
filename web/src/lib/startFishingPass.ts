import type { FeatureCollection } from "geojson";
import {
  INITIAL_DURATION_MS,
  loadSession,
  loadVisibilityPref,
  saveSession,
  type CheckInSession,
} from "../map/checkinStorage";
import { resolveZone, roundForPrivacy } from "../map/geo";
import { loadAvatarChoice } from "../map/avatarStorage";
import { publishSession } from "./fishingSessions";
import { startFishingTrip, type FishingTrip } from "./fishingTrips";
import { fetchSpots } from "./spotsApi";

export type StartPassResult = {
  trip: FishingTrip | null;
  checkedIn: boolean;
  zoneName: string | null;
  /** ghost | zone | precise when checked in */
  visibility: string | null;
  error: string | null;
  /** Soft note when GPS failed but pass still started. */
  hint: string | null;
};

type Fix = { lat: number; lng: number; accuracy: number | null };

async function loadGeoJson(url: string): Promise<FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunde inte ladda ${url}`);
  return (await res.json()) as FeatureCollection;
}

function getGpsFix(timeoutMs = 12_000): Promise<Fix | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60_000,
      },
    );
  });
}

async function loadCanalMapData(): Promise<{
  spots: FeatureCollection;
  zones: FeatureCollection;
}> {
  const [zones, seedSpots, cloud] = await Promise.all([
    loadGeoJson("/geo/sociala-zoner.geojson"),
    loadGeoJson("/geo/lokala-platser.geojson"),
    fetchSpots(),
  ]);
  return { spots: cloud || seedSpots, zones };
}

/**
 * Start fishing pass from home AND publish a map check-in in one tap.
 * Uses GPS when available; falls back to last private check-in coords.
 */
export async function startFishingPassWithCheckIn(opts: {
  userId: string;
  displayName: string;
}): Promise<StartPassResult> {
  const { trip, error } = await startFishingTrip();
  if (error || !trip) {
    return {
      trip: null,
      checkedIn: false,
      zoneName: null,
      visibility: null,
      error: error || "Kunde inte starta fiskepass",
      hint: null,
    };
  }

  // Already checked in locally — keep that session.
  const existing = loadSession();
  if (existing && Date.parse(existing.expiresAt) > Date.now()) {
    return {
      trip,
      checkedIn: true,
      zoneName: existing.zoneName,
      visibility: existing.visibility,
      error: null,
      hint: null,
    };
  }

  const fix = await getGpsFix();
  if (!fix) {
    return {
      trip,
      checkedIn: false,
      zoneName: null,
      visibility: null,
      error: null,
      hint:
        "Pass igång, men ingen GPS — öppna kartan och tryck Jag är vid kanalen för att synas",
    };
  }

  try {
    const { spots, zones } = await loadCanalMapData();
    const visibility = loadVisibilityPref();
    const zone = resolveZone(fix.lat, fix.lng, spots, zones);
    const rounded = roundForPrivacy(fix.lat, fix.lng);
    const expiresAt =
      trip.expiresAt ||
      new Date(Date.now() + INITIAL_DURATION_MS).toISOString();
    const startedAt = trip.startedAt || new Date().toISOString();

    let publicLat: number | null = null;
    let publicLng: number | null = null;
    if (visibility === "zone") {
      publicLat = zone.lat;
      publicLng = zone.lng;
    } else if (visibility === "precise") {
      publicLat = rounded.lat;
      publicLng = rounded.lng;
    }

    const avatar = loadAvatarChoice();
    const remoteId = await publishSession(
      {
        visibility,
        zoneId: zone.id,
        zoneName: zone.name,
        lat: publicLat,
        lng: publicLng,
        openForCompany: false,
        note: "",
        avatarId: avatar.id === "custom" ? "veteran" : avatar.id,
        expiresAt,
      },
      {
        userId: opts.userId,
        displayName: opts.displayName,
      },
    );

    // Ghost without company publishes nothing — still keep a local session
    // so the map treats the pass as checked in.
    const next: CheckInSession = {
      visibility,
      openForCompany: false,
      note: "",
      zoneId: zone.id,
      zoneName: zone.name,
      publicLat,
      publicLng,
      privateLat: fix.lat,
      privateLng: fix.lng,
      accuracyM: fix.accuracy,
      startedAt,
      expiresAt,
      remoteId,
    };
    saveSession(next);

    return {
      trip,
      checkedIn: true,
      zoneName: zone.name,
      visibility,
      error: null,
      hint: null,
    };
  } catch (e) {
    console.warn("startFishingPassWithCheckIn", e);
    return {
      trip,
      checkedIn: false,
      zoneName: null,
      visibility: null,
      error: null,
      hint:
        "Pass igång, men check-in misslyckades — öppna kartan för att synas",
    };
  }
}
