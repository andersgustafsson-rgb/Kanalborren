import {
  DEFAULT_AVATAR,
  isPresetAvatarId,
  type AvatarId,
  type PresetAvatarId,
} from "./avatars";

export const AVATAR_STORAGE_KEY = "kanalhugget.avatar.v1";
export const CUSTOM_AVATAR_KEY = "kanalhugget.avatar.custom.v1";

const MAX_CUSTOM_BYTES = 180_000; // ~ data-URL after resize

export type AvatarChoice = {
  id: AvatarId;
  /** Data URL when id === "custom" */
  customSrc: string | null;
};

export function loadAvatarChoice(): AvatarChoice {
  try {
    const idRaw = localStorage.getItem(AVATAR_STORAGE_KEY);
    const customSrc = localStorage.getItem(CUSTOM_AVATAR_KEY);

    if (idRaw === "custom" && customSrc) {
      return { id: "custom", customSrc };
    }
    if (isPresetAvatarId(idRaw)) {
      return { id: idRaw, customSrc };
    }
    // migrate old SVG ids
    if (idRaw) {
      return { id: DEFAULT_AVATAR, customSrc };
    }
  } catch {
    /* ignore */
  }
  return { id: DEFAULT_AVATAR, customSrc: null };
}

export function savePresetAvatar(id: PresetAvatarId): void {
  localStorage.setItem(AVATAR_STORAGE_KEY, id);
}

export function saveCustomAvatar(dataUrl: string): void {
  localStorage.setItem(CUSTOM_AVATAR_KEY, dataUrl);
  localStorage.setItem(AVATAR_STORAGE_KEY, "custom");
}

export function clearCustomAvatar(): void {
  localStorage.removeItem(CUSTOM_AVATAR_KEY);
  localStorage.setItem(AVATAR_STORAGE_KEY, DEFAULT_AVATAR);
}

/** Resize + JPEG-compress a File to a small data URL for localStorage. */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Välj en bildfil"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 160;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Kunde inte läsa bilden"));
        return;
      }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

      let quality = 0.82;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > MAX_CUSTOM_BYTES && quality > 0.45) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      if (dataUrl.length > MAX_CUSTOM_BYTES) {
        reject(new Error("Bilden är för stor även efter komprimering"));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunde inte ladda bilden"));
    };
    img.src = url;
  });
}

export function resolveAvatarSrc(choice: AvatarChoice): string {
  if (choice.id === "custom" && choice.customSrc) return choice.customSrc;
  if (isPresetAvatarId(choice.id)) {
    const preset = choice.id;
    return `/avatars/${preset}.png`;
  }
  return `/avatars/${DEFAULT_AVATAR}.png`;
}
