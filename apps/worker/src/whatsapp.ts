import { getKv, kv, type Db, type Recipient, type Settings } from "@sol/db";
import { wahaFor } from "@sol/whatsapp";

/** Conta que envia: o login dá nome legível à sessão do WAHA. */
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
  const active = settings.recipients.filter((x) => x.enabled);
  // sem destinatários, vai para o próprio número conectado (a duplicata entre contas não existe: o número é de cada conta)
  if (!active.length) return send(who, text, []);
  const fresh: Recipient[] = [];
  for (const r of active) {
    const key = `sent|${r.to}|${plantId}|${kind}`;
    const last = await getKv<number>(db, key);
    if (last && Date.now() - last < DEDUPE_MS) continue;
    await db.insert(kv).values({ key, value: Date.now() }).onConflictDoUpdate({ target: kv.key, set: { value: Date.now(), updatedAt: new Date() } });
    fresh.push(r);
  }
  // todos já receberam há pouco: não cai no número próprio
  if (fresh.length) await send(who, text, fresh);
}

/** Envia texto para os destinatários ativos da conta, pelo WhatsApp dela. Sem WAHA configurado, só loga. */
export async function notify(who: Who, text: string, settings: Settings) {
  await send(who, text, settings.recipients);
}

async function send(who: Who, text: string, recipients: Recipient[]) {
  const waha = wahaFor(who.id, who.login);
  if (!waha.configured) {
    console.log(`[whatsapp desativado]\n${text}`);
    return;
  }
  const { targets } = await waha.resolveTargets(recipients);
  if (!targets.length) {
    console.log(`[sem destinatário e WhatsApp desconectado]\n${text}`);
    return;
  }
  for (const r of targets) {
    try {
      await waha.sendText(r.to, text);
    } catch (e) {
      console.error(`falha ao enviar para ${r.name}:`, e);
    }
  }
}
