import { accountKey, alerts, getKv, getSettings, kv, listAccounts, plantIdsOf, readings } from "@sol/db";
import { evolutionFor } from "@sol/whatsapp";
import { inArray, max } from "drizzle-orm";
import { getDb } from "./db";

const CHECK_MS = 5 * 60_000;

/**
 * Vigia de "sem dados": roda no processo web porque o worker não consegue avisar que ele mesmo parou.
 * Se nenhuma leitura nova chegou em N minutos (regra staleMinutes de cada conta), avisa no WhatsApp
 * e avisa de novo quando os dados voltam.
 */
async function check() {
  const db = getDb();
  for (const acc of await listAccounts(db)) {
    const settings = await getSettings(db, acc.id);
    if (!settings.rules.staleData) continue;
    const own = await plantIdsOf(db, acc.id);
    if (!own.length) continue;
    const ids = own.map((p) => p.id);
    const [{ last }] = await db.select({ last: max(readings.ts) }).from(readings).where(inArray(readings.plantId, ids));
    if (!last) continue;

    const minutes = Math.round((Date.now() - last.getTime()) / 60_000);
    const stale = minutes >= settings.rules.staleMinutes;
    const key = accountKey("stale", acc.id);
    const alerted = (await getKv<boolean>(db, key)) === true;
    if (stale === alerted) continue;

    const msg = stale
      ? `🛑 Sem dados novos da usina há ${minutes} min\nO coletor ou a API da Solplanet podem estar parados. Os números do dashboard estão desatualizados.`
      : "✅ Os dados da usina voltaram a chegar.";
    await send(acc.id, acc.account, msg, settings.recipients);
    const now = new Date();
    if (stale) await db.insert(alerts).values({ plantId: ids[0], accountId: acc.id, kind: "stale_data", message: msg, occurredAt: now, notifiedAt: now });
    await db.insert(kv).values({ key, value: stale }).onConflictDoUpdate({ target: kv.key, set: { value: stale, updatedAt: now } });
  }
}

async function send(accountId: number, login: string, text: string, recipients: { to: string; name: string; enabled: boolean }[]) {
  const evolution = evolutionFor(accountId, login);
  const targets = recipients.filter((r) => r.enabled);
  if (!evolution.configured || !targets.length) return console.log(`[whatsapp desativado]\n${text}`);
  for (const r of targets) {
    try {
      await evolution.sendText(r.to, text);
    } catch (e) {
      console.error(`watchdog: falha ao enviar para ${r.name}:`, e);
    }
  }
}

export function startWatchdog() {
  const g = globalThis as unknown as { __watchdog?: boolean };
  if (g.__watchdog) return; // o dev recarrega módulos: um único timer
  g.__watchdog = true;
  const run = () => check().catch((e) => console.error("watchdog falhou:", e));
  setTimeout(run, 2 * 60_000);
  setInterval(run, CHECK_MS).unref?.();
}
