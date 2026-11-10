import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { contratoComOrigem, lerContrato, SWAGGER_HTML } from "../apps/web/lib/docs";

const raiz = fileURLToPath(new URL("..", import.meta.url));

test("lê o contrato real do repositório", () => {
  const yaml = lerContrato(raiz);
  assert.match(yaml, /^openapi: 3\.1\.0/m);
  assert.match(yaml, /\/api\/usinas\/\{id\}\/resumo:/);
});

test("falha com mensagem clara se o contrato não estiver na imagem", () => {
  assert.throws(() => lerContrato("/nao/existe"), /docs\/openapi\.yaml não encontrado/);
});

test("a origem da requisição vira o PRIMEIRO servidor e o servidor local continua depois", () => {
  const saida = contratoComOrigem(lerContrato(raiz), "https://staging.exemplo.test");
  const servers = saida.slice(saida.indexOf("servers:"), saida.indexOf("tags:"));
  assert.ok(servers.indexOf("https://staging.exemplo.test") < servers.indexOf("http://localhost:3000"));
});

test("só mexe no bloco servers (o resto do contrato fica igual)", () => {
  const yaml = lerContrato(raiz);
  const saida = contratoComOrigem(yaml, "https://x.test");
  const extra = "  - url: https://x.test\n    description: Este servidor (o que serve esta página)\n";
  assert.equal(saida.replace(extra, ""), yaml);
});

test("a página do Swagger carrega o contrato do próprio app, com versão fixa dos assets", () => {
  assert.match(SWAGGER_HTML, /url: "\/docs\/openapi\.yaml"/);
  assert.match(SWAGGER_HTML, /swagger-ui\/5\.17\.14\//);
});
