/**
 * Teste de integração: rotas reais do Next (route.ts) + Postgres real + Supertest.
 * Precisa de TEST_DATABASE_URL apontando para um banco cujo nome termina em "_test" (o teste APAGA os dados dele).
 * Na CI vem do serviço Postgres; localmente: docker compose -f docker-compose.local.yml up -d postgres.
 */
import { addMember, alerts, createDb, dailyEnergy, plants, upsertAccount, type Db } from "@sol/db";
import { runMigrations } from "@sol/db/migrate";
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createSession } from "../apps/web/lib/session";
import { serveRoutes } from "./helpers/next-handler";

const url = process.env.TEST_DATABASE_URL;
if (url && !/_test(\?|$)/.test(new URL(url).pathname + new URL(url).search)) {
  throw new Error("TEST_DATABASE_URL precisa apontar para um banco *_test: este teste apaga os dados");
}

const TZ = "America/Sao_Paulo";
const PLANT = 424242;
const localDay = (offsetDays = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + offsetDays * 86400_000));

describe.skipIf(!url)("API REST com Postgres real", () => {
  let db: Db;
  let server: ReturnType<typeof serveRoutes>;
  let owner: string;
  let stranger: string;

  beforeAll(async () => {
    Object.assign(process.env, { DATABASE_URL: url, AUTH_SECRET: "segredo-de-integracao", TZ, TARIFA_KWH: "1" });
    db = createDb(url);
    await runMigrations(db);
    await db.execute(sql`truncate accounts, plants, alerts, daily_energy, kv restart identity cascade`);

    const a = await upsertAccount(db, "dona@teste.com", "x");
    const b = await upsertAccount(db, "outra@teste.com", "x");
    await db.insert(plants).values({ id: PLANT, name: "Usina Teste", capacityKwp: 5, status: 1, powerW: 2500, todayKwh: 30, totalKwh: 1000 });
    await addMember(db, a.id, PLANT);
    // hoje 30 kWh; 7 dias anteriores com 20 kWh: média 20, variação +50%
    await db.insert(dailyEnergy).values([
      { plantId: PLANT, day: localDay(), energyKwh: 30, peakW: 4100 },
      ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({ plantId: PLANT, day: localDay(-d), energyKwh: 20, peakW: 3900 })),
    ]);
    await db.insert(alerts).values([
      { plantId: PLANT, accountId: a.id, kind: "low_generation", message: "geração baixa", occurredAt: new Date(Date.now() - 3600_000) },
      { plantId: PLANT, accountId: a.id, kind: "offline", message: "offline", occurredAt: new Date() },
      { plantId: PLANT, accountId: b.id, kind: "offline", message: "alerta de outra conta" },
    ]);

    owner = `solar_session=${createSession(a.account, a.id)}`;
    stranger = `solar_session=${createSession(b.account, b.id)}`;

    // importa depois de ajustar o ambiente: o getDb() das rotas lê DATABASE_URL no primeiro uso
    const resumo = await import("../apps/web/app/api/usinas/[id]/resumo/route");
    const alertas = await import("../apps/web/app/api/alertas/route");
    server = serveRoutes([
      { pattern: /^\/api\/usinas\/(?<id>[^/]+)\/resumo$/, handler: (req, p) => resumo.GET(req, { params: Promise.resolve({ id: p.id }) }) },
      { pattern: /^\/api\/alertas$/, handler: (req) => alertas.GET(req) },
    ]);
  });

  afterAll(async () => {
    server?.close();
    await db?.$client.end();
    await (globalThis as { __db?: Db }).__db?.$client.end();
  });

  test("resumo da usina com dados do banco", async () => {
    const res = await request(server).get(`/api/usinas/${PLANT}/resumo`).set("Cookie", owner).expect(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.usina).toEqual({ id: PLANT, nome: "Usina Teste", capacidadeKwp: 5 });
    expect(res.body.hoje).toEqual({ energiaKwh: 30, picoW: 4100, economiaReais: 30, produtividadeKwhKwp: 6, variacaoMedia7dPct: 50 });
    expect(res.body.media7dKwh).toBe(20);
  });

  test("sem sessão: 401", async () => {
    const res = await request(server).get(`/api/usinas/${PLANT}/resumo`).expect(401);
    expect(res.body).toEqual({ erro: "não autenticado" });
  });

  test("usina de outra conta: 404 (não revela que existe)", async () => {
    await request(server).get(`/api/usinas/${PLANT}/resumo`).set("Cookie", stranger).expect(404);
  });

  test("id inválido: 400", async () => {
    await request(server).get("/api/usinas/abc/resumo").set("Cookie", owner).expect(400);
  });

  test("alertas só da conta, do mais recente ao mais antigo, com filtro e limite", async () => {
    const all = await request(server).get("/api/alertas").set("Cookie", owner).expect(200);
    expect(all.body.map((a: { tipo: string }) => a.tipo)).toEqual(["offline", "low_generation"]);

    const filtered = await request(server).get("/api/alertas?tipo=low_generation").set("Cookie", owner).expect(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0]).toMatchObject({ usinaId: PLANT, tipo: "low_generation", mensagem: "geração baixa" });

    const limited = await request(server).get("/api/alertas?limite=1").set("Cookie", owner).expect(200);
    expect(limited.body).toHaveLength(1);
  });

  test("alertas com parâmetro inválido: 400", async () => {
    await request(server).get("/api/alertas?tipo=inexistente").set("Cookie", owner).expect(400);
    await request(server).get("/api/alertas?limite=999").set("Cookie", owner).expect(400);
  });
});
