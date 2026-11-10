import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
// @ts-expect-error script .mjs sem tipos
import { check, envNamesInCode, envNamesInCompose, parseEnvExample, suspectValue } from "../scripts/check-env.mjs";

test("acha variáveis lidas por process.env.X, env.X e env['X']", () => {
  const nomes = envNamesInCode(`const a = process.env.AUTH_SECRET; const b = env.TARIFA_KWH ?? 1; env["TZ"]`);
  assert.deepEqual([...nomes].sort(), ["AUTH_SECRET", "TARIFA_KWH", "TZ"]);
});

test("acha feature flags declaradas como texto na tabela de flags", () => {
  assert.deepEqual([...envNamesInCode(`mcp: { env: "FEATURE_MCP", padrao: true }`)], ["FEATURE_MCP"]);
});

test("acha variáveis interpoladas no compose, com e sem padrão", () => {
  const nomes = envNamesInCompose("ports: ${WEB_PORT:-3000}\nkey: ${EVOLUTION_API_KEY}");
  assert.deepEqual([...nomes].sort(), ["EVOLUTION_API_KEY", "WEB_PORT"]);
});

test("parseia só linhas NOME=valor, ignorando comentários", () => {
  const vars = parseEnvExample("# comentário\nA=\nB=3\n  C=x\n");
  assert.deepEqual([...vars], [["A", ""], ["B", "3"]]);
});

test("aceita vazios, padrões e placeholders", () => {
  assert.equal(suspectValue("AUTH_SECRET", ""), null);
  assert.equal(suspectValue("POLL_MINUTES", "2"), null);
  assert.equal(suspectValue("DATABASE_URL", "postgres://solar_user:SENHA@postgres-db:5432/solar"), null);
  assert.equal(suspectValue("TEST_DATABASE_URL", ""), null);
});

test("recusa segredos com cara de reais", () => {
  assert.ok(suspectValue("X", "ghp_abcdefghijklmnopqrstuvwxyz0123456789"));
  assert.ok(suspectValue("DATABASE_URL", "postgres://solar:s3nh4Real@host:5432/solar"));
  assert.ok(suspectValue("AUTH_SECRET", "troque-isto"), "variável sensível não pode vir preenchida");
  assert.ok(suspectValue("X", "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"));
});

test("o .env.example do repositório está consistente com o código", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  assert.deepEqual(check(root).problems, []);
});
