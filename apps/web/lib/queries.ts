import "server-only";
import { accountKey, alerts, dailyEnergy, getKv, getSettings, plantIdsOf, inverters, plants, powerPoints, readings } from "@sol/db";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { currentAccountId } from "./account";
import { getDb } from "./db";

export const TZ = process.env.TZ ?? "America/Sao_Paulo";

/** Meia-noite local (no fuso configurado) como timestamptz. */
const localMidnight = sql`(date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ})`;
const localToday = sql`(now() at time zone ${TZ})::date`;

export type Plant = typeof plants.$inferSelect;
export type Inverter = typeof inverters.$inferSelect;
export type Alert = typeof alerts.$inferSelect;

/** Usinas que a conta enxerga (própria ou dividida com outra conta). */
export async function getPlants() {
  return getDb().select().from(plants).where(inArray(plants.id, plantIdsOf(getDb(), await currentAccountId()))).orderBy(plants.name);
}

/** Usina exibida (primeira por nome; o app hoje assume uma usina principal). */
export async function getCurrentPlant(): Promise<Plant | undefined> {
  return (await getPlants())[0];
}

export interface CurvePoint {
  ts: Date;
  /** W; null nos pontos que só têm consumo */
  powerW: number | null;
  loadW: number | null;
}

/**
 * Curva de um intervalo. As leituras do worker (a cada 2 min) são a base: é o que dá o valor exato ao passar
 * o mouse. A curva oficial do app (power_points, 10 min) só preenche onde o worker não coletou (worker parado,
 * dias antigos), para não deixar buracos. Consumo vem das leituras (fluxo com medidor).
 */
async function getCurve(plantId: number, start: SQL, end?: SQL): Promise<CurvePoint[]> {
  const db = getDb();
  const inRange = (col: typeof readings.ts | typeof powerPoints.ts) => (end ? and(gte(col, start), lt(col, end)) : gte(col, start));
  const [official, own] = await Promise.all([
    db.select({ ts: powerPoints.ts, powerW: powerPoints.powerW }).from(powerPoints).where(and(eq(powerPoints.plantId, plantId), inRange(powerPoints.ts))).orderBy(powerPoints.ts),
    db.select({ ts: readings.ts, powerW: readings.powerW, loadW: readings.loadW }).from(readings).where(and(eq(readings.plantId, plantId), inRange(readings.ts))).orderBy(readings.ts),
  ]);
  if (!official.length) return own;
  // ponto oficial só entra se não há leitura própria por perto (6 min): evita serrilhado onde as duas fontes coincidem
  const ownTimes = own.map((r) => r.ts.getTime());
  const near = (t: number) => ownTimes.some((o) => Math.abs(o - t) < 6 * 60_000);
  const fillers = official.filter((p) => !near(p.ts.getTime())).map((p) => ({ ts: p.ts, powerW: p.powerW, loadW: null }));
  return [...own, ...fillers].sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

export function getTodayReadings(plantId: number) {
  return getCurve(plantId, localMidnight);
}

/** Curva de um dia local (yyyy-mm-dd). */
export function getReadingsForDay(plantId: number, day: string) {
  return getCurve(plantId, sql`(${day}::date::timestamp at time zone ${TZ})`, sql`((${day}::date + 1)::timestamp at time zone ${TZ})`);
}

/** Geração por dia num intervalo [from, to) (datas yyyy-mm-dd). */
export async function getDaily(plantId: number, from: string, to: string) {
  const rows = await getDb()
    .select({ day: dailyEnergy.day, energyKwh: dailyEnergy.energyKwh, peakW: dailyEnergy.peakW })
    .from(dailyEnergy)
    .where(and(eq(dailyEnergy.plantId, plantId), gte(dailyEnergy.day, from), lt(dailyEnergy.day, to)))
    .orderBy(dailyEnergy.day);
  return rows.map((r) => ({ ...r, day: String(r.day) }));
}

export async function getLastDays(plantId: number, days: number) {
  const rows = await getDb()
    .select({ day: dailyEnergy.day, energyKwh: dailyEnergy.energyKwh, peakW: dailyEnergy.peakW })
    .from(dailyEnergy)
    .where(and(eq(dailyEnergy.plantId, plantId), gte(dailyEnergy.day, sql`${localToday} - ${days - 1}::int`)))
    .orderBy(dailyEnergy.day);
  return rows.map((r) => ({ ...r, day: String(r.day) }));
}

/** Soma por mês de um ano (1..12). */
export async function getMonthly(plantId: number, year: number) {
  const month = sql<number>`extract(month from ${dailyEnergy.day})::int`;
  return getDb()
    .select({ month, energyKwh: sql<number>`sum(${dailyEnergy.energyKwh})::float8`, peakW: sql<number>`max(${dailyEnergy.peakW})::float8` })
    .from(dailyEnergy)
    .where(and(eq(dailyEnergy.plantId, plantId), sql`extract(year from ${dailyEnergy.day}) = ${year}`))
    .groupBy(month)
    .orderBy(month);
}

/** Soma por ano. */
export async function getYearly(plantId: number) {
  const year = sql<number>`extract(year from ${dailyEnergy.day})::int`;
  return getDb()
    .select({ year, energyKwh: sql<number>`sum(${dailyEnergy.energyKwh})::float8`, peakW: sql<number>`max(${dailyEnergy.peakW})::float8` })
    .from(dailyEnergy)
    .where(eq(dailyEnergy.plantId, plantId))
    .groupBy(year)
    .orderBy(year);
}

/** Média diária dos 7 dias anteriores a hoje. */
export async function getAvg7(plantId: number): Promise<number | null> {
  const [r] = await getDb()
    .select({ v: sql<number | null>`avg(${dailyEnergy.energyKwh})::float8` })
    .from(dailyEnergy)
    .where(and(eq(dailyEnergy.plantId, plantId), lt(dailyEnergy.day, localToday), gte(dailyEnergy.day, sql`${localToday} - 7`)));
  return r?.v ?? null;
}

/** Geração do mês corrente somando daily_energy (fallback quando a API não manda eMonth). */
export async function getMonthSum(plantId: number): Promise<number> {
  const [r] = await getDb()
    .select({ v: sql<number>`coalesce(sum(${dailyEnergy.energyKwh}), 0)::float8` })
    .from(dailyEnergy)
    .where(and(eq(dailyEnergy.plantId, plantId), gte(dailyEnergy.day, sql`date_trunc('month', ${localToday})::date`)));
  return r?.v ?? 0;
}

export type AlertFilter = "todos" | "erros" | "offline" | "resolvidos";
const FILTER_KINDS: Record<Exclude<AlertFilter, "todos">, string[]> = {
  erros: ["error", "warning", "fault", "low_generation", "low_capacity", "zero_generation", "string_imbalance", "grid_voltage", "grid_import", "monthly", "stale_data"],
  offline: ["offline"],
  resolvidos: ["recovered", "milestone"],
};

/** Alertas disparados pelas regras da conta logada (os antigos, sem conta, valem para quem enxerga a usina). */
const ownAlerts = (accountId: number) =>
  or(eq(alerts.accountId, accountId), and(isNull(alerts.accountId), inArray(alerts.plantId, plantIdsOf(getDb(), accountId))))!;

export async function getAlerts(filter: AlertFilter = "todos", limit = 50) {
  const own = ownAlerts(await currentAccountId());
  const rows = getDb()
    .select()
    .from(alerts)
    .where(filter === "todos" ? own : and(own, inArray(alerts.kind, FILTER_KINDS[filter])));
  return rows.orderBy(desc(alerts.occurredAt)).limit(limit);
}

export async function countAlerts() {
  const rows = await getDb()
    .select({ kind: alerts.kind, n: sql<number>`count(*)::int` })
    .from(alerts)
    .where(ownAlerts(await currentAccountId()))
    .groupBy(alerts.kind);
  const by = Object.fromEntries(rows.map((r) => [r.kind, r.n]));
  const sum = (kinds: string[]) => kinds.reduce((s, k) => s + (by[k] ?? 0), 0);
  return {
    todos: rows.reduce((s, r) => s + r.n, 0),
    erros: sum(FILTER_KINDS.erros),
    offline: sum(FILTER_KINDS.offline),
    resolvidos: sum(FILTER_KINDS.resolvidos),
  };
}

export async function getInverters(plantId: number) {
  return getDb().select().from(inverters).where(eq(inverters.plantId, plantId)).orderBy(inverters.sn);
}

/** Ajustes da conta logada. */
export async function getAccountSettings() {
  return getSettings(getDb(), await currentAccountId());
}

/** Valor do kv que pertence à conta logada (ex.: last_report_at). */
export async function getAccountKv<T>(base: string) {
  return getKv<T>(getDb(), accountKey(base, await currentAccountId()));
}
