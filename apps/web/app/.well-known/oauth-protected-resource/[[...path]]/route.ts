import { baseUrl, json, preflight } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

/** RFC 9728: diz ao cliente de IA qual servidor de autorização protege o /mcp. */
export function GET(req: Request) {
  const base = baseUrl(req);
  return json({ resource: `${base}/mcp`, authorization_servers: [base], bearer_methods_supported: ["header"], scopes_supported: ["mcp"] });
}

export const OPTIONS = preflight;
