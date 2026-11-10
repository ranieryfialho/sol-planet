import assert from "node:assert/strict";
import { test } from "vitest";
import { flagEnabled, isDocsPath, isMcpPath } from "../apps/web/lib/flags";

test("sem a variável vale o padrão (MCP ligado), para não mudar o ambiente existente", () => {
  assert.equal(flagEnabled("mcp", {}), true);
  assert.equal(flagEnabled("mcp", { FEATURE_MCP: "" }), true);
});

test("0, false, off e no desligam, sem diferenciar maiúsculas", () => {
  for (const v of ["0", "false", "FALSE", "off", "Off", "no", " false "]) {
    assert.equal(flagEnabled("mcp", { FEATURE_MCP: v }), false, v);
  }
});

test("qualquer outro valor liga", () => {
  for (const v of ["1", "true", "on", "sim"]) assert.equal(flagEnabled("mcp", { FEATURE_MCP: v }), true, v);
});

test("as rotas do MCP, do OAuth e da página de conexão pertencem à flag; o resto não", () => {
  for (const p of ["/mcp", "/oauth/token", "/oauth/authorize", "/.well-known/oauth-protected-resource", "/conectar-ia"]) {
    assert.equal(isMcpPath(p), true, p);
  }
  for (const p of ["/", "/api/health", "/api/usinas/1/resumo", "/historico", "/login"]) {
    assert.equal(isMcpPath(p), false, p);
  }
});

test("a flag docs nasce DESLIGADA: sem a variável o Swagger não existe (a produção não muda)", () => {
  assert.equal(flagEnabled("docs", {}), false);
  assert.equal(flagEnabled("docs", { FEATURE_DOCS: "" }), false);
  assert.equal(flagEnabled("docs", { FEATURE_DOCS: "true" }), true);
  assert.equal(flagEnabled("docs", { FEATURE_DOCS: "off" }), false);
});

test("as rotas do Swagger e do contrato pertencem à flag docs; o resto não", () => {
  for (const p of ["/docs", "/docs/", "/docs/openapi.yaml"]) assert.equal(isDocsPath(p), true, p);
  for (const p of ["/", "/api/health", "/docs/outra", "/documentos", "/conectar-ia"]) assert.equal(isDocsPath(p), false, p);
});
