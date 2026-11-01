import type { Plant } from "@/lib/queries";
import { House3D, type House3DProps, type SceneLabel } from "./house-3d";

import { hhmm, sunState } from "@/lib/sun";

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
  const sun = sunState(coords);
  const isDay = preview || sun.isDay;
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
      sunLine={sun.rise && sun.set ? `☀ ${hhmm(sun.rise)}–${hhmm(sun.set)}` : null}
      coords={coords}
      compact={compact}
      preview={preview}
      ariaLabel={`Casa com painéis solares${pvW > 0 ? ", gerando agora" : ", sem geração no momento"}${address ? `. ${address}` : ""}`}
    />
  );
}
