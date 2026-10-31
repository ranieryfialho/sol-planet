import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq, isNull, sql } from "drizzle-orm";
import type { Db } from "./index";
import { accountPlants, accounts, kv, plants } from "./schema";
import { accountKey, defaultSettings } from "./settings";

export type Account = typeof accounts.$inferSelect;

/** Máximo de contas Solplanet aceitas (a principal do .env conta). */
export const maxAccounts = () => Number(process.env.MAX_ACCOUNTS ?? 3);

export const normalizeAccount = (a: string) => a.trim().toLowerCase();

/** Conta administradora (WhatsApp compartilhado): ADMIN_ACCOUNT, ou SOLPLANET_ACCOUNT do .env. */
const adminAccount = () => process.env.ADMIN_ACCOUNT || process.env.SOLPLANET_ACCOUNT || "";
export const isPrimaryAccount = (a: string) => !!adminAccount() && normalizeAccount(a) === normalizeAccount(adminAccount());

/** Segredo do app: AUTH_SECRET, ou (legado) derivado da credencial do .env. Sem nenhum dos dois, recusa em vez de usar um valor fixo. */
export function appSecret() {
  const s = process.env.AUTH_SECRET || (process.env.SOLPLANET_ACCOUNT && `${process.env.SOLPLANET_ACCOUNT}:${process.env.SOLPLANET_PASSWORD}`);
  if (!s) throw new Error("AUTH_SECRET não definido no .env (openssl rand -hex 32)");
  return s;
}

const key = () => createHash("sha256").update(`solar-accounts:${appSecret()}`).digest();

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

/** null se o segredo mudou ou o valor foi adulterado. */
export function decryptSecret(enc: string) {
  try {
    const [iv, tag, ct] = enc.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const listAccounts = (db: Db) => db.select().from(accounts).orderBy(accounts.id);

export async function findAccount(db: Db, account: string) {
  const [row] = await db.select().from(accounts).where(eq(accounts.account, normalizeAccount(account)));
  return row;
}

/** Cria ou atualiza a senha de uma conta. A conta principal adota os dados anteriores ao multiusuário. */
export async function upsertAccount(db: Db, account: string, password: string): Promise<Account> {
  const login = normalizeAccount(account);
  if (!login || !password) throw new Error("conta e senha são obrigatórias");
  const passwordEnc = encryptSecret(password);
  const [row] = await db
    .insert(accounts)
    .values({ account: login, passwordEnc })
    .onConflictDoUpdate({ target: accounts.account, set: { passwordEnc } })
    .returning();
  if (isPrimaryAccount(login)) await adoptLegacy(db, row.id);
  return row;
}

/** Ids das usinas que a conta enxerga (própria ou compartilhada), como subconsulta. */
export const plantIdsOf = (db: Db, accountId: number) => db.select({ id: accountPlants.plantId }).from(accountPlants).where(eq(accountPlants.accountId, accountId));

/** A conta passa a enxergar a usina (idempotente). */
export const addMember = (db: Db, accountId: number, plantId: number) => db.insert(accountPlants).values({ accountId, plantId }).onConflictDoNothing();

/** Dados do tempo de conta única (usinas, ajustes, último relatório) passam a pertencer à conta principal. */
async function adoptLegacy(db: Db, accountId: number) {
  await db.execute(sql`insert into account_plants (account_id, plant_id) select ${accountId}, id from plants where account_id is null on conflict do nothing`);
  await db.update(plants).set({ accountId }).where(isNull(plants.accountId));
  for (const base of ["settings", "last_report", "last_report_at"]) {
    await db.execute(sql`
      insert into kv (key, value) select ${accountKey(base, accountId)}, value from kv where key = ${base}
      on conflict (key) do nothing`);
  }
  // sem ajustes antigos: a principal começa com os padrões do .env (destinatários inclusos)
  await db.insert(kv).values({ key: accountKey("settings", accountId), value: defaultSettings() }).onConflictDoNothing();
}
