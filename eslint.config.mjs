// ESLint (flat config): recomendadas de JS + TypeScript, mais Next e React Hooks no apps/web.
// Sem checagem de tipos aqui: os tipos já são verificados pelo `pnpm typecheck`.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/next-env.d.ts", "coverage/**", "design/**", "apks/**", "packages/db/drizzle/**"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // `_` marca o que é de propósito não usado
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: "apps/web" } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Clientes de APIs externas sem documentação pública (Solplanet e Livoltek por engenharia reversa, WAHA):
    // as respostas chegam como JSON sem contrato estável, então `any` é a fronteira consciente. O resto do código é tipado.
    files: ["packages/solplanet/**", "packages/livoltek/**", "packages/whatsapp/**", "apps/worker/src/{collector,livoltek-collector,cli}.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    // k6 roda no runtime do k6 (não Node): globals próprios
    files: ["k6/**/*.js"],
    languageOptions: { globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly" } },
  },
);
