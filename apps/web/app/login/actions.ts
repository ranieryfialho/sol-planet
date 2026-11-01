"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { decryptSecret, findAccount, isProvider, listAccounts, maxAccounts, normalizeAccount, upsertAccount, type Provider } from "@sol/db";
import { LivoltekClient, LivoltekError, type Server } from "@sol/livoltek";
import { SolplanetClient, SolplanetError, type Region } from "@sol/solplanet";
import { getDb } from "@/lib/db";
import { createSession, sameSecret, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export interface LoginState {
  error?: string;
  account?: string;
  provider?: Provider;
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
type Check = "ok" | "rejected" | "unreachable" | { message: string };

const NAMES: Record<Provider, string> = { solplanet: "Solplanet", livoltek: "Livoltek" };
const APPS: Record<Provider, string> = { solplanet: "app Solplanet", livoltek: "app My Livoltek" };

/** Valida a senha no login do próprio fornecedor. */
async function checkLogin(provider: Provider, account: string, password: string): Promise<Check> {
  if (provider === "livoltek") {
    try {
      const client = new LivoltekClient((process.env.LIVOLTEK_SERVER ?? "international") as Server, "en", process.env.TZ ?? "America/Sao_Paulo");
      await client.login(account, password);
      return "ok";
    } catch (e) {
      if (!(e instanceof LivoltekError) || !e.code) return "unreachable";
      // depois de várias senhas erradas a Livoltek passa a exigir captcha, que só o app/portal resolve
      if (e.code === "no.token" || e.code.includes("verify")) {
        return { message: "A Livoltek pediu verificação extra (captcha) para esta conta. Entre uma vez no app My Livoltek e tente de novo aqui." };
      }
      return "rejected";
    }
  }
  try {
    const client = new SolplanetClient((process.env.SOLPLANET_REGION ?? "singapore") as Region, process.env.SOLPLANET_LOCALE ?? "en");
    await client.login(account, password);
    return "ok";
  } catch (e) {
    // apiCode = a Solplanet respondeu e recusou; sem ele foi rede ou gateway
    return e instanceof SolplanetError && e.apiCode !== undefined ? "rejected" : "unreachable";
  }
}

/**
 * Conta conhecida com a mesma senha guardada: entra sem tocar na API do fornecedor.
 * Conta nova (ou senha trocada): valida no login do fornecedor e guarda a senha cifrada para o worker coletar.
 */
async function authenticate(provider: Provider, account: string, password: string): Promise<Auth> {
  const db = getDb();
  const known = await findAccount(db, account, provider);
  if (known) {
    const stored = decryptSecret(known.passwordEnc);
    if (stored !== null && sameSecret(stored, password)) return { id: known.id, account: known.account };
  } else if ((await listAccounts(db)).length >= maxAccounts()) {
    return { error: `Limite de ${maxAccounts()} contas atingido. Fale com o administrador.`, countAttempt: false };
  }

  const check = await checkLogin(provider, normalizeAccount(account), password);
  if (check === "rejected") return { error: `Conta ou senha incorretas. Use o mesmo login do ${APPS[provider]}.`, countAttempt: true };
  if (check === "unreachable") return { error: `Não consegui falar com a ${NAMES[provider]} agora. Tente de novo em instantes.`, countAttempt: false };
  if (check !== "ok") return { error: check.message, countAttempt: false };
  const row = await upsertAccount(db, account, password, provider);
  return { id: row.id, account: row.account };
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const account = String(form.get("account") ?? "");
  const password = String(form.get("password") ?? "");
  const rawProvider = form.get("provider");
  const provider: Provider = isProvider(rawProvider) ? rawProvider : "solplanet";
  const ip = await clientIp();
  const now = Date.now();
  const rec = attempts.get(ip);

  if (rec && rec.until > now && rec.n >= MAX_ATTEMPTS) {
    const min = Math.ceil((rec.until - now) / 60_000);
    return { account, provider, error: `Muitas tentativas. Tente de novo em ${min} min.` };
  }
  if (!account || !password) return { account, provider, error: "Preencha o login e a senha." };

  const auth = await authenticate(provider, account, password);
  if ("error" in auth) {
    if (auth.countAttempt) {
      const fresh = !rec || rec.until <= now;
      attempts.set(ip, { n: fresh ? 1 : rec.n + 1, until: fresh ? now + WINDOW_MS : rec.until });
    }
    return { account, provider, error: auth.error };
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
