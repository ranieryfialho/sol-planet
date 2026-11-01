/**
 * Sonda a API da Livoltek com a conta do .env e grava todas as respostas em probe-out.json (não versionado).
 * Uso: pnpm --filter @sol/livoltek probe
 */
import { writeFileSync } from "node:fs";
import { LivoltekClient, type Server } from "./index";

const account = process.env.LIVOLTEK_ACCOUNT;
const password = process.env.LIVOLTEK_PASSWORD;
if (!account || !password) throw new Error("defina LIVOLTEK_ACCOUNT e LIVOLTEK_PASSWORD no .env");

const c = new LivoltekClient((process.env.LIVOLTEK_SERVER ?? "international") as Server, "en", process.env.TZ ?? "America/Sao_Paulo");
const out: Record<string, unknown> = {};
const grab = async (label: string, fn: () => Promise<unknown>) => {
  try {
    out[label] = await fn();
    console.log(`ok   ${label}`);
  } catch (e) {
    out[label] = { error: String(e) };
    console.log(`fail ${label}: ${e}`);
  }
  return out[label];
};

const login: any = await grab("login", () => c.login(account, password));
if (login?.error) {
  writeFileSync("probe-out.json", JSON.stringify(out, null, 2));
  process.exit(1);
}
// não grava o token no arquivo
if (login) out.login = { ...login, access_token: "<redacted>", refresh_token: "<redacted>" };

const stations = (await grab("stations", () => c.stations())) as any[];
const now = new Date();
const midnight = new Date(now);
midnight.setHours(0, 0, 0, 0);
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

for (const s of Array.isArray(stations) ? stations : []) {
  const id = s.id ?? s.powerStationId ?? s.psId;
  await grab(`station:${id}`, () => c.station(id));
  await grab(`flow:${id}`, () => c.powerFlow(id));
  await grab(`solar:${id}`, () => c.solarInfo(id));
  await grab(`sample-day:${id}`, () => c.sample(id, "day", midnight, now));
  await grab(`sample-month:${id}`, () => c.sample(id, "month", monthStart, now));
  await grab(`alarms:${id}`, () => c.alarms(id));
  const devs = (await grab(`devices:${id}`, () => c.devices(id))) as any[];
  for (const d of Array.isArray(devs) ? devs.slice(0, 5) : []) await grab(`device:${d.id}`, () => c.device(d.id));
}

writeFileSync("probe-out.json", JSON.stringify(out, null, 2));
console.log("respostas em packages/livoltek/probe-out.json");
