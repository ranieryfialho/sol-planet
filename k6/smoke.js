// Smoke test do endpoint principal (GET /api/usinas/{id}/resumo), com o SLO como threshold.
//
// Com o docker-compose.local.yml no ar:
//   docker run --rm -i --add-host=host.docker.internal:host-gateway \
//     -e BASE_URL=http://host.docker.internal:3000 grafana/k6:1.3.0 run - < k6/smoke.js
//
// A sessão é assinada aqui mesmo (HMAC-SHA256, igual a apps/web/lib/session.ts) com o AUTH_SECRET do ambiente:
// o teste não depende do login na Solplanet. Padrões = conta e usina demo criadas pelo seed.
import { check, sleep } from "k6";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_SECRET = __ENV.AUTH_SECRET || "dev-local-troque-em-producao";
const ACCOUNT = __ENV.ACCOUNT || "demo@solar.local";
const ACCOUNT_ID = Number(__ENV.ACCOUNT_ID || 1);
const PLANT_ID = __ENV.PLANT_ID || "999001";

export const options = {
  // smoke: carga mínima para validar que o fluxo funciona e medir a latência de base
  scenarios: {
    smoke: { executor: "constant-vus", vus: 2, duration: "30s" },
  },
  thresholds: {
    // SLO (docs/desempenho.md): p95 < 300 ms e menos de 1% de erro no endpoint principal
    "http_req_duration{endpoint:resumo}": ["p(95)<300"],
    "http_req_failed{endpoint:resumo}": ["rate<0.01"],
    checks: ["rate==1"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

function session() {
  const secret = crypto.sha256(`solar-session:${AUTH_SECRET}`, "hex");
  const payload = encoding.b64encode(JSON.stringify({ sub: ACCOUNT, aid: ACCOUNT_ID, exp: Date.now() + 3600_000 }), "rawurl");
  return `${payload}.${crypto.hmac("sha256", secret, payload, "base64rawurl")}`;
}

export function setup() {
  const health = http.get(`${BASE_URL}/api/health`);
  if (health.status !== 200) throw new Error(`serviço fora do ar: /api/health respondeu ${health.status}`);
  return { cookie: `solar_session=${session()}` };
}

export default function ({ cookie }) {
  const res = http.get(`${BASE_URL}/api/usinas/${PLANT_ID}/resumo`, { headers: { Cookie: cookie }, tags: { endpoint: "resumo" } });
  check(res, {
    "status 200": (r) => r.status === 200,
    "resumo da usina certa": (r) => r.json("usina.id") === Number(PLANT_ID),
    "energia de hoje é número": (r) => typeof r.json("hoje.energiaKwh") === "number",
  });
  sleep(0.5);
}
