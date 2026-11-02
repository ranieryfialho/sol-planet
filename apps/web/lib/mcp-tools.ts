import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { alerts, dailyEnergy, plantIdsOf, plants } from "@sol/db";
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { statusOf, ALERT_KIND } from "./status";

const TZ = process.env.TZ ?? "America/Sao_Paulo";
const MAX_DAYS = 366;
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use yyyy-mm-dd");
const PLANT_ID = z.number().int().optional().describe("ID da usina (veja listar_usinas). Pode omitir se a conta tiver só uma usina.");

const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const round = (n: number | null | undefined, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

/**
 * Servidor MCP de uma conta. Toda consulta passa por `plantIdsOf(accountId)`: o modelo nunca escolhe a conta,
 * só entre as usinas que ela já enxerga. Somente leitura, direto do banco (sem chamar a API do fornecedor).
 */
export function createMcpServer(accountId: number) {
  const db = getDb();
  const mine = () => db.select().from(plants).where(inArray(plants.id, plantIdsOf(db, accountId))).orderBy(plants.name);

  /** Usina pedida (se for da conta) ou a única da conta. */
  async function pickPlant(id?: number) {
    const list = await mine();
    if (id !== undefined) {
      const p = list.find((x) => x.id === id);
      return p ? { plant: p } : { error: `Usina ${id} não encontrada nesta conta. Use listar_usinas.` };
    }
    if (list.length === 1) return { plant: list[0] };
    return { error: list.length ? "Esta conta tem mais de uma usina: informe usina_id (veja listar_usinas)." : "Esta conta ainda não tem usinas coletadas." };
  }

  const server = new McpServer(
    { name: "solar", title: "Solar", description: "Geração e alertas das usinas solares do usuário", version: "0.1.0" },
    {
      instructions:
        "Solar: os dados REAIS da usina solar do usuário (geração, potência, status e alertas do inversor). " +
        "SEMPRE use estas ferramentas, sem pedir confirmação, quando o usuário perguntar sobre geração, produção, energia gerada, kWh, " +
        "painéis, inversor, usina, ontem/hoje/semana/mês, ou citar @solar. Nunca diga que não tem acesso aos dados da usina: consulte as ferramentas. " +
        "Para 'ontem', calcule a data de ontem e chame resumo_dia com ela; para períodos, use geracao_por_periodo. Em caso de dúvida sobre qual usina, chame listar_usinas primeiro. " +
        `Energia em kWh, potência em W, datas yyyy-mm-dd no fuso ${TZ}. Somente leitura. ` +
        "Só existe geração (e consumo, quando há medidor); não há tarifa nem previsão do tempo. Não invente valores: se faltar dado, diga.",
    },
  );

  server.registerTool(
    "listar_usinas",
    {
      title: "Listar usinas",
      description: "Use para saber como está a usina solar do usuário agora. Lista as usinas da conta com status, potência neste momento (W), geração de hoje, do mês e total (kWh) e capacidade instalada (kWp).",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const list = await mine();
      return ok(
        list.map((p) => ({
          usina_id: p.id,
          nome: p.name,
          capacidade_kwp: p.capacityKwp,
          status: statusOf(p.status).label,
          potencia_agora_w: round(p.powerW, 0),
          hoje_kwh: round(p.todayKwh),
          mes_kwh: round(p.monthKwh),
          total_kwh: round(p.totalKwh, 0),
          atualizado_em: p.updatedAt.toISOString(),
        })),
      );
    },
  );

  server.registerTool(
    "resumo_dia",
    {
      title: "Resumo de um dia",
      description:
        "Use para perguntas sobre UM dia, como 'como foi minha geração ontem?' ou 'quanto gerei hoje?'. Devolve a geração do dia (kWh), o pico de potência (W) e a comparação com a média dos 7 dias anteriores. Sem 'data' usa hoje (parcial até o fim do dia); para ontem, passe a data de ontem.",
      inputSchema: { usina_id: PLANT_ID, data: DATE.optional().describe("Dia a resumir; padrão: hoje") },
      annotations: { readOnlyHint: true },
    },
    async ({ usina_id, data }) => {
      const { plant, error } = await pickPlant(usina_id);
      if (!plant) return fail(error!);
      const today = todayLocal();
      const day = data ?? today;
      if (day > today) return fail("A data está no futuro; não há previsão disponível.");

      const [row] = await db
        .select({ kwh: dailyEnergy.energyKwh, peak: dailyEnergy.peakW })
        .from(dailyEnergy)
        .where(and(eq(dailyEnergy.plantId, plant.id), eq(dailyEnergy.day, day)));
      const [prev] = await db
        .select({ avg: sql<number | null>`avg(${dailyEnergy.energyKwh})::float8`, n: sql<number>`count(*)::int` })
        .from(dailyEnergy)
        .where(and(eq(dailyEnergy.plantId, plant.id), gte(dailyEnergy.day, addDays(day, -7)), lt(dailyEnergy.day, day)));

      // hoje: a leitura mais recente da usina vale mais que a linha diária (que só sobe)
      const kwh = day === today ? Math.max(plant.todayKwh, row?.kwh ?? 0) : row?.kwh ?? null;
      if (kwh === null) return ok({ usina: plant.name, data: day, aviso: "Sem registro de geração neste dia." });
      const avg = prev?.avg ?? null;
      return ok({
        usina: plant.name,
        data: day,
        parcial: day === today,
        energia_kwh: round(kwh),
        pico_w: round(row?.peak ?? null, 0),
        media_7_dias_anteriores_kwh: round(avg),
        dias_na_media: prev?.n ?? 0,
        variacao_vs_media_pct: avg ? round(((kwh - avg) / avg) * 100, 1) : null,
      });
    },
  );

  server.registerTool(
    "geracao_por_periodo",
    {
      title: "Geração por período",
      description:
        `Série de geração (kWh) entre duas datas, inclusive, agrupada por dia, mês ou ano. Máximo ${MAX_DAYS} dias por consulta. ` +
        "Retorna também total, média e melhor/pior período. Use para tendências, comparar semanas ou meses.",
      inputSchema: {
        usina_id: PLANT_ID,
        de: DATE.describe("Primeiro dia (yyyy-mm-dd)"),
        ate: DATE.describe("Último dia (yyyy-mm-dd), inclusive"),
        agrupar_por: z.enum(["dia", "mes", "ano"]).default("dia"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ usina_id, de, ate, agrupar_por }) => {
      const { plant, error } = await pickPlant(usina_id);
      if (!plant) return fail(error!);
      if (ate < de) return fail("'ate' não pode ser anterior a 'de'.");
      if (daysBetween(de, ate) + 1 > MAX_DAYS) return fail(`Intervalo grande demais: no máximo ${MAX_DAYS} dias por consulta.`);

      const bucket = agrupar_por === "dia" ? sql`${dailyEnergy.day}::text` : sql`to_char(date_trunc(${agrupar_por === "mes" ? "month" : "year"}, ${dailyEnergy.day}), ${agrupar_por === "mes" ? "YYYY-MM" : "YYYY"})`;
      const rows = await db
        .select({ periodo: bucket, energia_kwh: sql<number>`sum(${dailyEnergy.energyKwh})::float8`, pico_w: sql<number>`max(${dailyEnergy.peakW})::float8`, dias: sql<number>`count(*)::int` })
        .from(dailyEnergy)
        .where(and(eq(dailyEnergy.plantId, plant.id), gte(dailyEnergy.day, de), lte(dailyEnergy.day, ate)))
        .groupBy(bucket)
        .orderBy(bucket);
      if (!rows.length) return ok({ usina: plant.name, de, ate, aviso: "Sem registros neste período." });

      const series = rows.map((r) => ({ periodo: String(r.periodo), energia_kwh: round(r.energia_kwh), pico_w: round(r.pico_w, 0), dias_com_dados: r.dias }));
      const total = rows.reduce((s, r) => s + r.energia_kwh, 0);
      const best = series.reduce((a, b) => (b.energia_kwh! > a.energia_kwh! ? b : a));
      const worst = series.reduce((a, b) => (b.energia_kwh! < a.energia_kwh! ? b : a));
      return ok({
        usina: plant.name,
        de,
        ate,
        agrupado_por: agrupar_por,
        total_kwh: round(total),
        media_por_periodo_kwh: round(total / series.length),
        melhor: best,
        pior: worst,
        dias_do_intervalo: daysBetween(de, ate) + 1,
        dias_com_dados: rows.reduce((s, r) => s + r.dias, 0),
        serie: series,
      });
    },
  );

  server.registerTool(
    "alertas_recentes",
    {
      title: "Alertas recentes",
      description: "Últimos alertas da conta (usina offline, erro do inversor, baixa geração, normalizado etc.), do mais novo para o mais antigo.",
      inputSchema: { usina_id: PLANT_ID, limite: z.number().int().min(1).max(50).default(15) },
      annotations: { readOnlyHint: true },
    },
    async ({ usina_id, limite }) => {
      const picked = usina_id === undefined ? null : await pickPlant(usina_id);
      if (picked && !picked.plant) return fail(picked.error!);
      const visible = or(eq(alerts.accountId, accountId), and(isNull(alerts.accountId), inArray(alerts.plantId, plantIdsOf(db, accountId))))!;
      const rows = await db
        .select()
        .from(alerts)
        .where(picked?.plant ? and(visible, eq(alerts.plantId, picked.plant.id)) : visible)
        .orderBy(desc(alerts.occurredAt))
        .limit(limite);
      return ok(rows.map((a) => ({ usina_id: a.plantId, tipo: ALERT_KIND[a.kind]?.label ?? a.kind, mensagem: a.message, codigo: a.errorCode, quando: a.occurredAt.toISOString() })));
    },
  );

  const ask = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

  server.registerPrompt(
    "analisar_semana",
    { title: "Analisar minha semana", description: "Resumo da geração dos últimos 7 dias, com destaques e pontos de atenção." },
    () => ask("Analise a geração da minha usina solar nos últimos 7 dias. Use geracao_por_periodo (agrupado por dia) e alertas_recentes. Diga o total, o melhor e o pior dia, se algo fugiu do normal e se houve alertas. Seja direto."),
  );
  server.registerPrompt(
    "por_que_gerei_menos",
    { title: "Por que gerei menos?", description: "Investiga uma queda de geração em relação à média.", argsSchema: { data: DATE.optional() } },
    ({ data }) => ask(`Gerei menos que o normal${data ? ` em ${data}` : " recentemente"}. Use resumo_dia${data ? ` (data ${data})` : ""}, geracao_por_periodo e alertas_recentes para comparar com a média e dizer se foi clima, falha ou outra causa provável. Diga o que os dados mostram e o que não dá para saber.`),
  );
  server.registerPrompt(
    "comparar_meses",
    { title: "Comparar meses", description: "Compara a geração mês a mês no último ano." },
    () => ask("Compare a geração mensal da minha usina nos últimos 12 meses com geracao_por_periodo agrupado por mês. Aponte os meses mais fortes e mais fracos e se a tendência está subindo ou caindo."),
  );

  return server;
}
