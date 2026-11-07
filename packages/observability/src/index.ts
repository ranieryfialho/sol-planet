import pino from "pino";
import { collectDefaultMetrics, Histogram, Registry } from "prom-client";

/**
 * Observabilidade compartilhada por web e worker:
 * - logs estruturados (JSON, uma linha por evento) com pino; LOG_LEVEL ajusta o nível;
 * - uma métrica de negócio da API (latência por rota e status), base do SLO em docs/desempenho.md.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.SERVICE_NAME ?? "sol" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

interface Metrics {
  registry: Registry;
  httpDuration: Histogram<"route" | "status">;
}

/** Um registro só por processo: o dev do Next recarrega módulos e registraria a métrica duas vezes. */
function createMetrics(): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duração das requisições da API REST, por rota e status",
    labelNames: ["route", "status"] as const,
    // concentrados abaixo de 300 ms: o SLO é p95 < 300 ms
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2.5],
    registers: [registry],
  });
  return { registry, httpDuration };
}

const g = globalThis as unknown as { __solMetrics?: Metrics };
export const { registry, httpDuration } = (g.__solMetrics ??= createMetrics());

/** Mede um handler: registra rota, status e duração no histograma e escreve uma linha de log por requisição. */
export async function timed(route: string, run: () => Promise<Response>): Promise<Response> {
  const started = performance.now();
  let status = 500;
  try {
    const res = await run();
    status = res.status;
    return res;
  } catch (err) {
    logger.error({ err, route }, "erro não tratado na requisição");
    throw err;
  } finally {
    const seconds = (performance.now() - started) / 1000;
    httpDuration.observe({ route, status: String(status) }, seconds);
    logger.info({ route, status, ms: Math.round(seconds * 1000) }, "requisição");
  }
}
