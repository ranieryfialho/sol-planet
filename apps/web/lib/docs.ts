import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Onde está o contrato: na imagem Docker (cwd = /app), na raiz do repositório (testes) ou em apps/web (dev). */
const CANDIDATOS = ["docs/openapi.yaml", "../../docs/openapi.yaml"];

export function lerContrato(cwd = process.cwd()): string {
  const arquivo = CANDIDATOS.map((c) => path.join(cwd, c)).find((c) => existsSync(c));
  if (!arquivo) throw new Error("docs/openapi.yaml não encontrado (a imagem do web precisa copiá-lo)");
  return readFileSync(arquivo, "utf8");
}

/**
 * O contrato declara só o servidor local. Para o "Try it out" falar com o servidor que está servindo a página
 * (staging, local...), acrescenta a origem da requisição como PRIMEIRO servidor, o que o Swagger UI seleciona.
 */
export function contratoComOrigem(yaml: string, origem: string): string {
  const novo = `servers:\n  - url: ${origem}\n    description: Este servidor (o que serve esta página)\n`;
  return yaml.replace(/^servers:\n/m, novo);
}

/** Página do Swagger UI (assets do cdnjs, versão fixa). Carrega o contrato do próprio app. */
export const SWAGGER_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sol Planet — API (Swagger UI)</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.css">
  <style>body{margin:0}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/docs/openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>
`;
