import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import type { Db } from "./index";
import { oauthClients, oauthCodes, oauthTokens } from "./schema";

export const ACCESS_TTL_S = 3600;
const REFRESH_TTL_S = 30 * 86400;
const CODE_TTL_S = 300;

const hash = (v: string) => createHash("sha256").update(v).digest("base64url");
const secret = () => randomBytes(32).toString("base64url");
const inSeconds = (s: number) => new Date(Date.now() + s * 1000);

export async function registerClient(db: Db, name: string, redirectUris: string[]) {
  const [row] = await db.insert(oauthClients).values({ id: `mcp_${randomBytes(16).toString("base64url")}`, name, redirectUris }).returning();
  return row;
}

export async function findClient(db: Db, id: string) {
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.id, id));
  return row;
}

/** Cria o código de autorização e devolve o valor em claro (vai na URL de volta ao cliente). */
export async function createAuthCode(db: Db, p: { clientId: string; accountId: number; redirectUri: string; codeChallenge: string }) {
  const code = secret();
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date())); // limpa os vencidos
  await db.insert(oauthCodes).values({ codeHash: hash(code), ...p, expiresAt: inSeconds(CODE_TTL_S) });
  return code;
}

/** Consome o código (uso único): apaga a linha e devolve os dados se ainda valia. */
export async function takeAuthCode(db: Db, code: string) {
  const [row] = await db.delete(oauthCodes).where(eq(oauthCodes.codeHash, hash(code))).returning();
  return row && row.expiresAt.getTime() > Date.now() ? row : null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}

export async function issueTokens(db: Db, clientId: string, accountId: number): Promise<TokenPair> {
  const access = secret();
  const refresh = secret();
  await db.insert(oauthTokens).values([
    { tokenHash: hash(access), kind: "access", clientId, accountId, expiresAt: inSeconds(ACCESS_TTL_S) },
    { tokenHash: hash(refresh), kind: "refresh", clientId, accountId, expiresAt: inSeconds(REFRESH_TTL_S) },
  ]);
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: ACCESS_TTL_S };
}

/** Troca o refresh por um par novo (o antigo deixa de valer). null se inválido, vencido ou de outro cliente. */
export async function rotateRefresh(db: Db, refresh: string, clientId: string) {
  const [row] = await db
    .delete(oauthTokens)
    .where(and(eq(oauthTokens.tokenHash, hash(refresh)), eq(oauthTokens.kind, "refresh"), eq(oauthTokens.clientId, clientId)))
    .returning();
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return issueTokens(db, row.clientId, row.accountId);
}

/** Conta dona do access token, ou null. */
export async function accountForAccessToken(db: Db, token: string) {
  const [row] = await db
    .select({ accountId: oauthTokens.accountId, expiresAt: oauthTokens.expiresAt })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.tokenHash, hash(token)), eq(oauthTokens.kind, "access")));
  return row && row.expiresAt.getTime() > Date.now() ? row.accountId : null;
}

/** Conexões ativas da conta (um app de IA por linha), para a tela de revogação. */
export async function listConnections(db: Db, accountId: number) {
  const rows = await db
    .select({ clientId: oauthTokens.clientId, name: oauthClients.name, since: oauthTokens.createdAt })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .where(and(eq(oauthTokens.accountId, accountId), eq(oauthTokens.kind, "refresh")));
  return rows;
}

export const revokeConnection = (db: Db, accountId: number, clientId: string) =>
  db.delete(oauthTokens).where(and(eq(oauthTokens.accountId, accountId), eq(oauthTokens.clientId, clientId)));
