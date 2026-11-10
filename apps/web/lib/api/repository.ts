import { accountPlants, alerts, dailyEnergy, getSettings, plantIdsOf, plants, type Db } from "@sol/db";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { SummaryInput } from "./summary";

/**
 * Consultas da API com o banco recebido por parâmetro (sem `server-only` nem cookies do Next),
 * para os testes de integração chamarem com um Postgres real.
 */
const tz = () => process.env.TZ ?? "America/Sao_Paulo";

export async function canSeePlant(db: Db, accountId: number, plantId: number) {
  const [row] = await db
    .select({ id: accountPlants.plantId })
    .from(accountPlants)
    .where(and(eq(accountPlants.accountId, accountId), eq(accountPlants.plantId, plantId)));
  return !!row;
}

/** Dados do resumo de hoje (no fuso configurado) ou null se a usina não existe. */
export async function loadSummaryInput(db: Db, accountId: number, plantId: number): Promise<SummaryInput | null> {
  const [plant] = await db.select().from(plants).where(eq(plants.id, plantId));
  if (!plant) return null;
  const today = sql`(now() at time zone ${tz()})::date`;
  const [[todayRow], [avgRow], settings] = await Promise.all([
    db.select().from(dailyEnergy).where(and(eq(dailyEnergy.plantId, plantId), eq(dailyEnergy.day, today))),
    db
      .select({ v: sql<number | null>`avg(${dailyEnergy.energyKwh})::float8` })
      .from(dailyEnergy)
      .where(and(eq(dailyEnergy.plantId, plantId), lt(dailyEnergy.day, today), gte(dailyEnergy.day, sql`${today} - 7`))),
    getSettings(db, accountId),
  ]);
  return {
    plant,
    todayKwh: todayRow?.energyKwh ?? plant.todayKwh,
    peakW: todayRow?.peakW ?? 0,
    avg7Kwh: avgRow?.v ?? null,
    tariff: settings.tariff,
  };
}

/** Alertas da conta (os antigos, sem conta, valem para quem enxerga a usina), do mais recente ao mais antigo. */
export function listAlerts(db: Db, accountId: number, opts: { kind?: string; limit: number }) {
  const own = or(eq(alerts.accountId, accountId), and(isNull(alerts.accountId), inArray(alerts.plantId, plantIdsOf(db, accountId))))!;
  return db
    .select({
      id: alerts.id,
      usinaId: alerts.plantId,
      tipo: alerts.kind,
      mensagem: alerts.message,
      codigoErro: alerts.errorCode,
      ocorridoEm: alerts.occurredAt,
      notificadoEm: alerts.notifiedAt,
    })
    .from(alerts)
    .where(opts.kind ? and(own, eq(alerts.kind, opts.kind)) : own)
    .orderBy(desc(alerts.occurredAt))
    .limit(opts.limit);
}
