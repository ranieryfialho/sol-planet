import { createHash } from "node:crypto";
import { findClient, issueTokens, rotateRefresh, takeAuthCode } from "@sol/db";
import { getDb } from "@/lib/db";
import { sameSecret } from "@/lib/session";
import { json, limited, oauthError, preflight } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

/** RFC 6749 §3.2: troca código (com PKCE) ou refresh token por tokens. */
export async function POST(req: Request) {
  if (limited(req, "token", 30)) return oauthError("too_many_requests", "Muitas tentativas. Tente de novo em instantes.", 429);
  const form = new URLSearchParams(await req.text());
  const clientId = form.get("client_id") ?? "";
  const db = getDb();
  if (!clientId || !(await findClient(db, clientId))) return oauthError("invalid_client", "client_id desconhecido.", 401);

  const grant = form.get("grant_type");
  if (grant === "authorization_code") {
    const code = form.get("code") ?? "";
    const verifier = form.get("code_verifier") ?? "";
    const row = code ? await takeAuthCode(db, code) : null; // uso único: apaga já na primeira tentativa
    if (!row || row.clientId !== clientId || row.redirectUri !== form.get("redirect_uri")) return oauthError("invalid_grant", "Código inválido ou vencido.");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    if (verifier.length < 43 || !sameSecret(challenge, row.codeChallenge)) return oauthError("invalid_grant", "code_verifier não confere.");
    return json(await issueTokens(db, clientId, row.accountId));
  }

  if (grant === "refresh_token") {
    const tokens = await rotateRefresh(db, form.get("refresh_token") ?? "", clientId);
    return tokens ? json(tokens) : oauthError("invalid_grant", "Refresh token inválido ou vencido.");
  }

  return oauthError("unsupported_grant_type", "Use authorization_code ou refresh_token.");
}

export const OPTIONS = preflight;
