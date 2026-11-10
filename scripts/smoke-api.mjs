#!/usr/bin/env node
/**
 * Verificação da API em um ambiente no ar (staging, local...). Só faz chamadas que NÃO gravam dados.
 *
 *   BASE_URL=https://staging-solar.rafiweb.com.br AUTH_SECRET=<segredo do ambiente> node scripts/smoke-api.mjs
 *
 * Autenticação das chamadas com login (uma das duas):
 *   AUTH_SECRET     assina a sessão da conta demo, como o k6/smoke.js (só quem conhece o segredo do ambiente)
 *   SESSION_COOKIE  valor do cookie `solar_session` copiado do navegador após o login demo
 * Sem nenhuma das duas, só as verificações sem login rodam e as demais aparecem como "pulado".
 *
 * CHECK_DOCS=1 confere também o Swagger (/docs), que só existe com FEATURE_DOCS ligada.
 * Sai com código 1 se alguma verificação falhar.
 */
import { createHash, createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

/** Mesma assinatura do apps/web/lib/session.ts (testada contra o readSession real em tests/smoke-api.test.ts). */
export function criarSessao(authSecret, conta = "demo@solar.local", aid = 1, agora = Date.now()) {
  const chave = createHash("sha256").update(`solar-session:${authSecret}`).digest("hex");
  const payload = Buffer.from(JSON.stringify({ sub: conta, aid, exp: agora + 3600_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", chave).update(payload).digest("base64url")}`;
}

/** Lista de verificações: nome, requisição e como julgar a resposta. `login` = precisa do cookie. */
export function verificacoes({ plantId = "999001", docs = false } = {}) {
  const json = async (r) => r.json();
  const lista = [
    { nome: "saúde", caminho: "/api/health", esperado: 200, valida: async (r) => (await json(r)).status === "ok" },
    { nome: "métricas (Prometheus)", caminho: "/api/metrics", esperado: 200, valida: async (r) => (await r.text()).includes("http_request_duration_seconds") },
    { nome: "descoberta OAuth do MCP", caminho: "/.well-known/oauth-protected-resource", esperado: 200, valida: async (r) => String((await json(r)).resource).endsWith("/mcp") },
    { nome: "MCP sem token é recusado", caminho: "/mcp", metodo: "POST", corpo: "{}", esperado: 401 },
    { nome: "resumo sem login é recusado", caminho: `/api/usinas/${plantId}/resumo`, esperado: 401 },
    { nome: "alertas sem login é recusado", caminho: "/api/alertas", esperado: 401 },
    { nome: "resumo da usina demo", caminho: `/api/usinas/${plantId}/resumo`, login: true, esperado: 200, valida: async (r) => (await json(r)).usina?.id === Number(plantId) },
    { nome: "usina inexistente → 404", caminho: "/api/usinas/999999999/resumo", login: true, esperado: 404 },
    { nome: "id inválido → 400", caminho: "/api/usinas/abc/resumo", login: true, esperado: 400 },
    { nome: "alertas filtrados", caminho: "/api/alertas?tipo=offline&limite=5", login: true, esperado: 200, valida: async (r) => Array.isArray(await json(r)) },
    { nome: "filtro de alerta inválido → 400", caminho: "/api/alertas?tipo=invalido", login: true, esperado: 400 },
  ];
  if (docs) {
    lista.push(
      { nome: "Swagger UI (/docs)", caminho: "/docs", esperado: 200, valida: async (r) => (await r.text()).includes("SwaggerUIBundle") },
      { nome: "contrato OpenAPI servido", caminho: "/docs/openapi.yaml", esperado: 200, valida: async (r) => (await r.text()).startsWith("openapi: 3.1") },
    );
  }
  return lista;
}

export async function executar({ base, cookie, docs, plantId }) {
  const resultados = [];
  for (const v of verificacoes({ docs, plantId })) {
    if (v.login && !cookie) {
      resultados.push({ ...v, status: "pulado", ok: null });
      continue;
    }
    try {
      const r = await fetch(base + v.caminho, {
        method: v.metodo ?? "GET",
        headers: { ...(v.login ? { Cookie: `solar_session=${cookie}` } : {}), ...(v.corpo ? { "content-type": "application/json" } : {}) },
        body: v.corpo,
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      });
      const ok = r.status === v.esperado && (v.valida ? await v.valida(r) : true);
      resultados.push({ ...v, status: r.status, ok });
    } catch (e) {
      resultados.push({ ...v, status: `erro: ${e.cause?.code ?? e.message}`, ok: false });
    }
  }
  return resultados;
}

export function tabela(resultados, base) {
  const linhas = resultados.map((r) => `| ${r.ok === null ? "⏭️" : r.ok ? "✅" : "❌"} | ${r.nome} | \`${r.metodo ?? "GET"} ${r.caminho}\` | ${r.esperado} | ${r.status} |`);
  const falhas = resultados.filter((r) => r.ok === false).length;
  return [`## Verificação da API (${base})\n`, "| | Verificação | Chamada | Esperado | Obtido |", "|---|---|---|---|---|", ...linhas, "", falhas ? `**${falhas} verificação(ões) falharam.**` : "Todas as verificações passaram."].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const cookie = process.env.SESSION_COOKIE || (process.env.AUTH_SECRET ? criarSessao(process.env.AUTH_SECRET) : "");
  const resultados = await executar({ base, cookie, docs: process.env.CHECK_DOCS === "1", plantId: process.env.PLANT_ID });
  console.log(tabela(resultados, base));
  process.exit(resultados.some((r) => r.ok === false) ? 1 : 0);
}
