import type { Plant } from "@/lib/queries";
import { Icon } from "./ui";

const TZ = process.env.TZ ?? "America/Sao_Paulo";

// ---------- posição do sol (algoritmo do SunCalc: nascer e pôr do sol para a coordenada)
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

/** Ponto do arco (em % da cena) para a fração t do dia: nasce à direita (leste, mapa com norte para cima) e se põe à esquerda. */
function arcPoint(t: number, base: number, peak: number) {
  return { x: 94 - 88 * t, y: base - (base - peak) * Math.sin(Math.PI * t) };
}

// ---------- mapa (tiles do OpenStreetMap, sem chave; exige a atribuição na cena)
const TILE = 256;
const ZOOM = 16;

function tileOf(lat: number, lon: number) {
  const scale = 2 ** ZOOM;
  const x = ((lon + 180) / 360) * scale;
  const y = ((1 - Math.log(Math.tan(lat * RAD) + 1 / Math.cos(lat * RAD)) / Math.PI) / 2) * scale;
  return { x, y };
}

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

// estrelas fixas (posição em %), só à noite
const STARS = [
  [12, 14], [22, 30], [31, 9], [41, 22], [57, 12], [66, 27], [74, 8], [83, 19], [90, 33], [8, 38], [48, 36], [62, 40],
] as const;

/**
 * Cena animada no lugar da foto: mapa real da usina, pino com o endereço e o sol na posição do dia
 * (feixe até a usina enquanto gera). À noite, lua e estrelas. Tudo em CSS; respeita "reduzir movimento".
 */
export function PlantScene({ plant, pvW, compact = false }: { plant: Plant; pvW: number; compact?: boolean }) {
  const coords = plantCoords(plant)!;
  const address = plantAddress(plant);
  const now = new Date();

  const today = sunTimes(now, coords.lat, coords.lon);
  const isDay = now >= today.rise && now <= today.set;
  let t: number;
  if (isDay) {
    t = (now.valueOf() - today.rise.valueOf()) / (today.set.valueOf() - today.rise.valueOf());
  } else {
    // a lua percorre o mesmo arco entre o pôr e o próximo nascer
    const from = now > today.set ? today.set : sunTimes(new Date(now.valueOf() - DAY_MS), coords.lat, coords.lon).set;
    const to = now > today.set ? sunTimes(new Date(now.valueOf() + DAY_MS), coords.lat, coords.lon).rise : today.rise;
    t = (now.valueOf() - from.valueOf()) / (to.valueOf() - from.valueOf());
  }
  t = Math.min(1, Math.max(0, t));

  const base = compact ? 72 : 64;
  const peak = compact ? 16 : 14;
  const body = arcPoint(t, base, peak);
  const pin = { x: 50, y: compact ? 60 : 56 };
  const arc = Array.from({ length: 41 }, (_, i) => arcPoint(i / 40, base, peak))
    .map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`)
    .join(" ");

  const ratio = plant.capacityKwp ? Math.min(1, pvW / 1000 / plant.capacityKwp) : pvW > 0 ? 0.6 : 0;
  const generating = isDay && pvW > 0;

  const tile = tileOf(coords.lat, coords.lon);
  const cx = Math.floor(tile.x);
  const cy = Math.floor(tile.y);
  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  for (let j = -2; j <= 2; j++) {
    for (let i = -3; i <= 3; i++) {
      const x = cx + i;
      const y = cy + j;
      tiles.push({
        key: `${x}-${y}`,
        src: `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`,
        left: (x - tile.x) * TILE,
        top: (y - tile.y) * TILE,
      });
    }
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-surface-low" role="img" aria-label={address ? `Mapa da usina: ${address}` : "Mapa da usina"}>
      {/* mapa centrado na usina */}
      <div
        className="absolute transition-[filter] duration-1000"
        style={{ left: "50%", top: `${pin.y}%`, filter: isDay ? "saturate(0.85)" : "grayscale(0.4) brightness(0.8)" }}
      >
        {tiles.map((tl) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={tl.key} src={tl.src} alt="" width={TILE} height={TILE} loading="eager" draggable={false} className="absolute max-w-none select-none" style={{ left: tl.left, top: tl.top }} />
        ))}
      </div>

      {/* céu: claro de dia, azul-noite à noite */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDay ? "bg-gradient-to-b from-sky-soft/90 via-white/40 to-white/20" : "bg-gradient-to-b from-[#0b1530]/85 via-[#0b1530]/45 to-[#0b1530]/30"
        }`}
      />
      {!isDay &&
        STARS.map(([x, y], i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white motion-safe:animate-[twinkle_3s_ease-in-out_infinite]"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 5) * 0.6}s` }}
          />
        ))}

      {/* arco do dia e feixe de luz do sol até a usina */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={arc} fill="none" stroke={isDay ? "#f28c28" : "#ffffff"} strokeOpacity={isDay ? 0.7 : 0.35} strokeWidth={2} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
        {generating && (
          <line
            x1={body.x}
            y1={body.y}
            x2={pin.x}
            y2={pin.y}
            stroke="#f28c28"
            strokeOpacity={0.35 + 0.6 * ratio}
            strokeWidth={2 + 3 * ratio}
            strokeLinecap="round"
            strokeDasharray="6 8"
            vectorEffect="non-scaling-stroke"
            className="motion-safe:animate-[beam_1.2s_linear_infinite]"
          />
        )}
      </svg>

      {/* sol ou lua */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${body.x}%`, top: `${body.y}%` }}>
        {isDay ? (
          <div className="relative flex h-14 w-14 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-sun/30 motion-safe:animate-[glow_3s_ease-in-out_infinite]" />
            <Icon name="sunny" fill className="relative text-[44px] text-sun motion-safe:animate-[spin_24s_linear_infinite]" />
          </div>
        ) : (
          <div className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute inset-1 rounded-full bg-white/15 motion-safe:animate-[glow_4s_ease-in-out_infinite]" />
            <Icon name="dark_mode" fill className="relative text-[34px] text-[#fef3c7]" />
          </div>
        )}
      </div>

      {/* usina */}
      <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
        <div className="relative flex h-11 w-11 items-center justify-center">
          {generating && <span className="absolute inset-0 rounded-full bg-mint/50 motion-safe:animate-ping" />}
          <span className={`relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white shadow-card ${generating ? "bg-mint" : "bg-ink-2"}`}>
            <Icon name="solar_power" fill className="text-[22px] text-white" />
          </span>
        </div>
        {address && (
          <div className={`mt-2 flex items-start gap-1.5 rounded-xl bg-surface/95 px-3 py-2 shadow-card backdrop-blur ${compact ? "max-w-56" : "max-w-80"}`}>
            <Icon name="location_on" fill className="mt-px text-[16px] text-sun" />
            <div className="min-w-0">
              <p className={`text-[12px] font-medium leading-4 text-ink ${compact ? "truncate" : "line-clamp-2"}`}>{address}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-ink-2">
                nasce {hhmm(today.rise)} · põe {hhmm(today.set)}
              </p>
            </div>
          </div>
        )}
      </div>

      <span className={`absolute bottom-1 rounded bg-white/70 px-1.5 text-[9px] text-ink-2 ${compact ? "right-1" : "left-1/2 -translate-x-1/2"}`}>© OpenStreetMap</span>
    </div>
  );
}
