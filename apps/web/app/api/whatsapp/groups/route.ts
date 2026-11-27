import { wahaFor } from "@sol/whatsapp";
import { NextResponse } from "next/server";
import { currentSession } from "@/lib/account";

export const dynamic = "force-dynamic";

const cache = new Map<number, { at: number; data: { id: string; subject: string }[] }>();
const TTL_MS = 5 * 60_000;

/**
 * Grupos do WhatsApp da conta logada. Fica numa rota HTTP, e não numa server action, porque a listagem
 * pode demorar com 100+ grupos e as server actions de um cliente rodam em fila (travariam o salvar de Ajustes).
 */
export async function GET(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const force = new URL(req.url).searchParams.get("force") === "1";
  const hit = cache.get(session.aid);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.data);

  const waha = wahaFor(session.aid, session.sub);
  if (!waha.configured) return NextResponse.json([]);
  try {
    const data = (await waha.listGroups()).sort((a, b) => a.subject.localeCompare(b.subject, "pt-BR"));
    // lista vazia não entra no cache: logo após parear a sincronização ainda não terminou
    if (data.length) cache.set(session.aid, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
