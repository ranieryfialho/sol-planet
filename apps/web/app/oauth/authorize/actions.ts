"use server";

import { createAuthCode } from "@sol/db";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/account";
import { getDb } from "@/lib/db";
import { validateAuthRequest } from "@/lib/oauth-request";

/** Volta ao app de IA (depois que o redirect_uri já foi validado, erros também vão por lá, como manda o OAuth). */
function back(redirectUri: string, params: Record<string, string>, state: string): never {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

export async function decide(form: FormData) {
  const session = await currentSession();
  if (!session) redirect("/login");

  const get = (k: string) => String(form.get(k) ?? "");
  const state = get("state");
  const v = await validateAuthRequest({ client_id: get("client_id"), redirect_uri: get("redirect_uri") });
  if (!v.client) redirect(`/oauth/authorize/erro?m=${encodeURIComponent(v.error ?? "Pedido inválido.")}`);

  if (get("decision") !== "allow") back(v.redirectUri, { error: "access_denied" }, state);

  const challenge = get("code_challenge");
  if (get("code_challenge_method") !== "S256" || challenge.length < 43) {
    back(v.redirectUri, { error: "invalid_request", error_description: "PKCE S256 é obrigatório" }, state);
  }

  const code = await createAuthCode(getDb(), { clientId: v.client.id, accountId: session.aid, redirectUri: v.redirectUri, codeChallenge: challenge });
  back(v.redirectUri, { code }, state);
}
