import { accountKey, createDb, decryptSecret, getKv, kv, listAccounts, upsertAccount } from "@sol/db";
import { runMigrations } from "@sol/db/migrate";
import { sql } from "drizzle-orm";
import { Collector } from "./collector";
import { config, localNow } from "./config";
import { buildDailyReport, buildMonthlyReport, buildWeeklyReport, previousMonth } from "./report";
import { notify } from "./whatsapp";

const db = createDb();
await runMigrations(db);

// conta do .env (opcional): garante a linha em accounts e adota os dados do tempo de conta única
if (config.solplanet.account && config.solplanet.password) await upsertAccount(db, config.solplanet.account, config.solplanet.password);

const collectors = new Map<number, Collector>();

/** Sincroniza os coletores com a tabela accounts (contas entram pelo login do dashboard). */
async function syncCollectors() {
  for (const acc of await listAccounts(db)) {
    const password = decryptSecret(acc.passwordEnc);
    if (password === null) {
      console.error(`[${acc.account}] senha ilegível (AUTH_SECRET mudou?): entre de novo no dashboard para regravar`);
      collectors.delete(acc.id);
      continue;
    }
    const known = collectors.get(acc.id);
    if (known) known.setPassword(password);
    else collectors.set(acc.id, new Collector(db, acc.id, { account: acc.account, password }));
  }
}

async function maybeSendReport(c: Collector) {
  const { report } = c.settings;
  if (!report.enabled) return;
  const { day, time } = localNow();
  if (time < report.time) return;
  const lastKey = accountKey("last_report", c.accountId);
  if ((await getKv<string>(db, lastKey)) === day) return;
  await notify(c.who, await buildDailyReport(db, c.accountId), c.settings);
  const value = new Date().toISOString();
  await db
    .insert(kv)
    .values([
      { key: lastKey, value: day },
      { key: accountKey("last_report_at", c.accountId), value },
    ])
    .onConflictDoUpdate({ target: kv.key, set: { value: sql`excluded.value`, updatedAt: new Date() } });
}

/** Domingo, a partir do horário do relatório: resumo da semana (uma vez por semana). */
async function maybeSendWeekly(c: Collector) {
  const { report, rules } = c.settings;
  if (!report.enabled || !rules.weeklySummary) return;
  const { day, time } = localNow();
  if (new Date(`${day}T12:00:00Z`).getUTCDay() !== 0 || time < report.time) return;
  const key = accountKey("weekly", c.accountId);
  if ((await getKv<string>(db, key)) === day) return;
  await notify(c.who, await buildWeeklyReport(db, c.accountId), c.settings);
  await db.insert(kv).values({ key, value: day }).onConflictDoUpdate({ target: kv.key, set: { value: day, updatedAt: new Date() } });
}

/** `readings` cresce ~720 linhas/dia por usina (coleta de 2 min); `power_points` e `daily_energy` guardam o histórico. */
const RETENTION_DAYS = Number(process.env.READINGS_RETENTION_DAYS ?? 90);
async function pruneReadings() {
  const res = await db.execute(sql`delete from readings where ts < now() - make_interval(days => ${RETENTION_DAYS})`);
  if (res.count) console.log(`retenção: ${res.count} leituras com mais de ${RETENTION_DAYS} dias apagadas`);
}

/** Dia 1, a partir do horário do relatório: resumo do mês que passou (uma vez por mês). */
async function maybeSendMonthly(c: Collector) {
  const { report, rules } = c.settings;
  if (!report.enabled || !rules.monthlyReport) return;
  const { day, time } = localNow();
  if (day.slice(8, 10) !== "01" || time < report.time) return;
  const month = previousMonth(day);
  const key = accountKey("monthly_report", c.accountId);
  if ((await getKv<string>(db, key)) === month) return;
  await notify(c.who, await buildMonthlyReport(db, c.accountId, month), c.settings);
  await db.insert(kv).values({ key, value: month }).onConflictDoUpdate({ target: kv.key, set: { value: month, updatedAt: new Date() } });
}

let running = false;
async function cycle() {
  if (running) return;
  running = true;
  try {
    await syncCollectors();
    // em série: uma conta por vez, sem rajada de requisições. `claimed` evita coletar duas vezes a usina dividida
    const claimed = new Set<number>();
    for (const c of collectors.values()) {
      try {
        await c.tick(claimed);
        await maybeSendReport(c);
        await maybeSendWeekly(c);
        await maybeSendMonthly(c);
      } catch (e) {
        console.error(`ciclo da conta ${c.accountId} falhou:`, e);
      }
    }
  } catch (e) {
    console.error("ciclo falhou:", e);
  } finally {
    running = false;
  }
}

/** Conta recém-cadastrada (login no dashboard) é coletada em até ~15 s, em vez de esperar o próximo ciclo. */
async function pickupNewAccounts() {
  if (running) return;
  running = true;
  try {
    await syncCollectors();
    const claimed = new Set<number>();
    for (const c of collectors.values()) {
      if (c.ticked) continue;
      try {
        await c.tick(claimed);
      } catch (e) {
        console.error(`primeira coleta da conta ${c.accountId} falhou:`, e);
      }
    }
  } catch (e) {
    console.error("verificação de contas novas falhou:", e);
  } finally {
    running = false;
  }
}

await pruneReadings().catch((e) => console.error("retenção falhou:", e));
setInterval(() => pruneReadings().catch((e) => console.error("retenção falhou:", e)), 24 * 3600_000);

console.log(`worker iniciado: coleta a cada ${config.pollMinutes} min (${config.timezone})`);
await cycle();
setInterval(cycle, config.pollMinutes * 60_000);
setInterval(pickupNewAccounts, 15_000);

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(0));
