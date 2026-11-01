import "server-only";
import { sunTimes } from "@sol/db";

const TZ = process.env.TZ ?? "America/Sao_Paulo";


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
