/**
 * Feature flags por variável de ambiente (FEATURE_<NOME>), lidas a cada chamada: mudar o valor e
 * reiniciar o contêiner liga ou desliga a funcionalidade, sem novo build. Decisão em docs/adr/0002.
 *
 * Valores que desligam: 0, false, off, no (sem diferenciar maiúsculas). Qualquer outro valor liga.
 * Sem a variável vale o padrão da flag, para o ambiente existente não mudar de comportamento.
 */
export const FLAGS = {
  /** servidor MCP, OAuth 2.1 e a página "Conectar minha IA" (fora do escopo B, ver README) */
  mcp: { env: "FEATURE_MCP", padrao: true },
} as const;

export type FlagName = keyof typeof FLAGS;

const OFF = /^(0|false|off|no)$/i;

/** Pura: recebe o `env` por parâmetro, para testar sem mexer em process.env. */
export function flagEnabled(name: FlagName, env: Record<string, string | undefined> = process.env): boolean {
  const { env: key, padrao } = FLAGS[name];
  const raw = env[key]?.trim();
  if (raw === undefined || raw === "") return padrao;
  return !OFF.test(raw);
}

/** Rotas que pertencem à flag `mcp`: com ela desligada, respondem 404 como se não existissem. */
export const MCP_PATHS = [/^\/mcp$/, /^\/\.well-known\/oauth-/, /^\/oauth\//, /^\/conectar-ia(\/|$)/];

export const isMcpPath = (pathname: string) => MCP_PATHS.some((r) => r.test(pathname));
