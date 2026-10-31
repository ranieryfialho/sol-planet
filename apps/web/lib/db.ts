import { createDb, type Db } from "@sol/db";

const g = globalThis as unknown as { __db?: Db };
/** Conexão criada no primeiro uso (o build não precisa de DATABASE_URL). */
export const getDb = () => (g.__db ??= createDb());
