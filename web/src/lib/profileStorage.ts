import {
  fileToAvatarDataUrl,
  loadAvatarChoice,
  resolveAvatarSrc,
  saveCustomAvatar,
  savePresetAvatar,
  type AvatarChoice,
} from "../map/avatarStorage";
import type { PresetAvatarId } from "../map/avatars";
import { SPECIES_IDS } from "./species";

/** Display name is per browser tab (sessionStorage) so local two-tab demo works. */
const NAME_KEY = "kanalhugget.displayName.tab";
const BIO_KEY = "kanalhugget.profile.bio.v1";
const CITY_KEY = "kanalhugget.profile.city.v1";
const STYLE_KEY = "kanalhugget.profile.style.v1";
const SPECIES_PBS_KEY = "kanalhugget.profile.speciesPbs.v2";
const SPECIES_PBS_KEY_LEGACY = "kanalhugget.profile.speciesPbs.v1";

/** Declared personal bests per species (length and/or weight). */
export type SpeciesPbEntry = {
  lengthCm?: number;
  weightKg?: number;
};
export type SpeciesPbMap = Partial<Record<string, SpeciesPbEntry>>;

export type Profile = {
  displayName: string;
  bio: string;
  city: string;
  fishingStyle: string;
  speciesPbs: SpeciesPbMap;
  avatar: AvatarChoice;
  avatarSrc: string;
};

function tabDefaultName(): string {
  const idKey = "kanalhugget.deviceId";
  let id = sessionStorage.getItem(idKey);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(idKey, id);
  }
  return `Gäst-${id.slice(0, 4)}`;
}

function readDisplayName(): string {
  const fromTab = sessionStorage.getItem(NAME_KEY);
  if (fromTab && fromTab.trim()) return fromTab.trim();
  const fresh = tabDefaultName();
  sessionStorage.setItem(NAME_KEY, fresh);
  return fresh;
}

function cleanLength(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > 300) {
    return undefined;
  }
  return Math.round(n * 10) / 10;
}

function cleanWeight(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > 50) {
    return undefined;
  }
  return Math.round(n * 100) / 100;
}

function normalizeEntry(raw: unknown): SpeciesPbEntry | null {
  if (typeof raw === "number") {
    const lengthCm = cleanLength(raw);
    return lengthCm != null ? { lengthCm } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as SpeciesPbEntry;
  const lengthCm = cleanLength(obj.lengthCm);
  const weightKg = cleanWeight(obj.weightKg);
  if (lengthCm == null && weightKg == null) return null;
  return {
    ...(lengthCm != null ? { lengthCm } : {}),
    ...(weightKg != null ? { weightKg } : {}),
  };
}

export function loadSpeciesPbs(): SpeciesPbMap {
  try {
    const raw =
      localStorage.getItem(SPECIES_PBS_KEY) ||
      localStorage.getItem(SPECIES_PBS_KEY_LEGACY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: SpeciesPbMap = {};
    for (const id of SPECIES_IDS) {
      const entry = normalizeEntry(parsed?.[id]);
      if (entry) out[id] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveSpeciesPbs(map: SpeciesPbMap) {
  const clean: SpeciesPbMap = {};
  for (const id of SPECIES_IDS) {
    const entry = normalizeEntry(map[id]);
    if (entry) clean[id] = entry;
  }
  localStorage.setItem(SPECIES_PBS_KEY, JSON.stringify(clean));
}

export function saveSpeciesPb(
  species: string,
  patch: { lengthCm?: number | null; weightKg?: number | null },
) {
  const map = loadSpeciesPbs();
  const prev = map[species] || {};
  const next: SpeciesPbEntry = { ...prev };

  if ("lengthCm" in patch) {
    const lengthCm = cleanLength(patch.lengthCm ?? NaN);
    if (lengthCm == null) delete next.lengthCm;
    else next.lengthCm = lengthCm;
  }
  if ("weightKg" in patch) {
    const weightKg = cleanWeight(patch.weightKg ?? NaN);
    if (weightKg == null) delete next.weightKg;
    else next.weightKg = weightKg;
  }

  if (next.lengthCm == null && next.weightKg == null) delete map[species];
  else map[species] = next;
  saveSpeciesPbs(map);
}

export function loadProfile(): Profile {
  const avatar = loadAvatarChoice();
  return {
    displayName: readDisplayName(),
    bio: localStorage.getItem(BIO_KEY) || "",
    city: localStorage.getItem(CITY_KEY) || "Malmö",
    fishingStyle: localStorage.getItem(STYLE_KEY) || "",
    speciesPbs: loadSpeciesPbs(),
    avatar,
    avatarSrc: resolveAvatarSrc(avatar),
  };
}

export function saveDisplayName(name: string) {
  const v = name.trim() || tabDefaultName();
  sessionStorage.setItem(NAME_KEY, v);
}

export function saveBio(bio: string) {
  localStorage.setItem(BIO_KEY, bio.slice(0, 280));
}

export function saveCity(city: string) {
  localStorage.setItem(CITY_KEY, city.slice(0, 60));
}

export function saveFishingStyle(style: string) {
  localStorage.setItem(STYLE_KEY, style.slice(0, 80));
}

export function saveProfileAvatarPreset(id: PresetAvatarId) {
  savePresetAvatar(id);
}

export async function saveProfileAvatarFile(file: File): Promise<string> {
  const dataUrl = await fileToAvatarDataUrl(file);
  saveCustomAvatar(dataUrl);
  return dataUrl;
}
