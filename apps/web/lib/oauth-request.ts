import "server-only";
import { findClient } from "@sol/db";
import { getDb } from "./db";

/** Confere o pedido de autorização (usado ao mostrar a tela e de novo ao decidir, pois o formulário pode ser adulterado). */
export async function validateAuthRequest(p: { client_id?: string; redirect_uri?: string }) {
  const client = p.client_id ? await findClient(getDb(), p.client_id) : undefined;
  if (!client) return { error: "Aplicativo desconhecido." } as const;
  // redirect_uri precisa ser exatamente uma das cadastradas: sem isso o código iria para qualquer endereço
  if (!p.redirect_uri || !client.redirectUris.includes(p.redirect_uri)) return { error: "Endereço de retorno não cadastrado para este aplicativo." } as const;
  return { client, redirectUri: p.redirect_uri } as const;
}
