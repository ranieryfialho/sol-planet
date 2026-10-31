"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { decryptSecret, findAccount, listAccounts, maxAccounts, normalizeAccount, upsertAccount } from "@sol/db";
import { SolplanetClient, SolplanetError, type Region } from "@sol/solplanet";
import { getDb } from "@/lib/db";
import { createSession, sameSecret, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export interface LoginState {
  error?: string;
  account?: string;
}

/** Limite simples de tentativas por IP (memória do processo). */
const attempts = new Map<string, { n: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60_000;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

async function isHttps() {
  const h = await headers();
  return h.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || (h.get("origin") ?? "").startsWith("https://");
}

/** Só aceita caminhos internos como destino depois do login. */
const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/");

type Auth = { id: number; account: string } | { error: string; countAttempt: boolean };

/**
 * Conta conhecida com a mesma senha guardada: entra sem tocar na API da Solplanet.
 * Conta nova (ou senha trocada): valida no login da Solplanet e guarda a senha cifrada para o worker coletar.
 */
async function authenticate(account: string, password: string): Promise<Auth> {
  const db = getDb();
  const known = await findAccount(db, account);
  if (known) {
    const stored = decryptSecret(known.passwordEnc);
    if (stored !== null && sameSecret(stored, password)) return { id: known.id, account: known.account };
  } else if ((await listAccounts(db)).length >= maxAccounts()) {
    return { error: `Limite de ${maxAccounts()} contas atingido. Fale com o administrador.`, countAttempt: false };
  }

  try {
    const client = new SolplanetClient((process.env.SOLPLANET_REGION ?? "singapore") as Region, process.env.SOLPLANET_LOCALE ?? "en");
    await client.login(normalizeAccount(account), password);
  } catch (e) {
    // apiCode = a Solplanet respondeu e recusou; sem ele foi rede ou gateway
    return e instanceof SolplanetError && e.apiCode !== undefined
      ? { error: "Conta ou senha incorretas. Use o mesmo login do app Solplanet.", countAttempt: true }
      : { error: "Não consegui falar com a Solplanet agora. Tente de novo em instantes.", countAttempt: false };
  }
  const row = await upsertAccount(db, account, password);
  return { id: row.id, account: row.account };
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const account = String(form.get("account") ?? "");
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  const now = Date.now();
  const rec = attempts.get(ip);

  if (rec && rec.until > now && rec.n >= MAX_ATTEMPTS) {
    const min = Math.ceil((rec.until - now) / 60_000);
    return { account, error: `Muitas tentativas. Tente de novo em ${min} min.` };
  }
  if (!account || !password) return { account, error: "Preencha e-mail ou telefone e senha." };

  const auth = await authenticate(account, password);
  if ("error" in auth) {
    if (auth.countAttempt) {
      const fresh = !rec || rec.until <= now;
      attempts.set(ip, { n: fresh ? 1 : rec.n + 1, until: fresh ? now + WINDOW_MS : rec.until });
    }
    return { account, error: auth.error };
  }

  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, createSession(auth.account, auth.id), {
    httpOnly: true,
    sameSite: "lax",
    // secure só quando chegou por HTTPS (atrás do reverse proxy); em http://IP:3000 o cookie não seria gravado
    secure: await isHttps(),
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
