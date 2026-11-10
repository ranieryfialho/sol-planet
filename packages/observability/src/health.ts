import { sql } from "drizzle-orm";
import type { Db } from "@sol/db";
import { logger, timed } from "./index";

/** Saúde do serviço: a aplicação responde e o banco aceita consultas. 503 se o banco cair. */
export function handleHealth(db: () => Db): Promise<Response> {
  return timed("/api/health", async () => {
    const started = performance.now();
    try {
      await db().execute(sql`select 1`);
      return Response.json({ status: "ok", banco: "ok", latenciaBancoMs: Math.round(performance.now() - started), uptimeS: Math.round(process.uptime()) });
    } catch (err) {
      logger.error({ err }, "health: banco indisponível");
      return Response.json({ status: "degradado", banco: "indisponível" }, { status: 503 });
    }
  });
}
