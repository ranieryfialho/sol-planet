import { registerClient } from "@sol/db";
import { getDb } from "@/lib/db";
import { json, limited, oauthError, preflight } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:", "about:", "blob:"]);

/** https, http só em localhost (apps de terminal) ou esquema próprio do app (ex.: cursor://). */
function validRedirect(uri: unknown) {
  if (typeof uri !== "string" || uri.length > 500) return false;
  try {
    const u = new URL(uri);
    if (BLOCKED_SCHEMES.has(u.protocol) || u.hash) return false;
    if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    return true;
  } catch {
    return false;
  }
}

/** RFC 7591: o app de IA se cadastra sozinho. Clientes públicos (sem secret); a segurança vem do PKCE e do login do usuário. */
export async function POST(req: Request) {
  if (limited(req, "register", 10)) return oauthError("too_many_requests", "Muitas tentativas. Tente de novo em instantes.", 429);
  const body = (await req.json().catch(() => null)) as { client_name?: unknown; redirect_uris?: unknown } | null;
  const uris = body?.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 5 || !uris.every(validRedirect)) {
    // diagnóstico: mostra o que o app de IA mandou (só endereços e nomes de campos, nada secreto)
    console.warn("[oauth/register] recusado", JSON.stringify({ client_name: body?.client_name, redirect_uris: uris, campos: body ? Object.keys(body) : null, ua: req.headers.get("user-agent") }).slice(0, 1500));
    return oauthError("invalid_redirect_uri", "redirect_uris inválido.");
  }
  const name = typeof body?.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 80) : "App de IA";
  const client = await registerClient(getDb(), name, uris as string[]);
  console.info("[oauth/register] ok", JSON.stringify({ name, redirect_uris: uris }));
  return json(
    {
      client_id: client.id,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    201,
  );
}

export const OPTIONS = preflight;
