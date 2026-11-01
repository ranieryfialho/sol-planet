import { currentSession } from "@/lib/account";

export const dynamic = "force-dynamic";

const KEY = process.env.GOOGLE_MAPS_API_KEY;

/** Estilo minimalista: sem rótulos nem pontos de interesse, tudo em tons de uma cor só (a cena desenha o resto por cima). */
const LIGHT = [
  "feature:all|element:labels|visibility:off",
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
  "feature:administrative|visibility:off",
  "feature:all|element:geometry|saturation:-85|lightness:8",
  "feature:landscape|element:geometry|color:0xeef2f7",
  "feature:road|element:geometry|color:0xffffff",
  "feature:road|element:geometry.stroke|visibility:off",
  "feature:water|element:geometry|color:0xd6e4f5",
];
const DARK = [
  "feature:all|element:labels|visibility:off",
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
  "feature:administrative|visibility:off",
  "feature:landscape|element:geometry|color:0x151c2e",
  "feature:road|element:geometry|color:0x25304a",
  "feature:road|element:geometry.stroke|visibility:off",
  "feature:water|element:geometry|color:0x0d1424",
];

/**
 * Mapa estático da usina para o fundo da cena. Passa por aqui (e não direto do navegador) para a chave do Google
 * ficar só no servidor e só quem está logado usar. Sem GOOGLE_MAPS_API_KEY responde 404 e a cena mantém o degradê.
 */
export async function GET(req: Request) {
  if (!KEY) return new Response(null, { status: 404 });
  if (!(await currentSession())) return new Response(null, { status: 401 });

  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return new Response(null, { status: 400 });
  const dark = q.get("tema") === "dark";

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${lat.toFixed(5)},${lon.toFixed(5)}`);
  url.searchParams.set("zoom", "16");
  url.searchParams.set("size", "640x400");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("key", KEY);
  for (const s of dark ? DARK : LIGHT) url.searchParams.append("style", s);

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return new Response(null, { status: 502 });
  return new Response(res.body, { headers: { "content-type": res.headers.get("content-type") ?? "image/png", "cache-control": "private, max-age=86400" } });
}
