import { alerts, dailyEnergy, getSettings, plantIdsOf, plants, type Db } from "@sol/db";
import { PLANT_STATUS } from "@sol/solplanet";
import { and, avg, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { config, localNow } from "./config";

const fmtDate = (day: string) => day.split("-").reverse().join("/");

export async function buildDailyReport(db: Db, accountId: number): Promise<string> {
  const { day } = localNow();
  const rows = await db.select().from(plants).where(inArray(plants.id, plantIdsOf(db, accountId))).orderBy(plants.name);
  const { tariff } = await getSettings(db, accountId);
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const lines = [`☀️ *Relatório solar — ${fmtDate(day)}*`];
  let total = 0;

  for (const p of rows) {
    const [today] = await db
      .select()
      .from(dailyEnergy)
      .where(and(eq(dailyEnergy.plantId, p.id), eq(dailyEnergy.day, day)));
    const [{ avg7 }] = await db
      .select({ avg7: avg(dailyEnergy.energyKwh) })
      .from(dailyEnergy)
      .where(and(eq(dailyEnergy.plantId, p.id), lt(dailyEnergy.day, day), gte(dailyEnergy.day, sql`${day}::date - 7`)));

    const kwh = today?.energyKwh ?? p.todayKwh;
    total += kwh;
    const mean = avg7 ? Number(avg7) : null;
    const diff = mean ? ((kwh - mean) / mean) * 100 : null;
    const yieldH = p.capacityKwp ? kwh / p.capacityKwp : null;

    lines.push(
      "",
      `*${p.name}* (${PLANT_STATUS[p.status] ?? p.status})`,
      `⚡ Hoje: *${kwh.toFixed(2)} kWh*` + (diff !== null ? ` (${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% vs média 7d)` : ""),
      `📈 Pico: ${((today?.peakW ?? 0) / 1000).toFixed(2)} kW` + (yieldH !== null ? ` · ${yieldH.toFixed(2)} kWh/kWp` : ""),
      `💰 Economia hoje: ${brl(kwh * tariff)}`,
      `🔋 Total: ${p.totalKwh.toFixed(0)} kWh`,
    );
  }

  if (rows.length > 1) lines.push("", `Total do dia: *${total.toFixed(2)} kWh*`);

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(inArray(alerts.plantId, plantIdsOf(db, accountId)), ne(alerts.kind, "recovered"), sql`(${alerts.occurredAt} at time zone ${config.timezone})::date = ${day}::date`));
  lines.push("", n ? `⚠️ ${n} alerta(s) hoje — veja o dashboard.` : "✅ Nenhum alerta hoje.");
  return lines.join("\n");
}

/** Resumo dos últimos 7 dias contra os 7 anteriores, por usina. */
export async function buildWeeklyReport(db: Db, accountId: number): Promise<string> {
  const { day } = localNow();
  const rows = await db.select().from(plants).where(inArray(plants.id, plantIdsOf(db, accountId))).orderBy(plants.name);
  const { tariff } = await getSettings(db, accountId);
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const lines = [`📊 *Resumo da semana — até ${fmtDate(day)}*`];

  for (const p of rows) {
    const days = await db
      .select({ day: dailyEnergy.day, kwh: dailyEnergy.energyKwh })
      .from(dailyEnergy)
      .where(and(eq(dailyEnergy.plantId, p.id), gte(dailyEnergy.day, sql`${day}::date - 13`), lt(dailyEnergy.day, sql`${day}::date + 1`)));
    const cutoff = new Date(`${day}T00:00:00Z`).getTime() - 6 * 86400_000;
    const week = days.filter((d) => new Date(`${d.day}T00:00:00Z`).getTime() >= cutoff);
    const prev = days.filter((d) => new Date(`${d.day}T00:00:00Z`).getTime() < cutoff);
    const sum = (l: { kwh: number }[]) => l.reduce((s, d) => s + d.kwh, 0);
    const total = sum(week);
    const before = sum(prev);
    const best = week.reduce<{ day: string; kwh: number } | null>((m, d) => (!m || d.kwh > m.kwh ? { day: String(d.day), kwh: d.kwh } : m), null);
    lines.push(
      "",
      `*${p.name}*`,
      `⚡ Semana: *${total.toFixed(1)} kWh*` + (before > 0 && prev.length >= 5 ? ` (${total >= before ? "+" : ""}${(((total - before) / before) * 100).toFixed(0)}% vs semana anterior)` : ""),
      `💰 Economia: ${brl(total * tariff)}`,
      best ? `☀️ Melhor dia: ${fmtDate(best.day)} com ${best.kwh.toFixed(1)} kWh` : "Sem dados na semana.",
    );
  }
  return lines.join("\n");
}

/** Mês anterior ao de `day` (yyyy-mm-dd) como "yyyy-mm". */
export function previousMonth(day: string) {
  const [y, m] = day.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Resumo de um mês fechado (yyyy-mm), por usina, comparando a média diária com o mês anterior. */
export async function buildMonthlyReport(db: Db, accountId: number, month: string): Promise<string> {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prev = previousMonth(`${month}-01`);
  const rows = await db.select().from(plants).where(inArray(plants.id, plantIdsOf(db, accountId))).orderBy(plants.name);
  const { tariff } = await getSettings(db, accountId);
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  const lines = [`📆 *Relatório de ${name}/${y}*`];

  const monthDays = (plantId: number, from: string, to: string) =>
    db
      .select({ day: dailyEnergy.day, kwh: dailyEnergy.energyKwh })
      .from(dailyEnergy)
      .where(and(eq(dailyEnergy.plantId, plantId), gte(dailyEnergy.day, from), lt(dailyEnergy.day, to), sql`${dailyEnergy.energyKwh} > 0`));

  for (const p of rows) {
    const days = await monthDays(p.id, `${month}-01`, next);
    if (!days.length) {
      lines.push("", `*${p.name}*`, "Sem dados neste mês.");
      continue;
    }
    const before = await monthDays(p.id, `${prev}-01`, `${month}-01`);
    const total = days.reduce((s, d) => s + d.kwh, 0);
    const avg = total / days.length;
    const best = days.reduce((a, b) => (b.kwh > a.kwh ? b : a));
    const worst = days.reduce((a, b) => (b.kwh < a.kwh ? b : a));
    const prevAvg = before.length >= 10 ? before.reduce((s, d) => s + d.kwh, 0) / before.length : null;
    const diff = prevAvg ? ((avg - prevAvg) / prevAvg) * 100 : null;
    lines.push(
      "",
      `*${p.name}*`,
      `⚡ Total: *${total.toFixed(1)} kWh* em ${days.length} dias (média ${avg.toFixed(1)} kWh/dia` + (diff !== null ? `, ${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% vs mês anterior` : "") + ")",
      `☀️ Melhor dia: ${fmtDate(String(best.day))} (${best.kwh.toFixed(1)} kWh) · Pior: ${fmtDate(String(worst.day))} (${worst.kwh.toFixed(1)} kWh)`,
      ...(p.capacityKwp ? [`📈 ${(total / p.capacityKwp).toFixed(0)} kWh/kWp`] : []),
      `💰 Economia: ${brl(total * tariff)}`,
    );
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(inArray(alerts.plantId, plantIdsOf(db, accountId)), ne(alerts.kind, "recovered"), ne(alerts.kind, "milestone"), sql`(${alerts.occurredAt} at time zone ${config.timezone})::date >= ${`${month}-01`}::date and (${alerts.occurredAt} at time zone ${config.timezone})::date < ${next}::date`));
  lines.push("", n ? `⚠️ ${n} alerta(s) no mês: veja o dashboard.` : "✅ Nenhum alerta no mês.");
  return lines.join("\n");
}

