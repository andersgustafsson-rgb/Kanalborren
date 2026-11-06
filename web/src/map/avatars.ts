export type PresetAvatarId =
  | "veteran"
  | "cap"
  | "orange"
  | "vest"
  | "teal";

export type AvatarId = PresetAvatarId | "custom";

export type AvatarDef = {
  id: PresetAvatarId;
  label: string;
  src: string;
};

export const AVATARS: AvatarDef[] = [
  { id: "veteran", label: "Veteran", src: "/avatars/veteran.png" },
  { id: "cap", label: "Keps", src: "/avatars/cap.png" },
  { id: "orange", label: "Orange", src: "/avatars/orange.png" },
  { id: "vest", label: "Väst", src: "/avatars/vest.png" },
  { id: "teal", label: "Teal", src: "/avatars/teal.png" },
];

export const DEFAULT_AVATAR: PresetAvatarId = "veteran";

export function isPresetAvatarId(id: string | null | undefined): id is PresetAvatarId {
  return AVATARS.some((a) => a.id === id);
}

export function getPresetAvatar(id: string | null | undefined): AvatarDef {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}

/** HTML for Leaflet / picker — circular photo. */
export function avatarImgHtml(src: string, alt = "Avatar"): string {
  const safe = src.replace(/"/g, "");
  return `<img class="avatar-face" src="${safe}" alt="${alt}" draggable="false" />`;
}
