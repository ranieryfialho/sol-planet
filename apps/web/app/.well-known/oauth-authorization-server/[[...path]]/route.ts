import { baseUrl, json, preflight } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

/** RFC 8414: onde ficam o registro, a autorização e o token. */
export function GET(req: Request) {
  const base = baseUrl(req);
  return json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  });
}

export const OPTIONS = preflight;
