/** Popula o banco com dados simulados para desenvolver o dashboard sem a API real. */
import { addMember, alerts, createDb, dailyEnergy, inverters, plants, readings, upsertAccount } from "@sol/db";
import { runMigrations } from "@sol/db/migrate";
import { sql } from "drizzle-orm";

const TZ = process.env.TZ ?? "America/Sao_Paulo";
const localDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

const db = createDb();
await runMigrations(db);
await db.execute(sql`truncate plants, readings, daily_energy, alerts, inverters cascade`);

const id = 999001;
const capacity = 5.5;
const now = new Date();
const midnight = new Date(now);
midnight.setHours(0, 0, 0, 0);

/** curva em sino entre 6h e 18h, com algum ruído de nuvens */
const curve = (h: number) => (h < 6 || h > 18 ? 0 : Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * capacity * 1000 * (0.85 + Math.random() * 0.15));
/** consumo da casa: base + picos de manhã e à noite */
const loadAt = (h: number) => 350 + 900 * Math.exp(-((h - 7.5) ** 2) / 2) + 1500 * Math.exp(-((h - 19.5) ** 2) / 3) + Math.random() * 200;

const rows = [];
let today = 0;
// demo: dia completo, mesmo se for madrugada
for (let t = midnight.getTime(); t < midnight.getTime() + 86400_000; t += 5 * 60_000) {
  const h = (t - midnight.getTime()) / 3600_000;
  const p = curve(h);
  const load = loadAt(h);
  today += (p / 1000) * (5 / 60);
  rows.push({ plantId: id, ts: new Date(t), status: 1, powerW: p, todayKwh: +today.toFixed(2), totalKwh: 8421 + today, loadW: load, gridW: load - p });
}
const last = rows.at(-1)!;
const noon = rows[144];
// pra demo ficar bonita mesmo à noite, o "agora" do fluxo usa um instante de meio-dia
const demoPv = noon.powerW;
const demoLoad = Math.round(noon.loadW);

await db.insert(plants).values({
  id,
  name: "Minha Casa",
  capacityKwp: capacity,
  status: 1,
  powerW: demoPv,
  todayKwh: last.todayKwh,
  totalKwh: last.totalKwh,
  monthKwh: null,
  latitude: -22.9056,
  longitude: -47.0608,
  flow: { pv: demoPv, load: demoLoad, grid: demoLoad - demoPv, battery: 0, meterFlag: true, storageFlag: false },
  hasMeter: true,
  hasBattery: false,
  detail: { city: "Campinas", provinceStr: "SP" },
});
await db.insert(readings).values(rows);

await db.insert(inverters).values({
  sn: "220184920-BR",
  plantId: id,
  name: "Inversor principal",
  model: "Solplanet ASW5000-S",
  status: 1,
  powerW: demoPv,
  pv: [
    { name: "PV1", v: "340", i: "6.8", p: "2310" },
    { name: "PV2", v: "325", i: "5.8", p: "1890" },
  ],
  ac: [{ name: "L1", v: "220", i: "19.1", p: "4200" }],
  params: { fac: "60.0", temperature: "41" },
});

// 400 dias de histórico, com sazonalidade (inverno gera menos)
const days = [];
for (let d = 400; d >= 1; d--) {
  const date = new Date(now.getTime() - d * 86400_000);
  const season = 1 + 0.18 * Math.cos(((date.getMonth() - 0.5) / 12) * 2 * Math.PI);
  days.push({ plantId: id, day: localDay(date), energyKwh: +(22 * season * (0.7 + Math.random() * 0.4)).toFixed(2), peakW: 3800 + Math.random() * 1200 });
}
days.push({ plantId: id, day: localDay(now), energyKwh: last.todayKwh, peakW: rows.reduce((m, r) => Math.max(m, r.powerW), 0) });
await db.insert(dailyEnergy).values(days).onConflictDoNothing();

const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
await db.insert(alerts).values([
  { plantId: id, kind: "recovered", message: "✅ *Sistema normalizado*\nInversor reconectado à rede", deviceSn: "220184920-BR", occurredAt: hoursAgo(2), notifiedAt: hoursAgo(2) },
  { plantId: id, kind: "offline", message: "🔌 *Inversor Offline*\nPerda temporária de comunicação Wi-Fi · durou 14 min", deviceSn: "220184920-BR", occurredAt: hoursAgo(26), notifiedAt: hoursAgo(26) },
  { plantId: id, kind: "fault", errorCode: "F17", deviceSn: "220184920-BR", message: "🚨 *Erro F17 · Tensão da rede fora da faixa*\nPico de 254 V na concessionária · durou 41 min", occurredAt: hoursAgo(76), notifiedAt: hoursAgo(76) },
]);

// conta demo dona da usina: é ela que a API e o k6 usam (sessão assinada com o AUTH_SECRET)
const demo = await upsertAccount(db, "demo@solar.local", "demo-sem-coleta");
await addMember(db, demo.id, id);

console.log(`demo: ${rows.length} leituras hoje, ${days.length} dias de histórico; conta demo id=${demo.id}, usina id=${id}`);
process.exit(0);
