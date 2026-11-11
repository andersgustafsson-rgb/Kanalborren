/** Private “here’s my car” pin — local only, not shared. */

export type ParkedCar = {
  lat: number;
  lng: number;
  savedAt: string;
};

const KEY = "kanalhugget.parkedCar.v1";

export function loadParkedCar(): ParkedCar | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParkedCar;
    if (
      typeof parsed?.lat !== "number" ||
      typeof parsed?.lng !== "number" ||
      !parsed.savedAt
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveParkedCar(car: ParkedCar) {
  localStorage.setItem(KEY, JSON.stringify(car));
}

export function clearParkedCar() {
  localStorage.removeItem(KEY);
}
