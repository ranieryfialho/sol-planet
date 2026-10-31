import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const root = path.join(import.meta.dirname, "../../");
// dev: usa o mesmo .env da raiz que o worker (no Docker as variáveis vêm do compose)
const rootEnv = path.join(root, ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  transpilePackages: ["@sol/db", "@sol/solplanet"],
  serverExternalPackages: ["postgres"],
};

export default config;
