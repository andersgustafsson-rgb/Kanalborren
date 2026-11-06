/** Prototype admin gate — replace with real auth later. */
export const ADMIN_STORAGE_KEY = "kanalhugget.admin.v1";

/** Change this (or move server-side) before any public launch. */
export const ADMIN_PIN = "kanal2026";

export function isAdminUnlocked(): boolean {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockAdmin(pin: string): boolean {
  if (pin.trim() !== ADMIN_PIN) return false;
  localStorage.setItem(ADMIN_STORAGE_KEY, "1");
  return true;
}

export function lockAdmin(): void {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}
