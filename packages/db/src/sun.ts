// nascer e pôr do sol para uma coordenada (algoritmo do SunCalc)
const RAD = Math.PI / 180;
const DAY_MS = 864e5;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

export function sunTimes(date: Date, lat: number, lon: number) {
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

/** HH:MM no fuso configurado (TZ), no formato 24h dos campos de horário. */
export function hhmm24(d: Date, timeZone = process.env.TZ ?? "America/Sao_Paulo") {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });
}
