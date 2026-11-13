import * as SunCalc from "suncalc";

/** SMHI forecast point / Malmö centrum */
export const MALMO_LAT = 55.605;
export const MALMO_LON = 12.995;

export type MalmoSunTimes = {
  sunrise: Date;
  sunset: Date;
  dawn: Date;
  dusk: Date;
};

function requireDate(value: Date | null, fallback: Date): Date {
  return value ?? fallback;
}

export function malmoSunTimes(date = new Date()): MalmoSunTimes {
  const t = SunCalc.getTimes(date, MALMO_LAT, MALMO_LON);
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  return {
    sunrise: requireDate(t.sunrise, noon),
    sunset: requireDate(t.sunset, noon),
    dawn: requireDate(t.dawn, noon),
    dusk: requireDate(t.dusk, noon),
  };
}

/** After sunset or before sunrise (local time). */
export function isMalmoDarkHours(date = new Date()): boolean {
  const { sunrise, sunset } = malmoSunTimes(date);
  const now = date.getTime();
  return now >= sunset.getTime() || now < sunrise.getTime();
}

/** ~75 minutes before sunset until sunset. */
export function isMalmoGoldenHour(date = new Date()): boolean {
  const { sunset } = malmoSunTimes(date);
  const start = sunset.getTime() - 75 * 60 * 1000;
  const now = date.getTime();
  return now >= start && now < sunset.getTime();
}

export function fmtSunClock(d: Date): string {
  return d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
