import { registry } from "@sol/observability";

export const dynamic = "force-dynamic";

/** Métricas no formato texto do Prometheus (latência da API + métricas do processo Node). */
export async function GET() {
  return new Response(await registry.metrics(), { headers: { "content-type": registry.contentType } });
}
