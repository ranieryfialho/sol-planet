/**
 * Imprime o cookie de sessão da conta demo criada pelo seed, para chamar a API com curl.
 * Usa o AUTH_SECRET de desenvolvimento do docker-compose.local.yml (ou LOCAL_AUTH_SECRET, se definido).
 *   pnpm demo:session
 */
process.env.AUTH_SECRET = process.env.LOCAL_AUTH_SECRET || "dev-local-troque-em-producao";
const { createSession } = await import("../apps/web/lib/session");
const accountId = Number(process.env.DEMO_ACCOUNT_ID ?? 1);
process.stdout.write(`${createSession("demo@solar.local", accountId)}\n`);
