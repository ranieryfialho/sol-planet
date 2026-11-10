import { SWAGGER_HTML } from "@/lib/docs";

export const dynamic = "force-dynamic";

/** Swagger UI do contrato da API. Só existe com FEATURE_DOCS ligada (o proxy responde 404 sem ela). */
export function GET() {
  return new Response(SWAGGER_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
}
