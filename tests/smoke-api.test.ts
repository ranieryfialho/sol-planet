import assert from "node:assert/strict";
import { test } from "vitest";
import { readSession } from "../apps/web/lib/session";
// @ts-expect-error script .mjs sem tipos
import { criarSessao, tabela, verificacoes } from "../scripts/smoke-api.mjs";

test("a sessão assinada pelo script é aceita pelo readSession real do app", () => {
  process.env.AUTH_SECRET = "segredo-do-teste";
  const sessao = readSession(criarSessao("segredo-do-teste", "demo@solar.local", 7));
  assert.deepEqual(sessao, { sub: "demo@solar.local", aid: 7 });
});

test("com outro segredo a sessão é recusada", () => {
  process.env.AUTH_SECRET = "segredo-do-teste";
  assert.equal(readSession(criarSessao("outro-segredo")), null);
});

test("não há verificação que grave dados (só GET, e o POST do MCP sem token)", () => {
  const gravam = verificacoes({ docs: true }).filter((v: { metodo?: string; caminho: string }) => (v.metodo ?? "GET") !== "GET" && v.caminho !== "/mcp");
  assert.deepEqual(gravam, []);
});

test("o Swagger só entra na lista quando pedido", () => {
  assert.equal(verificacoes({}).some((v: { caminho: string }) => v.caminho === "/docs"), false);
  assert.equal(verificacoes({ docs: true }).some((v: { caminho: string }) => v.caminho === "/docs"), true);
});

test("a tabela marca falha, sucesso e pulado", () => {
  const t = tabela(
    [
      { nome: "a", caminho: "/a", esperado: 200, status: 200, ok: true },
      { nome: "b", caminho: "/b", esperado: 200, status: 500, ok: false },
      { nome: "c", caminho: "/c", esperado: 200, status: "pulado", ok: null },
    ],
    "http://x",
  );
  assert.match(t, /✅ \| a/);
  assert.match(t, /❌ \| b/);
  assert.match(t, /⏭️ \| c/);
  assert.match(t, /1 verificação\(ões\) falharam/);
});
