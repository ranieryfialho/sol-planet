import type { Db } from "@sol/db";
import { timed } from "@sol/observability";
import { z } from "zod";
import { readSession, SESSION_COOKIE } from "../session";
import { ALERT_KIND } from "../status";
import { canSeePlant, listAlerts, loadSummaryInput } from "./repository";
import { buildSummary } from "./summary";

/** Erros seguem um formato só: { erro: string } (ver docs/openapi.yaml). */
const fail = (status: number, erro: string) => Response.json({ erro }, { status });

/** Mesma sessão do dashboard: cookie `solar_session` assinado com HMAC. */
export function sessionFrom(req: Request) {
  const token = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return readSession(token ? decodeURIComponent(token) : undefined);
}

const plantId = z.coerce.number().int().positive();

/** GET /api/usinas/{id}/resumo: fluxo principal da API. */
export function resumoHandler(db: Db, req: Request, rawId: string) {
  return timed("/api/usinas/{id}/resumo", () => resumo(db, req, rawId));
}

async function resumo(db: Db, req: Request, rawId: string) {
  const session = sessionFrom(req);
  if (!session) return fail(401, "não autenticado");
  const id = plantId.safeParse(rawId);
  if (!id.success) return fail(400, "id da usina inválido");
  // usina de outra conta responde 404, não 403: não revela que o id existe
  if (!(await canSeePlant(db, session.aid, id.data))) return fail(404, "usina não encontrada");
  const input = await loadSummaryInput(db, session.aid, id.data);
  if (!input) return fail(404, "usina não encontrada");
  return Response.json(buildSummary(input));
}

const alertQuery = z.object({
  tipo: z.enum(Object.keys(ALERT_KIND) as [string, ...string[]]).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

/** GET /api/alertas?tipo=&limite= */
export function alertasHandler(db: Db, req: Request) {
  return timed("/api/alertas", () => alertas(db, req));
}

async function alertas(db: Db, req: Request) {
  const session = sessionFrom(req);
  if (!session) return fail(401, "não autenticado");
  const q = alertQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return fail(400, "parâmetros inválidos: tipo deve ser um tipo de alerta conhecido e limite entre 1 e 200");
  return Response.json(await listAlerts(db, session.aid, { kind: q.data.tipo, limit: q.data.limite }));
}
