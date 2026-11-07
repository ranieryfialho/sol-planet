import { alerts, dailyEnergy, getKv, inverters, kv, plants, readings, type Db, type Settings } from "@sol/db";
import { eq, sql } from "drizzle-orm";
import { config, zonedMidnight } from "./config";
import { connectedStrings, dropPercent, fmtW, hasStringImbalance, isAfterSun, isGridVoltageOff, isMidday, type Row } from "./domain";
import { notifyAlert, type Who } from "./whatsapp";
import { logger } from "@sol/observability";

type Plant = typeof plants.$inferSelect;

interface Ctx {
  db: Db;
  /** conta cujas regras estão sendo avaliadas: estado, alertas e destinatários são dela */
  accountId: number;
  who: Who;
  settings: Settings;
  plant: Plant;
  now: Date;
  /** yyyy-mm-dd e HH:MM no fuso configurado */
  day: string;
  time: string;
}

const kvSet = (db: Db, key: string, value: unknown) =>
  db.insert(kv).values({ key, value }).onConflictDoUpdate({ target: kv.key, set: { value, updatedAt: new Date() } });

/** true só na primeira vez que `token` (ex.: o dia) aparece para a chave: limita o alerta a um por dia. */
async function once(db: Db, key: string, token: string) {
  if ((await getKv<string>(db, key)) === token) return false;
  await kvSet(db, key, token);
  return true;
}

/** Quantas avaliações seguidas deram `bad`; evita alertar por um pico isolado. */
async function streak(db: Db, key: string, bad: boolean) {
  const cur = (await getKv<number>(db, key)) ?? 0;
  const next = bad ? cur + 1 : 0;
  if (next !== cur) await kvSet(db, key, next);
  return next;
}

async function raise(c: Ctx, kind: string, msg: string) {
  logger.info({ kind, plantId: c.plant.id, accountId: c.accountId }, "alerta disparado");
  await notifyAlert(c.db, c.who, c.settings, c.plant.id, kind, msg);
  await c.db.insert(alerts).values({ plantId: c.plant.id, accountId: c.accountId, kind, message: msg, occurredAt: c.now, notifiedAt: c.now });
}

const afterSun = (c: Ctx) => isAfterSun(c.time, c.settings.rules.dayEnd);
const midday = (c: Ctx) => isMidday(c.time, c.settings.rules.dayStart, c.settings.rules.dayEnd);

/** Depois do fim do sol: geração do dia X% abaixo da média dos 7 dias anteriores. */
async function lowGeneration(c: Ctx) {
  const { rules } = c.settings;
  if (!rules.lowGeneration || !afterSun(c)) return;
  const key = `low_gen:${c.accountId}:${c.plant.id}`;
  if ((await getKv<string>(c.db, key)) === c.day) return;

  const [row] = await c.db
    .select({ avg: sql<number | null>`avg(${dailyEnergy.energyKwh})::float8`, n: sql<number>`count(*)::int` })
    .from(dailyEnergy)
    .where(sql`${dailyEnergy.plantId} = ${c.plant.id} and ${dailyEnergy.day} < ${c.day}::date and ${dailyEnergy.day} >= ${c.day}::date - 7 and ${dailyEnergy.energyKwh} > 0`);
  const [today] = await c.db.select().from(dailyEnergy).where(sql`${dailyEnergy.plantId} = ${c.plant.id} and ${dailyEnergy.day} = ${c.day}`);
  // sem histórico suficiente (usina nova) não há média confiável
  if (!row?.avg || row.n < 3 || !today) return;

  await kvSet(c.db, key, c.day);
  const drop = dropPercent(today.energyKwh, row.avg);
  if (drop < rules.lowGenerationPct) return;
  await raise(
    c,
    "low_generation",
    `📉 *${c.plant.name}*: geração baixa hoje\n` +
      `${today.energyKwh.toFixed(1)} kWh, ${Math.round(drop)}% abaixo da média de ${row.avg.toFixed(1)} kWh (${row.n} dias). ` +
      `Pode ser tempo nublado, sombra ou sujeira nos painéis.`,
  );
}

/** Depois do fim do sol: pico do dia abaixo de X% da capacidade instalada. */
async function lowCapacity(c: Ctx) {
  const { rules } = c.settings;
  if (!rules.lowCapacity || !afterSun(c) || !c.plant.capacityKwp) return;
  if (!(await once(c.db, `low_cap:${c.accountId}:${c.plant.id}`, c.day))) return;
  const [today] = await c.db.select().from(dailyEnergy).where(sql`${dailyEnergy.plantId} = ${c.plant.id} and ${dailyEnergy.day} = ${c.day}`);
  const peak = today?.peakW ?? 0;
  const limit = (c.plant.capacityKwp * 1000 * rules.lowCapacityPct) / 100;
  if (peak >= limit) return;
  await raise(
    c,
    "low_capacity",
    `🌥️ *${c.plant.name}*: pico de apenas ${fmtW(peak)} hoje\n` +
      `Abaixo de ${rules.lowCapacityPct}% da capacidade (${c.plant.capacityKwp} kWp = ${fmtW(limit)}). Dia muito encoberto ou problema na usina.`,
  );
}

/** Em pleno dia, com o inversor "normal", mas sem gerar há N minutos. */
async function zeroGeneration(c: Ctx) {
  const { rules } = c.settings;
  // offline, aviso e erro já têm alerta próprio; aqui só o status "normal"
  if (!rules.zeroGeneration || !midday(c) || c.plant.status !== 1) return;
  const since = new Date(c.now.getTime() - rules.zeroGenerationMinutes * 60_000);
  const [{ n, mx }] = await c.db
    .select({ n: sql<number>`count(*)::int`, mx: sql<number>`coalesce(max(${readings.powerW}), 0)::float8` })
    .from(readings)
    .where(sql`${readings.plantId} = ${c.plant.id} and ${readings.ts} >= ${since.toISOString()}::timestamptz`);
  // precisa cobrir a janela inteira (com folga de 20%) para não alertar logo após o worker subir
  if (n < Math.floor((rules.zeroGenerationMinutes / config.pollMinutes) * 0.8) || mx >= 20) return;
  if (!(await once(c.db, `zero_gen:${c.accountId}:${c.plant.id}`, c.day))) return;
  await raise(
    c,
    "zero_generation",
    `⛔ *${c.plant.name}*: sem geração há ${rules.zeroGenerationMinutes} min em pleno dia\n` +
      `O inversor aparece online, mas a potência está em ${fmtW(mx)}. Vale conferir disjuntor, inversor e painéis.`,
  );
}

/** Meio do dia: uma string PV rende X% menos que a melhor (sombra, sujeira, conector). */
async function stringImbalance(c: Ctx, invs: (typeof inverters.$inferSelect)[]) {
  const { rules } = c.settings;
  if (!rules.stringImbalance || !midday(c)) return;
  for (const inv of invs) {
    // só strings com tensão (conectadas); uma string vazia não é desequilíbrio
    const strings = connectedStrings(inv.pv as Row[] | null);
    const bad = hasStringImbalance(strings, inv.powerW ?? 0, rules.stringImbalancePct);
    // 5 coletas seguidas: sombra passageira não conta
    if ((await streak(c.db, `str:${c.accountId}:${inv.sn}`, bad)) < 5 || !(await once(c.db, `str_alert:${c.accountId}:${inv.sn}`, c.day))) continue;
    const weak = strings.reduce((a, b) => ((a.p ?? 0) <= (b.p ?? 0) ? a : b));
    const strong = strings.reduce((a, b) => ((a.p ?? 0) >= (b.p ?? 0) ? a : b));
    await raise(
      c,
      "string_imbalance",
      `⚖️ *${c.plant.name}*: ${weak.name ?? "uma string"} rendendo bem menos\n` +
        `${weak.name}: ${fmtW(weak.p ?? 0)} vs ${strong.name}: ${fmtW(strong.p ?? 0)} (mais de ${rules.stringImbalancePct}% de diferença). Sombra, sujeira ou conector.`,
    );
  }
}

/** Tensão da rede perto do limite em que o inversor se desliga (+10% / -13%). */
async function gridVoltage(c: Ctx, invs: (typeof inverters.$inferSelect)[]) {
  if (!c.settings.rules.gridVoltage) return;
  for (const inv of invs) {
    const lines = ((inv.ac as Row[] | null) ?? []).filter((l) => (l.v ?? 0) > 50);
    // nominal mais próximo: 127 V ou 220 V
    const off = lines.find((l) => isGridVoltageOff(l.v ?? 0));
    if ((await streak(c.db, `gv:${c.accountId}:${inv.sn}`, !!off)) < 3 || !off || !(await once(c.db, `gv_alert:${c.accountId}:${inv.sn}`, c.day))) continue;
    await raise(
      c,
      "grid_voltage",
      `🔌 *${c.plant.name}*: tensão da rede fora da faixa\n` +
        `${off.name ?? "Rede"}: ${(off.v ?? 0).toFixed(0)} V. O inversor pode se desligar por proteção; se persistir, acione a concessionária.`,
    );
  }
}

/** Energia comprada da rede no dia (integra a potência de rede positiva), só com medidor. */
async function gridImport(c: Ctx) {
  const limit = c.settings.rules.gridImportKwh;
  if (!(limit > 0) || !c.plant.hasMeter) return;
  const start = new Date(zonedMidnight(c.day)).toISOString();
  const [row] = await c.db.execute<{ kwh: number }>(sql`
    select coalesce(sum(greatest(grid_w, 0) * least(extract(epoch from (next_ts - ts)), 600) / 3600000.0), 0)::float8 as kwh
    from (select grid_w, ts, lead(ts) over (order by ts) as next_ts from readings where plant_id = ${c.plant.id} and ts >= ${start}::timestamptz) t
    where next_ts is not null`);
  const kwh = row?.kwh ?? 0;
  if (kwh < limit || !(await once(c.db, `grid_imp:${c.accountId}:${c.plant.id}`, c.day))) return;
  await raise(
    c,
    "grid_import",
    `🏠 *${c.plant.name}*: ${kwh.toFixed(1)} kWh comprados da rede hoje\nPassou do limite de ${limit} kWh/dia.`,
  );
}

const MILESTONE_KWH = 500;

/** Marcos de geração acumulada e ritmo do mês (a partir do dia 20) contra a média histórica. */
async function monthly(c: Ctx) {
  const { rules } = c.settings;
  if (!rules.monthly) return;

  const reached = Math.floor(c.plant.totalKwh / MILESTONE_KWH);
  const last = await getKv<number>(c.db, `milestone:${c.accountId}:${c.plant.id}`);
  if (last === undefined) await kvSet(c.db, `milestone:${c.accountId}:${c.plant.id}`, reached); // primeira vez: só registra
  else if (reached > last) {
    await kvSet(c.db, `milestone:${c.accountId}:${c.plant.id}`, reached);
    await raise(c, "milestone", `🎉 *${c.plant.name}* passou de ${reached * MILESTONE_KWH} kWh gerados desde a instalação!`);
  }

  if (Number(c.day.slice(8, 10)) < 20 || !afterSun(c)) return;
  const ym = c.day.slice(0, 7);
  const key = `monthly:${c.accountId}:${c.plant.id}`;
  if ((await getKv<string>(c.db, key)) === ym) return;
  const q = (cond: ReturnType<typeof sql>) =>
    c.db
      .select({ avg: sql<number | null>`avg(${dailyEnergy.energyKwh})::float8`, n: sql<number>`count(*)::int` })
      .from(dailyEnergy)
      .where(sql`${dailyEnergy.plantId} = ${c.plant.id} and ${dailyEnergy.energyKwh} > 0 and ${cond}`);
  const monthStart = sql`${ym + "-01"}::date`;
  const [[cur], [base]] = await Promise.all([q(sql`${dailyEnergy.day} >= ${monthStart} and ${dailyEnergy.day} <= ${c.day}::date`), q(sql`${dailyEnergy.day} < ${monthStart}`)]);
  // sem histórico dos meses anteriores (usina nova) ainda não há comparação justa
  if (!cur?.avg || !base?.avg || cur.n < 10 || base.n < 14) return;
  await kvSet(c.db, key, ym);
  const drop = dropPercent(cur.avg, base.avg);
  if (drop < rules.monthlyPct) return;
  await raise(
    c,
    "monthly",
    `📆 *${c.plant.name}*: mês abaixo do normal\n` +
      `Média de ${cur.avg.toFixed(1)} kWh/dia neste mês, ${Math.round(drop)}% abaixo da histórica (${base.avg.toFixed(1)} kWh/dia).`,
  );
}

/** Roda todas as regras extras de uma usina; uma que falhe não derruba as outras nem a coleta. */
export async function runRules(db: Db, who: Who, settings: Settings, plantId: number, now: Date, local: { day: string; time: string }) {
  const [plant] = await db.select().from(plants).where(eq(plants.id, plantId));
  if (!plant) return;
  const c: Ctx = { db, accountId: who.id, who, settings, plant, now, ...local };
  const invs = await db.select().from(inverters).where(eq(inverters.plantId, plantId));
  const checks: [string, () => Promise<void>][] = [
    ["baixa geração", () => lowGeneration(c)],
    ["baixa capacidade", () => lowCapacity(c)],
    ["geração zerada", () => zeroGeneration(c)],
    ["desequilíbrio de strings", () => stringImbalance(c, invs)],
    ["tensão da rede", () => gridVoltage(c, invs)],
    ["consumo da rede", () => gridImport(c)],
    ["mês e marcos", () => monthly(c)],
  ];
  for (const [label, run] of checks) {
    try {
      await run();
    } catch (e) {
      logger.error({ err: e, rule: label, plantId }, "regra falhou");
    }
  }
}
