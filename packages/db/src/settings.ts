import { eq } from "drizzle-orm";
import type { Db } from "./index";
import { kv } from "./schema";

export interface Recipient {
  id: string;
  name: string;
  /** número (5511999999999) ou JID de grupo (...@g.us) */
  to: string;
  enabled: boolean;
}

/** Configurações editáveis pelo dashboard (tela Ajustes), lidas pelo worker a cada ciclo. */
export interface Settings {
  recipients: Recipient[];
  rules: {
    offline: boolean;
    offlineMinutes: number;
    /** só considera offline como falha dentro da janela */
    daylightOnly: boolean;
    dayStart: string;
    dayEnd: string;
    inverterErrors: boolean;
    recovered: boolean;
    /** avisa quando a geração do dia fica lowGenerationPct% abaixo da média dos 7 dias anteriores */
    lowGeneration: boolean;
    lowGenerationPct: number;
    /** pico do dia abaixo de X% da capacidade instalada (kWp) */
    lowCapacity: boolean;
    lowCapacityPct: number;
    /** inversor "normal" mas sem gerar por N minutos em pleno dia */
    zeroGeneration: boolean;
    zeroGenerationMinutes: number;
    /** uma string PV rende X% menos que a melhor */
    stringImbalance: boolean;
    stringImbalancePct: number;
    /** tensão da rede perto do limite de desligamento do inversor */
    gridVoltage: boolean;
    /** kWh comprados da rede no dia; 0 desliga (só com medidor) */
    gridImportKwh: number;
    /** ritmo do mês abaixo da média histórica + marcos de geração acumulada */
    monthly: boolean;
    monthlyPct: number;
    /** sem leituras novas por N minutos (worker ou API parados) */
    staleData: boolean;
    staleMinutes: number;
    /** resumo da semana no domingo, no horário do relatório */
    weeklySummary: boolean;
    /** resumo do mês anterior no dia 1, no horário do relatório */
    monthlyReport: boolean;
  };
  report: { enabled: boolean; time: string };
  /** R$/kWh para estimar economia */
  tariff: number;
}

/** Chaves do kv que pertencem a uma conta (ajustes, último relatório). */
export const accountKey = (base: string, accountId: number) => `${base}:${accountId}`;

/** Padrões vindos do .env (usados até a primeira gravação pelo dashboard). */
export function defaultSettings(env = process.env): Settings {
  const [start, end] = (env.DAYLIGHT_HOURS ?? "7-17").split("-").map((h) => `${h.padStart(2, "0")}:00`);
  return {
    recipients: (env.WHATSAPP_TO ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((to, i) => ({ id: String(i + 1), name: to.endsWith("@g.us") ? "Grupo" : to, to, enabled: true })),
    rules: {
      offline: true,
      offlineMinutes: Number(env.OFFLINE_GRACE_MINUTES ?? 20),
      daylightOnly: true,
      dayStart: start,
      dayEnd: end,
      inverterErrors: true,
      recovered: true,
      lowGeneration: true,
      lowGenerationPct: 20,
      lowCapacity: true,
      lowCapacityPct: 20,
      zeroGeneration: true,
      zeroGenerationMinutes: 30,
      stringImbalance: true,
      stringImbalancePct: 40,
      gridVoltage: true,
      gridImportKwh: 0,
      monthly: true,
      monthlyPct: 15,
      staleData: true,
      staleMinutes: 15,
      weeklySummary: true,
      monthlyReport: true,
    },
    report: { enabled: true, time: env.REPORT_TIME ?? "19:00" },
    tariff: Number(env.TARIFA_KWH ?? 0.95),
  };
}

export async function getSettings(db: Db, accountId: number): Promise<Settings> {
  const [row] = await db.select().from(kv).where(eq(kv.key, accountKey("settings", accountId)));
  // conta sem ajustes salvos (a principal já recebe os do .env ao ser criada): nada de herdar destinatários
  const base = row ? defaultSettings() : { ...defaultSettings(), recipients: [] };
  if (!row) return base;
  const saved = row.value as Partial<Settings>;
  return {
    ...base,
    ...saved,
    rules: { ...base.rules, ...saved.rules },
    report: { ...base.report, ...saved.report },
  };
}

export async function saveSettings(db: Db, accountId: number, settings: Settings) {
  await db
    .insert(kv)
    .values({ key: accountKey("settings", accountId), value: settings })
    .onConflictDoUpdate({ target: kv.key, set: { value: settings, updatedAt: new Date() } });
}

export async function getKv<T>(db: Db, key: string): Promise<T | undefined> {
  const [row] = await db.select().from(kv).where(eq(kv.key, key));
  return row?.value as T | undefined;
}
