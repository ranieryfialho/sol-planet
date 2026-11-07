import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Testes unitários (domínio, sem banco) e de integração (*.int.test.ts, Postgres real via TEST_DATABASE_URL).
 * Cobertura mínima DECLARADA: 80% de linhas, funções e statements e 70% de branches,
 * medida no código de domínio e da API. A CI falha se não for cumprida.
 */
export default defineConfig({
  resolve: {
    // mesmo alias do apps/web/tsconfig.json: o teste de integração importa as rotas reais do Next
    alias: { "@": fileURLToPath(new URL("./apps/web", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // o teste de integração escreve no banco: um arquivo por vez
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: [
        "apps/worker/src/domain.ts",
        "apps/worker/src/rollover.ts",
        "apps/web/lib/api/**/*.ts",
        "apps/web/lib/session.ts",
        "packages/db/src/accounts.ts",
        "packages/observability/src/**/*.ts",
      ],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
