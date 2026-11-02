import "server-only";

/** Endereço público do app (atrás do reverse proxy): APP_URL, ou o que o proxy encaminhou. */
export function publicBaseUrl(h: Headers, fallback?: URL) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? fallback?.protocol.replace(":", "") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? fallback?.host ?? "localhost";
  return `${proto}://${host}`;
}

export const baseUrl = (req: Request) => publicBaseUrl(req.headers, new URL(req.url));

/** Endpoints do OAuth e do MCP não usam cookie, então CORS aberto é seguro (clientes de IA no navegador precisam). */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "www-authenticate, mcp-session-id",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...CORS, "cache-control": "no-store", ...extra } });
}

export const oauthError = (error: string, description: string, status = 400) => json({ error, error_description: description }, status);

/** Limite de tentativas por IP e rota (memória do processo, como o do login). */
const hits = new Map<string, { n: number; until: number }>();
export function limited(req: Request, route: string, max: number, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${route}:${ip}`;
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || rec.until <= now) {
    hits.set(key, { n: 1, until: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
    return false;
  }
  rec.n += 1;
  return rec.n > max;
}
