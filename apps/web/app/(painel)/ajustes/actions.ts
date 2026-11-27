"use server";

import { getSettings, saveSettings, type Settings } from "@sol/db";
import type { WaContact } from "@sol/whatsapp";
import { revalidatePath } from "next/cache";
import { currentAccountId, currentWaha } from "@/lib/account";
import { getDb } from "@/lib/db";

/** WhatsApp da conta logada: cada conta pareia o próprio número (sessão própria). */
const wa = currentWaha;

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valida e grava as configurações (o worker lê no próximo ciclo). */
export async function updateSettings(next: Settings) {
  const clean: Settings = {
    recipients: next.recipients
      .map((r) => ({ ...r, name: r.name.trim().slice(0, 60), to: r.to.trim().replace(/[^\d@.a-z-]/gi, "") }))
      .filter((r) => r.to),
    rules: {
      ...next.rules,
      offlineMinutes: Math.min(240, Math.max(5, Math.round(Number(next.rules.offlineMinutes) || 20))),
      dayAuto: next.rules.dayAuto !== false,
      noStartMinutes: clamp(next.rules.noStartMinutes, 30, 240, 90),
      warningMinutes: clamp(next.rules.warningMinutes, 0, 120, 0),
      cycleStart: Boolean(next.rules.cycleStart),
      cycleEnd: Boolean(next.rules.cycleEnd),
      cycleEndInReport: Boolean(next.rules.cycleEndInReport),
      dayStart: HHMM.test(next.rules.dayStart) ? next.rules.dayStart : "07:00",
      dayEnd: HHMM.test(next.rules.dayEnd) ? next.rules.dayEnd : "17:00",
      lowGenerationPct: clamp(next.rules.lowGenerationPct, 5, 90, 20),
      lowCapacityPct: clamp(next.rules.lowCapacityPct, 5, 90, 20),
      zeroGenerationMinutes: clamp(next.rules.zeroGenerationMinutes, 10, 180, 30),
      stringImbalancePct: clamp(next.rules.stringImbalancePct, 10, 90, 40),
      gridImportKwh: clamp(next.rules.gridImportKwh, 0, 1000, 0),
      monthlyPct: clamp(next.rules.monthlyPct, 5, 90, 15),
      staleMinutes: clamp(next.rules.staleMinutes, 6, 240, 30),
    },
    report: { enabled: Boolean(next.report.enabled), time: HHMM.test(next.report.time) ? next.report.time : "19:00" },
    tariff: Math.max(0, Number(next.tariff) || 0),
  };
  await saveSettings(getDb(), await currentAccountId(), clean);
  revalidatePath("/", "layout");
  return clean;
}

export async function sendTest(): Promise<{ ok: boolean; message: string }> {
  const waha = await wa();
  if (!waha.configured) return { ok: false, message: "WAHA_API_KEY não configurada." };
  if ((await waha.state()).state !== "open") return { ok: false, message: "Conecte o WhatsApp antes de testar." };
  const { recipients } = await getSettings(getDb(), await currentAccountId());
  const { targets, self } = await waha.resolveTargets(recipients);
  if (!targets.length) return { ok: false, message: "Nenhum destinatário ativo." };
  const errors: string[] = [];
  for (const r of targets) {
    try {
      await waha.sendText(r.to, "👋 Teste do monitor Solar: as notificações estão funcionando.");
    } catch {
      errors.push(r.name);
    }
  }
  return errors.length
    ? { ok: false, message: `Falhou para: ${errors.join(", ")}` }
    : { ok: true, message: self ? "Enviado para o seu próprio número (nenhum destinatário cadastrado)." : `Enviado para ${targets.length} destinatário(s).` };
}

/** Cria a sessão da conta se preciso e devolve o QR code para parear o número dela. */
export async function connectWhatsApp(): Promise<{ qr?: string; state: string; error?: string }> {
  const waha = await wa();
  if (!waha.configured) return { state: "unknown", error: "WAHA_API_KEY não configurada." };
  try {
    return await waha.connect();
  } catch (e) {
    return { state: "unknown", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function whatsappState() {
  return (await wa()).state();
}

export async function disconnectWhatsApp(): Promise<{ ok: boolean; message: string }> {
  try {
    await (await wa()).logout();
    return { ok: true, message: "WhatsApp desconectado." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Contatos da agenda do número pareado (rápido: < 1 s). Os grupos vêm de /api/whatsapp/groups, que é lento. */
export async function listContacts(): Promise<WaContact[]> {
  const waha = await currentWaha();
  if (!waha.configured) return [];
  return waha.listContacts().catch(() => []);
}
