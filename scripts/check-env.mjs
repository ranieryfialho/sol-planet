#!/usr/bin/env node
/**
 * Valida o .env.example contra o código:
 *  1. toda variável lida no código (process.env.X / env.X) ou interpolada no compose (${X}) está no .env.example;
 *  2. toda variável do .env.example é usada em algum lugar (sem sobras de variáveis removidas);
 *  3. nenhum valor parece um segredo real (o .env.example só tem vazios, padrões ou placeholders).
 * Uso: node scripts/check-env.mjs   (sai com código 1 se algo estiver fora do lugar; roda na CI)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Variáveis que o código lê mas que NÃO pertencem ao .env.example, cada uma com o motivo. */
export const IGNORADAS = {
  NEXT_RUNTIME: "injetada pelo Next.js",
  SERVICE_NAME: "definida pelo próprio docker-compose de cada serviço",
  LOCAL_AUTH_SECRET: "só do docker-compose.local.yml (ambiente de avaliação)",
  LOCAL_LOG_LEVEL: "só do docker-compose.local.yml",
  LOCAL_WEB_PORT: "só do docker-compose.local.yml",
};

const CODE_EXT = /\.(ts|tsx|mts|mjs|js)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "coverage", "dist"]);

/** Nomes de variáveis referenciados em um trecho de código. */
export function envNamesInCode(source) {
  const names = new Set();
  for (const m of source.matchAll(/\b(?:process\.)?env\.([A-Z][A-Z0-9_]*)\b/g)) names.add(m[1]);
  for (const m of source.matchAll(/\benv\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g)) names.add(m[1]);
  return names;
}

/** Nomes interpolados em um compose: ${VAR}, ${VAR:-padrão}. */
export function envNamesInCompose(source) {
  return new Set([...source.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]));
}

/** Pares nome=valor do .env.example (comentários e linhas em branco ignorados). */
export function parseEnvExample(source) {
  const vars = new Map();
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) vars.set(m[1], m[2].trim());
  }
  return vars;
}

/** Motivo pelo qual um valor parece segredo real, ou null se estiver ok. */
export function suspectValue(name, value) {
  if (value === "") return null;
  if (/^(gh[pousr]_|github_pat_|sk-|AKIA|xox[abp]-|AIza)/.test(value)) return "prefixo de token conhecido";
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) return "chave privada";
  // senha embutida numa URL: só aceita placeholders óbvios (SENHA, USER, password...)
  const url = value.match(/^[a-z]+:\/\/([^:/@\s]+):([^@\s]+)@/i);
  if (url && !/^(SENHA|PASSWORD|SUA_SENHA|CHANGEME|<.*>)$/i.test(url[2])) return "senha real embutida na URL";
  // sequência longa de aleatórios (hex/base64) sem cara de texto
  if (/^[A-Za-z0-9+/_=-]{24,}$/.test(value) && /\d/.test(value) && /[a-zA-Z]/.test(value) && !/^[a-z-]+$/.test(value))
    return "parece uma chave gerada";
  if (/(SECRET|PASSWORD|API_KEY|TOKEN)$/.test(name)) return "variável sensível deve ficar vazia no exemplo";
  return null;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

export function check(root) {
  const example = parseEnvExample(readFileSync(join(root, ".env.example"), "utf8"));
  const used = new Map(); // nome -> primeiro arquivo que usa

  const note = (names, file) => {
    for (const n of names) if (!used.has(n)) used.set(n, relative(root, file));
  };
  for (const top of ["apps", "packages", "scripts", "tests"]) {
    try {
      for (const file of walk(join(root, top))) if (CODE_EXT.test(file) && !/check-env\.(mjs|test\.ts)$/.test(file)) note(envNamesInCode(readFileSync(file, "utf8")), file);
    } catch {
      /* pasta inexistente */
    }
  }
  for (const f of ["docker-compose.yml", "docker-compose.local.yml"]) {
    note(envNamesInCompose(readFileSync(join(root, f), "utf8")), join(root, f));
  }

  const problems = [];
  for (const [name, file] of used) {
    if (name in IGNORADAS || example.has(name)) continue;
    problems.push(`falta no .env.example: ${name} (usada em ${file})`);
  }
  for (const name of example.keys()) {
    if (!used.has(name)) problems.push(`sobra no .env.example: ${name} (nenhum código ou compose a usa)`);
  }
  for (const [name, value] of example) {
    const why = suspectValue(name, value);
    if (why) problems.push(`valor suspeito em ${name}: ${why}`);
  }
  return { problems, total: example.size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const { problems, total } = check(root);
  if (problems.length) {
    console.error(`.env.example inconsistente (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`.env.example ok: ${total} variáveis conferidas com o código e o compose, sem valores suspeitos.`);
}
