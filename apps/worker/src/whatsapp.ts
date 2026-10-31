import { getKv, kv, type Db, type Recipient, type Settings } from "@sol/db";
import { evolutionFor } from "@sol/whatsapp";

/** Conta que envia: o login dá nome legível à instância da Evolution. */
export interface Who {
  id: number;
  login: string;
}

const DEDUPE_MS = 10 * 60_000;

/**
 * Alerta de uma usina para os destinatários da conta que o disparou. Se o mesmo número ou grupo estiver
 * cadastrado em duas contas da mesma usina (ex.: o grupo da família), ele recebe uma mensagem só:
 * o envio fica registrado por (destinatário, usina, tipo) e repetições em até 10 min são descartadas.
 */
export async function notifyAlert(db: Db, who: Who, settings: Settings, plantId: number, kind: string, text: string) {
  const fresh: Recipient[] = [];
  for (const r of settings.recipients.filter((x) => x.enabled)) {
    const key = `sent|${r.to}|${plantId}|${kind}`;
    const last = await getKv<number>(db, key);
    if (last && Date.now() - last < DEDUPE_MS) continue;
    await db.insert(kv).values({ key, value: Date.now() }).onConflictDoUpdate({ target: kv.key, set: { value: Date.now(), updatedAt: new Date() } });
    fresh.push(r);
  }
  await send(who, text, fresh);
}

/** Envia texto para os destinatários ativos da conta, pelo WhatsApp dela. Sem Evolution configurada, só loga. */
export async function notify(who: Who, text: string, settings: Settings) {
  await send(who, text, settings.recipients);
}

async function send(who: Who, text: string, recipients: Recipient[]) {
  const evolution = evolutionFor(who.id, who.login);
  const targets = recipients.filter((r) => r.enabled);
  if (!evolution.configured || !targets.length) {
    console.log(`[whatsapp desativado]\n${text}`);
    return;
  }
  for (const r of targets) {
    try {
      await evolution.sendText(r.to, text);
    } catch (e) {
      console.error(`falha ao enviar para ${r.name}:`, e);
    }
  }
}
