"use server";

import { revokeConnection } from "@sol/db";
import { revalidatePath } from "next/cache";
import { currentAccountId } from "@/lib/account";
import { getDb } from "@/lib/db";

/** Desconecta um app de IA da conta logada: apaga os tokens dele, e o app perde o acesso na hora. */
export async function disconnect(form: FormData) {
  const clientId = String(form.get("client_id") ?? "");
  if (!clientId) return;
  await revokeConnection(getDb(), await currentAccountId(), clientId);
  revalidatePath("/conectar-ia");
}
