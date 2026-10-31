import type { Plant } from "@/lib/queries";
import { House3D, type House3DProps, type SceneLabel } from "./house-3d";

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

const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** Endereço digitado no app da Solplanet (vem na lista de usinas), sem o país no fim. */
export function plantAddress(plant: Plant) {
  const street = (plant.raw as { street?: unknown } | null)?.street;
  return typeof street === "string" && street.trim() ? street.replace(/[,\s]*Brazil\s*$/i, "").trim() : null;
}

export function plantCoords(plant: Plant) {
  const raw = plant.raw as { latitude?: unknown; longitude?: unknown } | null;
  const lat = plant.latitude ?? Number(raw?.latitude);
  const lon = plant.longitude ?? Number(raw?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : null;
}

export type { SceneLabel };

/**
 * Cena da home: casa em 3D com a energia correndo nos fios (ver house-3d.tsx). Aqui, no servidor, ficam o
 * dia/noite pelo nascer e pôr do sol da coordenada da usina e o endereço.
 */
export function PlantScene({
  plant,
  pvW,
  labels,
  inverterOk,
  compact = false,
  preview = false,
}: {
  plant: Plant;
  pvW: number;
  labels: House3DProps["labels"];
  inverterOk: boolean;
  compact?: boolean;
  /** ?simular=1: cena de dia gerando ~70% da capacidade, só para ver a animação (os números continuam reais) */
  preview?: boolean;
}) {
  const coords = plantCoords(plant);
  const now = new Date();
  const sun = coords ? sunTimes(now, coords.lat, coords.lon) : null;
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }));
  const isDay = preview || (sun ? now >= sun.rise && now <= sun.set : hour >= 6 && hour < 18);
  if (preview) pvW = Math.max(pvW, (plant.capacityKwp ?? 5) * 700);
  const ratio = plant.capacityKwp ? Math.min(1, pvW / 1000 / plant.capacityKwp) : pvW > 0 ? 0.5 : 0;
  const address = plantAddress(plant);

  return (
    <House3D
      pvW={pvW}
      ratio={ratio}
      isDay={isDay}
      inverterOk={inverterOk}
      labels={labels}
      address={address}
      sunLine={sun ? `☀ ${hhmm(sun.rise)}–${hhmm(sun.set)}` : null}
      compact={compact}
      preview={preview}
      ariaLabel={`Casa com painéis solares${pvW > 0 ? ", gerando agora" : ", sem geração no momento"}${address ? `. ${address}` : ""}`}
    />
  );
}
