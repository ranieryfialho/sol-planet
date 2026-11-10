import { contratoComOrigem, lerContrato } from "@/lib/docs";
import { baseUrl } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

/** O contrato OpenAPI (docs/openapi.yaml) com o servidor atual como primeira opção do "Try it out". */
export function GET(req: Request) {
  return new Response(contratoComOrigem(lerContrato(), baseUrl(req)), {
    headers: { "content-type": "application/yaml; charset=utf-8", "cache-control": "no-store" },
  });
}
