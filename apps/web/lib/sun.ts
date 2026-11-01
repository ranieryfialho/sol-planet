import "server-only";

const TZ = process.env.TZ ?? "America/Sao_Paulo";

// ---------- nascer e pôr do sol para a coordenada (algoritmo do SunCalc)
const RAD = Math.PI / 180;
const DAY_MS = 864e5;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

function sunTimes(date: Date, lat: number, lon: number) {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
  const cycle = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const transit = (ht: number) => 0.0009 + (ht + lw) / (2 * Math.PI) + cycle;
  const ds = transit(0);
  const m = RAD * (357.5291 + 0.98560028 * ds);
  const l = m + RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
  const solarJ = (x: number) => J2000 + x + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  const w = Math.acos((Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const noon = solarJ(ds);
  const set = solarJ(transit(w));
  const toDate = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
  return { rise: toDate(noon - (set - noon)), set: toDate(set) };
}

export const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

export interface SunState {
  isDay: boolean;
  /** nascer e pôr do sol de hoje; null sem coordenada (cai no 6h–18h) */
  rise: Date | null;
  set: Date | null;
}

/** Dia ou noite agora, pelo sol da coordenada da usina (sem coordenada, 6h–18h no fuso configurado). */
export function sunState(coords: { lat: number; lon: number } | null, now = new Date()): SunState {
  if (coords) {
    const { rise, set } = sunTimes(now, coords.lat, coords.lon);
    if (!Number.isNaN(rise.getTime()) && !Number.isNaN(set.getTime())) return { isDay: now >= rise && now <= set, rise, set };
  }
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }));
  return { isDay: hour >= 6 && hour < 18, rise: null, set: null };
}
