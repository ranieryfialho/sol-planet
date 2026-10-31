import { appSecret } from "@sol/db";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sessão sem banco: cookie assinado com HMAC (conta + id da conta + validade).
 * Cada pessoa entra com a própria conta Solplanet (ver app/login/actions.ts).
 */
export const SESSION_COOKIE = "solar_session";
export const SESSION_DAYS = 30;

const secret = () => createHash("sha256").update(`solar-session:${appSecret()}`).digest("hex");

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export const sameSecret = (a: string, b: string) => {
  // compara hashes de tamanho fixo para não vazar tamanho nem tempo
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
};

export function createSession(account: string, aid: number) {
  const payload = Buffer.from(JSON.stringify({ sub: account, aid, exp: Date.now() + SESSION_DAYS * 86400_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token?: string): { sub: string; aid: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !sameSecret(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; aid?: number; exp: number };
    // cookie sem aid é do tempo de conta única: pede login de novo
    return data.exp > Date.now() && typeof data.aid === "number" ? { sub: data.sub, aid: data.aid } : null;
  } catch {
    return null;
  }
}
