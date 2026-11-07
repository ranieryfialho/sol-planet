import Link from "next/link";
import type { Plant } from "@/lib/queries";
import type { Weather } from "@/lib/weather";
import { Icon, LivePill, Pill } from "./ui";

function WeatherPill({ w, city }: { w: Weather; city?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 shadow-pill backdrop-blur-md" title={w.label}>
      <Icon name={w.icon} fill className="text-[18px] text-sun" />
      <span className="text-sm font-bold">{w.tempC}°C</span>
      {city && <span className="hidden text-xs text-ink-2 lg:inline">{city}</span>}
    </span>
  );
}

/** Nome da usina + status de rede + clima (topo do Início). */
export function TopBar({ plant, weather }: { plant: Plant; weather: Weather | null }) {
  const detail = (plant.detail ?? {}) as { city?: string; provinceStr?: string };
  const city = [detail.city, detail.provinceStr].filter(Boolean).join(", ") || undefined;
  const online = plant.status !== 0;
  return (
    <>
      {/* mobile */}
      <div className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-lg font-semibold">
            {plant.name}
            <Icon name="keyboard_arrow_down" className="text-[20px] text-ink-2" />
          </span>
          {weather && <WeatherPill w={weather} />}
        </div>
        <div className="flex items-center justify-between">
          <Pill tone={online ? "mint" : "sun-soft"} icon={online ? "bolt" : "wifi_off"} className="uppercase tracking-wider">
            {online ? "On Grid" : "Offline"}
          </Pill>
          <LivePill />
        </div>
      </div>

      {/* desktop */}
      <div className="hidden items-center justify-between lg:flex">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-pill">
            <Icon name="location_on" className="text-[20px]" />
            <span className="text-lg font-semibold">{plant.name}</span>
          </span>
          <Pill tone={online ? "mint" : "sun-soft"} icon={online ? "power" : "wifi_off"}>
            {online ? "Conectado à Rede" : "Offline"}
          </Pill>
          <LivePill label="Ao Vivo" />
        </div>
        <div className="flex items-center gap-3">
          {weather && <WeatherPill w={weather} city={city} />}
          <Link href="/alertas" aria-label="Alertas" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-pill">
            <Icon name="notifications" className="text-[20px]" />
          </Link>
        </div>
      </div>
    </>
  );
}
