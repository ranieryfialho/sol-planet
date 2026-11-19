import { accountKey, dailyEnergy, getKv, kv, plantIdsOf, plants, readings, type Db } from "@sol/db";
import { PLANT_STATUS } from "@sol/solplanet";
import { and, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { localNow, zonedMidnight } from "./config";
import { cycleEndMessage, cycleStartMessage, isAfterSun, isNoStartTime, mins, noStartMessage } from "./domain";
import type { Collector } from "./collector";
import type { LivoltekCollector } from "./livoltek-collector";
import { notify } from "./whatsapp";

type AnyCollector = Collector | LivoltekCollector;

const mark = (db: Db, key: string, value: string) =>
  db.insert(kv).values({ key, value }).onConflictDoUpdate({ target: kv.key, set: { value, updatedAt: new Date() } });

const accountPlants = (db: Db, accountId: number) => db.select().from(plants).where(inArray(plants.id, plantIdsOf(db, accountId))).orderBy(plants.name);

/** Já chegou alguma leitura com geração (> 0 W) hoje? É o que marca o início do dia. */
async function generatedToday(db: Db, accountId: number, day: string) {
  const since = new Date(zonedMidnight(day)).toISOString();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(readings)
    .where(and(inArray(readings.plantId, plantIdsOf(db, accountId)), gte(readings.ts, sql`${since}::timestamptz`), gt(readings.powerW, 0)));
  return n > 0;
}

/** kWh de hoje por usina (o maior valor do dia, como o relatório). */
export async function todayEnergy(db: Db, accountId: number, day: string) {
  const rows = await accountPlants(db, accountId);
  const out: { name: string; todayKwh: number }[] = [];
  for (const p of rows) {
    const [d] = await db.select().from(dailyEnergy).where(and(eq(dailyEnergy.plantId, p.id), eq(dailyEnergy.day, day)));
    out.push({ name: p.name, todayKwh: d?.energyKwh ?? p.todayKwh });
  }
  return out;
}

/**
 * Início do dia: avisa no primeiro dado de geração (não no nascer do sol, porque o inversor só acorda depois).
 * Se `noStartMinutes` depois do início da janela ainda não chegou nada, avisa isso, com causas possíveis.
 * Cada aviso sai no máximo uma vez por dia.
 */
export async function maybeSendCycleStart(db: Db, c: AnyCollector) {
  const { rules } = c.settings;
  if (!rules.cycleStart) return;
  const { day, time } = localNow();
  if (mins(time) < mins(rules.dayStart) || mins(time) >= mins(rules.dayEnd)) return;
  const startKey = accountKey("cycle_start", c.accountId);
  if ((await getKv<string>(db, startKey)) === day) return;

  if (await generatedToday(db, c.accountId, day)) {
    const rows = await accountPlants(db, c.accountId);
    const msg = cycleStartMessage(rows.map((p) => ({ name: p.name, statusLabel: PLANT_STATUS[p.status] ?? `status ${p.status}`, ok: p.status === 1, powerW: p.powerW })));
    await notify(c.who, msg, c.settings);
    await mark(db, startKey, day);
    return;
  }

  const lateKey = accountKey("cycle_nostart", c.accountId);
  if (!isNoStartTime(time, rules.dayStart, rules.dayEnd, rules.noStartMinutes) || (await getKv<string>(db, lateKey)) === day) return;
  await notify(c.who, noStartMessage(rules.dayStart), c.settings);
  await mark(db, lateKey, day);
}

/** Aviso de fim do dia vai dentro do relatório (e não separado)? Só faz sentido com o relatório ligado. */
export const endInReport = (c: AnyCollector) => c.settings.rules.cycleEnd && c.settings.rules.cycleEndInReport && c.settings.report.enabled;

/** Fim do dia: 30 min depois do fim da janela, uma vez por dia, só se a usina gerou alguma coisa. */
export async function maybeSendCycleEnd(db: Db, c: AnyCollector) {
  const { rules, report } = c.settings;
  if (!rules.cycleEnd || endInReport(c)) return;
  const { day, time } = localNow();
  if (!isAfterSun(time, rules.dayEnd)) return;
  const key = accountKey("cycle_end", c.accountId);
  if ((await getKv<string>(db, key)) === day) return;
  const energy = await todayEnergy(db, c.accountId, day);
  // sem geração nenhuma não há o que encerrar: o aviso de "sem geração" já cobriu o dia
  if (!energy.some((e) => e.todayKwh > 0)) return;
  await notify(c.who, cycleEndMessage(energy, report.enabled && time < report.time ? report.time : null), c.settings);
  await mark(db, key, day);
}
