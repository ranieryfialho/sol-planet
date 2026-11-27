import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { wahaFor } from "@sol/whatsapp";
import { cache } from "react";
import { readSession, SESSION_COOKIE } from "./session";

/** Sessão da requisição (o proxy já barra quem não está logado; aqui é a segunda trava). */
export const currentSession = cache(async () => readSession((await cookies()).get(SESSION_COOKIE)?.value));

/** Id da conta logada: tudo que o dashboard lê ou grava é filtrado por ele. */
export async function currentAccountId() {
  const s = await currentSession();
  if (!s) redirect("/login");
  return s.aid;
}

/** WhatsApp (sessão do WAHA) da conta logada. */
export async function currentWaha() {
  const s = await currentSession();
  if (!s) redirect("/login");
  return wahaFor(s.aid, s.sub);
}
