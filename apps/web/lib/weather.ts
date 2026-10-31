import "server-only";

export interface Weather {
  tempC: number;
  icon: string;
  label: string;
}

/** WMO weather code → ícone Material Symbols */
function iconFor(code: number, isDay: boolean): { icon: string; label: string } {
  if (code === 0) return isDay ? { icon: "sunny", label: "Céu limpo" } : { icon: "clear_night", label: "Céu limpo" };
  if (code <= 3) return { icon: isDay ? "partly_cloudy_day" : "partly_cloudy_night", label: "Parcialmente nublado" };
  if (code <= 48) return { icon: "foggy", label: "Neblina" };
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: "rainy", label: "Chuva" };
  if (code <= 77) return { icon: "weather_snowy", label: "Neve" };
  return { icon: "thunderstorm", label: "Tempestade" };
}

/** Clima atual na localização da usina (Open-Meteo, gratuito e sem chave). */
export async function getWeather(lat?: number | null, lon?: number | null): Promise<Weather | null> {
  if (lat == null || lon == null) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`;
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const { current } = (await res.json()) as { current: { temperature_2m: number; weather_code: number; is_day: number } };
    return { tempC: Math.round(current.temperature_2m), ...iconFor(current.weather_code, current.is_day === 1) };
  } catch {
    return null;
  }
}
