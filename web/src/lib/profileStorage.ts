import {
  fileToAvatarDataUrl,
  loadAvatarChoice,
  resolveAvatarSrc,
  saveCustomAvatar,
  savePresetAvatar,
  type AvatarChoice,
} from "../map/avatarStorage";
import type { PresetAvatarId } from "../map/avatars";

/** Display name is per browser tab (sessionStorage) so local two-tab demo works. */
const NAME_KEY = "kanalhugget.displayName.tab";
const BIO_KEY = "kanalhugget.profile.bio.v1";
const CITY_KEY = "kanalhugget.profile.city.v1";
const STYLE_KEY = "kanalhugget.profile.style.v1";

export type Profile = {
  displayName: string;
  bio: string;
  city: string;
  fishingStyle: string;
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

export function loadProfile(): Profile {
  const avatar = loadAvatarChoice();
  return {
    displayName: readDisplayName(),
    bio: localStorage.getItem(BIO_KEY) || "",
    city: localStorage.getItem(CITY_KEY) || "Malmö",
    fishingStyle: localStorage.getItem(STYLE_KEY) || "",
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
