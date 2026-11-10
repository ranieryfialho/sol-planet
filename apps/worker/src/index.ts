import { accountKey, createDb, decryptSecret, getKv, getSettings, kv, listAccounts, upsertAccount } from "@sol/db";
import { runMigrations } from "@sol/db/migrate";
import { sql } from "drizzle-orm";
import { Collector } from "./collector";
import { LivoltekCollector } from "./livoltek-collector";
import { config, localNow } from "./config";
import { buildDailyReport, buildMonthlyReport, buildWeeklyReport, previousMonth } from "./report";
import { notify } from "./whatsapp";
import { logger } from "@sol/observability";

const db = createDb();
await runMigrations(db);

// conta do .env (opcional): garante a linha em accounts e adota os dados do tempo de conta única
if (config.solplanet.account && config.solplanet.password) await upsertAccount(db, config.solplanet.account, config.solplanet.password);

type AnyCollector = Collector | LivoltekCollector;
const collectors = new Map<number, AnyCollector>();

/** Conta sem coleta porque a senha não abre: avisa no WhatsApp da própria conta, no máximo uma vez por dia. */
async function warnUnreadablePassword(accountId: number, login: string) {
  const key = accountKey("unreadable_pw", accountId);
  const { day } = localNow();
  if ((await getKv<string>(db, key)) === day) return;
  await db.insert(kv).values({ key, value: day }).onConflictDoUpdate({ target: kv.key, set: { value: day, updatedAt: new Date() } });
  await notify(
    { id: accountId, login },
    "🔑 O monitor não consegue entrar na sua conta e parou de coletar dados\nEntre de novo no dashboard (sair e entrar com a mesma senha) para reativar a coleta.",
    await getSettings(db, accountId),
  );
}

/** Sincroniza os coletores com a tabela accounts (contas entram pelo login do dashboard). */
async function syncCollectors() {
  for (const acc of await listAccounts(db)) {
    const password = decryptSecret(acc.passwordEnc);
    if (password === null) {
      logger.error({ accountId: acc.id }, "senha ilegível (AUTH_SECRET mudou?): entre de novo no dashboard para regravar");
      collectors.delete(acc.id);
      await warnUnreadablePassword(acc.id, acc.account).catch((e) => logger.error({ err: e, accountId: acc.id }, "aviso de senha ilegível falhou"));
      continue;
    }
    const known = collectors.get(acc.id);
    if (known) known.setPassword(password);
    else {
      const creds = { account: acc.account, password };
      collectors.set(acc.id, acc.provider === "livoltek" ? new LivoltekCollector(db, acc.id, creds) : new Collector(db, acc.id, creds));
    }
  }
}

async function maybeSendReport(c: AnyCollector) {
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
async function maybeSendWeekly(c: AnyCollector) {
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
  if (res.count) logger.info({ apagadas: res.count, dias: RETENTION_DAYS }, "retenção: leituras antigas apagadas");
}

/** Dia 1, a partir do horário do relatório: resumo do mês que passou (uma vez por mês). */
async function maybeSendMonthly(c: AnyCollector) {
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
        // conta sem usina gravada (ex.: Livoltek aguardando o revendedor) não recebe relatório zerado
        if (!c.hasPlants) continue;
        await maybeSendReport(c);
        await maybeSendWeekly(c);
        await maybeSendMonthly(c);
      } catch (e) {
        logger.error({ err: e, accountId: c.accountId }, "ciclo da conta falhou");
      }
    }
  } catch (e) {
    logger.error({ err: e }, "ciclo falhou");
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
        logger.error({ err: e, accountId: c.accountId }, "primeira coleta da conta falhou");
      }
    }
  } catch (e) {
    logger.error({ err: e }, "verificação de contas novas falhou");
  } finally {
    running = false;
  }
}

const prune = () => pruneReadings().catch((e) => logger.error({ err: e }, "retenção falhou"));
await prune();
setInterval(prune, 24 * 3600_000);

logger.info({ pollMinutes: config.pollMinutes, timezone: config.timezone }, "worker iniciado");
await cycle();
setInterval(cycle, config.pollMinutes * 60_000);
setInterval(pickupNewAccounts, 15_000);

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(0));
