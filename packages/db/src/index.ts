import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./accounts";
export * from "./schema";
export * from "./settings";
export { schema };

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL não definido");
  const client = postgres(url, { max: 5, onnotice: () => {} });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
