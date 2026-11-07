import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  CHECKIN_STORAGE_KEY,
  clearSession,
  EXPIRY_WARN_MS,
  EXTEND_MS,
  formatRemaining,
  INITIAL_DURATION_MS,
  loadSession,
  markCheckInNudged,
  MAX_SESSION_MS,
  saveSession,
  TWO_HOUR_REMINDER_MS,
  wasCheckInNudged,
  type CheckInSession,
  type Visibility,
} from "./checkinStorage";
import { resolveZone, roundForPrivacy, type ResolvedZone } from "./geo";
import {
  endSession,
  publishSession,
  setSessionOpenForCompany,
} from "../lib/fishingSessions";
import { showAppNotification } from "../lib/notifications";

type Fix = { lat: number; lng: number; accuracy: number | null };

/** Slottsparken / canal — for testing when you're not in Malmö. */
export const DEMO_CANAL_FIX: Fix = {
  lat: 55.6042,
  lng: 12.9905,
  accuracy: 25,
};

export type CheckInIdentity = {
  userId?: string | null;
  displayName: string;
  avatarId: string | null;
};

export function useCheckIn(
  spots: FeatureCollection | null,
  zones: FeatureCollection | null,
  identity: CheckInIdentity,
) {
  const [session, setSession] = useState<CheckInSession | null>(() =>
    loadSession(),
  );
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("zone");
  const [openForCompany, setOpenForCompany] = useState(false);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [recenterSeq, setRecenterSeq] = useState(0);
  const [simulated, setSimulated] = useState(false);
  const [spectator, setSpectator] = useState(() => !loadSession());
  const [syncing, setSyncing] = useState(false);
  const [reminder, setReminder] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      const s = loadSession();
      if (!s && session) setSession(null);
      else if (s && session && s.expiresAt !== session.expiresAt) setSession(s);
    }, 15000);
    return () => window.clearInterval(t);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      void endSession(session.remoteId, identity.userId);
      clearSession();
      setSession(null);
      setReminder(null);
    }
  }, [now, session, identity.userId]);

  useEffect(() => {
    if (!session) {
      setReminder(null);
      return;
    }
    const started = Date.parse(session.startedAt);
    const expires = Date.parse(session.expiresAt);
    const elapsed = now - started;
    const left = expires - now;
    if (left <= 0) return;

    const twoKey = `2h:${session.startedAt}`;
    if (elapsed >= TWO_HOUR_REMINDER_MS && !wasCheckInNudged(twoKey)) {
      markCheckInNudged(twoKey);
      const text =
        "Du har varit ute i 2 timmar — förläng om du stannar, annars dölj dig";
      setReminder(text);
      void showAppNotification({
        title: "KanalHugget · 2 timmar",
        body: text,
        url: "/karta",
        tag: twoKey,
      });
    }

    const expKey = `exp:${session.expiresAt}`;
    if (left <= EXPIRY_WARN_MS && !wasCheckInNudged(expKey)) {
      markCheckInNudged(expKey);
      const text = `Check-in går ut om ${formatRemaining(left)} — förläng med +30 min?`;
      setReminder(text);
      void showAppNotification({
        title: "KanalHugget · snart slut",
        body: text,
        url: "/karta",
        tag: expKey,
      });
    }
  }, [session, now]);

  const suggestedZone: ResolvedZone | null = useMemo(() => {
    if (!fix || !spots || !zones) return null;
    return resolveZone(fix.lat, fix.lng, spots, zones);
  }, [fix, spots, zones]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError("GPS saknas i den här webbläsaren");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSpectator(false);
        setSimulated(false);
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        });
        setRecenterSeq((n) => n + 1);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === 1
            ? "Du måste tillåta platsåtkomst"
            : "Kunde inte hämta position",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, []);

  const simulateAtCanal = useCallback(() => {
    setLocateError(null);
    setSpectator(false);
    setSimulated(true);
    setFix({ ...DEMO_CANAL_FIX });
    setRecenterSeq((n) => n + 1);
  }, []);

  /** One-tap from the sofa: pretend you're at the canal and check in (zone). */
  const sofaDemoCheckIn = useCallback(async () => {
    if (!spots || !zones) return;
    setLocateError(null);
    setSpectator(false);
    setSimulated(true);
    setVisibility("zone");
    const demoFix = { ...DEMO_CANAL_FIX };
    setFix(demoFix);
    setRecenterSeq((n) => n + 1);
    setSyncing(true);

    const zone = resolveZone(demoFix.lat, demoFix.lng, spots, zones);
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INITIAL_DURATION_MS).toISOString();

    const remoteId = await publishSession(
      {
        visibility: "zone",
        zoneId: zone.id,
        zoneName: zone.name,
        lat: zone.lat,
        lng: zone.lng,
        openForCompany,
        note: "Test från soffan",
        avatarId: identity.avatarId,
        expiresAt,
      },
      {
        remoteId: session?.remoteId,
        userId: identity.userId,
        displayName: identity.displayName,
      },
    );

    const next: CheckInSession = {
      visibility: "zone",
      openForCompany,
      note: "Test från soffan",
      zoneId: zone.id,
      zoneName: zone.name,
      publicLat: zone.lat,
      publicLng: zone.lng,
      privateLat: demoFix.lat,
      privateLng: demoFix.lng,
      accuracyM: demoFix.accuracy,
      startedAt,
      expiresAt,
      remoteId,
    };
    saveSession(next);
    setSession(next);
    setReminder(null);
    setNote("Test från soffan");
    setSyncing(false);
  }, [spots, zones, identity, session?.remoteId, openForCompany]);

  const setFixFromMapClick = useCallback((lat: number, lng: number) => {
    setLocateError(null);
    setSpectator(false);
    setSimulated(true);
    setFix({ lat, lng, accuracy: 20 });
    setRecenterSeq((n) => n + 1);
  }, []);

  const enterSpectator = useCallback(async () => {
    const remoteId = session?.remoteId;
    clearSession();
    setSession(null);
    setFix(null);
    setSimulated(false);
    setLocateError(null);
    setSpectator(true);
    setVisibility("ghost");
    setOpenForCompany(false);
    await endSession(remoteId, identity.userId);
  }, [session?.remoteId, identity.userId]);

  const checkIn = useCallback(async () => {
    if (!fix || !spots || !zones) return;
    setSpectator(false);
    setSyncing(true);
    const zone = resolveZone(fix.lat, fix.lng, spots, zones);
    const rounded = roundForPrivacy(fix.lat, fix.lng);
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INITIAL_DURATION_MS).toISOString();

    let publicLat: number | null = null;
    let publicLng: number | null = null;
    if (visibility === "zone") {
      publicLat = zone.lat;
      publicLng = zone.lng;
    } else if (visibility === "precise") {
      publicLat = rounded.lat;
      publicLng = rounded.lng;
    }

    const remoteId = await publishSession(
      {
        visibility,
        zoneId: zone.id,
        zoneName: zone.name,
        lat: publicLat,
        lng: publicLng,
        openForCompany,
        note: note.trim(),
        avatarId: identity.avatarId,
        expiresAt,
      },
      {
        remoteId: session?.remoteId,
        userId: identity.userId,
        displayName: identity.displayName,
      },
    );

    const next: CheckInSession = {
      visibility,
      openForCompany,
      note: note.trim(),
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
    setSession(next);
    setReminder(null);
    setSyncing(false);
  }, [
    fix,
    spots,
    zones,
    visibility,
    openForCompany,
    note,
    identity,
    session?.remoteId,
  ]);

  const hide = useCallback(async () => {
    const remoteId = session?.remoteId;
    clearSession();
    setSession(null);
    setReminder(null);
    await endSession(remoteId, identity.userId);
  }, [session?.remoteId, identity.userId]);

  const republishActive = useCallback(
    async (patch: Partial<CheckInSession>) => {
      if (!session) return;
      const next: CheckInSession = { ...session, ...patch };
      saveSession(next);
      setSession(next);
      if (next.visibility === "ghost") return;
      const remoteId = await publishSession(
        {
          visibility: next.visibility,
          zoneId: next.zoneId,
          zoneName: next.zoneName,
          lat: next.publicLat,
          lng: next.publicLng,
          openForCompany: next.openForCompany,
          note: next.note,
          avatarId: identity.avatarId,
          expiresAt: next.expiresAt,
        },
        {
          remoteId: next.remoteId,
          userId: identity.userId,
          displayName: identity.displayName,
        },
      );
      if (remoteId && remoteId !== next.remoteId) {
        const withId = { ...next, remoteId };
        saveSession(withId);
        setSession(withId);
      }
    },
    [session, identity],
  );

  const setOpenForCompanyAndSync = useCallback(
    (value: boolean) => {
      setOpenForCompany(value);
      if (!session) return;
      const next = { ...session, openForCompany: value };
      saveSession(next);
      setSession(next);
      void setSessionOpenForCompany(value, {
        remoteId: session.remoteId,
        userId: identity.userId,
        displayName: identity.displayName,
      });
    },
    [session, identity],
  );

  const extend = useCallback(async () => {
    if (!session) return;
    const started = Date.parse(session.startedAt);
    const maxEnd = started + MAX_SESSION_MS;
    const nextEnd = Math.min(
      Date.parse(session.expiresAt) + EXTEND_MS,
      maxEnd,
    );
    const expiresAt = new Date(nextEnd).toISOString();
    setReminder(null);
    await republishActive({ expiresAt });
  }, [session, republishActive]);

  const dismissReminder = useCallback(() => setReminder(null), []);

  useEffect(() => {
    if (session && !fix && !spectator) {
      setFix({
        lat: session.privateLat,
        lng: session.privateLng,
        accuracy: session.accuracyM,
      });
      setVisibility(session.visibility);
      setOpenForCompany(session.openForCompany);
      setNote(session.note);
      setSpectator(false);
    }
  }, [session, fix, spectator]);

  return {
    session,
    fix,
    locating,
    locateError,
    visibility,
    setVisibility,
    openForCompany,
    setOpenForCompany: setOpenForCompanyAndSync,
    note,
    setNote,
    suggestedZone,
    now,
    locate,
    simulateAtCanal,
    sofaDemoCheckIn,
    setFixFromMapClick,
    enterSpectator,
    spectator,
    simulated,
    checkIn,
    hide,
    extend,
    reminder,
    dismissReminder,
    syncing,
    storageKey: CHECKIN_STORAGE_KEY,
    recenterSeq,
  };
}
