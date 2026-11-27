/**
 * Utilitários:
 *   pnpm cli dump      → JSON bruto das usinas (confere login e campos)
 *   pnpm cli dump-all  → todas as respostas usadas (usina, detalhe, fluxo, inversores, histórico)
 *   pnpm cli errors    → últimos erros dos inversores
 *   pnpm cli check <email> → diagnóstico de uma conta Solplanet (pede a senha, não grava nada)
 *   pnpm cli report    → envia o relatório diário agora
 *   pnpm cli groups    → lista os grupos do WhatsApp (para pegar o JID)
 *   pnpm cli test      → manda uma mensagem de teste no WhatsApp
 */
import { createDb, decryptSecret, getSettings, listAccounts, upsertAccount } from "@sol/db";
import { runMigrations } from "@sol/db/migrate";
import { SolplanetClient } from "@sol/solplanet";
import { config } from "./config";
import { buildDailyReport } from "./report";
import { wahaFor } from "@sol/whatsapp";
import { notify } from "./whatsapp";

const cmd = process.argv[2];

/** Conta usada pelos comandos: a do .env, ou a primeira cadastrada pelo dashboard. */
async function creds() {
  if (config.solplanet.account && config.solplanet.password) return config.solplanet;
  const first = (await listAccounts(await db()))[0];
  const password = first && decryptSecret(first.passwordEnc);
  if (!first || !password) throw new Error("nenhuma conta cadastrada: entre uma vez no dashboard (ou defina SOLPLANET_ACCOUNT/PASSWORD)");
  return { ...config.solplanet, account: first.account, password };
}

async function client() {
  const c = new SolplanetClient(config.solplanet.region, config.solplanet.locale);
  const { account, password } = await creds();
  await c.login(account, password);
  return c;
}

async function db() {
  const d = createDb();
  await runMigrations(d);
  return d;
}

async function primary(d: Awaited<ReturnType<typeof db>>) {
  const { account, password } = await creds();
  const row = await upsertAccount(d, account, password);
  return { id: row.id, login: row.account };
}

/** Lê uma linha do terminal sem mostrar o que é digitado. */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\n" || c === "\r" || c === "\u0004") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(buf);
        }
        if (c === "\u0003") process.exit(130);
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on("data", onData);
  });
}

const safe = async (fn: () => Promise<unknown>) => {
  try {
    return await fn();
  } catch (e) {
    return { erro: String(e) };
  }
};

switch (cmd) {
  case "dump":
    console.log(JSON.stringify(await (await client()).plants(), null, 2));
    break;
  case "dump-all": {
    const c = await client();
    const plants = await c.plants();
    const out: Record<string, unknown> = { plants };
    const now = Date.now();
    for (const p of plants) {
      const id = p.stationid;
      const invs = (await safe(() => c.inverters(id))) as Record<string, any>[];
      const sn = Array.isArray(invs) ? String(invs[0]?.isno ?? invs[0]?.sn ?? invs[0]?.devno ?? "") : "";
      out[`plant_${id}`] = {
        detail: await safe(() => c.plantDetail(id)),
        flow: await safe(() => c.plantFlow(id)),
        inverters: invs,
        devices: await safe(() => c.allDevices(id)),
        ...(sn && {
          inverterDetail: await safe(() => c.inverterDetail(id, sn)),
          inverterParams: await safe(() => c.storageDetail(id, sn)),
          chartMonth: await safe(() => c.productionChart("month", id, sn, now)),
          chartYear: await safe(() => c.productionChart("year", id, sn, now)),
          chartTotal: await safe(() => c.productionChart("total", id, sn, now)),
        }),
      };
    }
    console.log(JSON.stringify(out, null, 2));
    break;
  }
  case "check": {
    const email = process.argv[3];
    if (!email) {
      console.log("uso: pnpm cli check <email ou telefone>");
      break;
    }
    const password = await askHidden(`Senha de ${email}: `);
    const c = new SolplanetClient(config.solplanet.region, config.solplanet.locale);
    try {
      const l = await c.login(email, password);
      console.log(`login ok (userId ${l.userId}, accountType ${l.accountType})`);
    } catch (e) {
      console.log("login falhou:", e instanceof Error ? e.message : e);
      break;
    }
    const base = { type: 1, name: "", sortby: 1, sort: 2, group: "null", state: 0, totalpower: 0, country: "", province: "", startdt: 0, enddt: 0, sn: "", page: 1, size: 50 };
    let found = 0;
    for (const own of [1, 0, 2]) {
      const r: any = await (c as any).get("/aienergy/plant/plantlist/v4", { ...base, own }).catch((e: unknown) => ({ erro: String(e) }));
      const list = r?.plantlist ?? [];
      console.log(`own=${own}: ${list.length} usina(s)` + (r?.erro ? ` (${r.erro.slice(0, 80)})` : ""));
      for (const p of list) {
        found++;
        const invs = await c.inverterList(p.stationid).catch(() => []);
        console.log(`  - ${p.stationname} (id ${p.stationid}) status ${p.status}, ${p.power} W, ${invs.length} inversor(es): ${invs.map((i: any) => i.devtypename ?? i.alias ?? i.isno).join(", ")}`);
      }
    }
    console.log(found ? "Tem usina vinculada a esta conta." : "Nenhuma usina vinculada a esta conta (em nenhum filtro).");
    break;
  }
  case "errors":
    console.log(JSON.stringify(await (await client()).errors(), null, 2));
    break;
  case "report": {
    const d = await db();
    const who = await primary(d);
    const text = await buildDailyReport(d, who.id);
    console.log(text);
    await notify(who, text, await getSettings(d, who.id));
    break;
  }
  case "groups": {
    const who = await primary(await db());
    for (const g of await wahaFor(who.id, who.login).listGroups()) console.log(`${g.id}\t${g.subject}`);
    break;
  }
  case "test": {
    const d = await db();
    const who = await primary(d);
    await notify(who, "👋 Teste do monitor Solplanet.", await getSettings(d, who.id));
    break;
  }
  default:
    console.log("uso: pnpm cli <dump|dump-all|errors|report|groups|test>");
}
process.exit(0);
