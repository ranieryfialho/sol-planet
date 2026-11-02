import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { accountForAccessToken } from "@sol/db";
import { getDb } from "@/lib/db";
import { createMcpServer } from "@/lib/mcp-tools";
import { baseUrl, limited, preflight } from "@/lib/oauth-http";

export const dynamic = "force-dynamic";

const unauthorized = (req: Request, description?: string) =>
  new Response(JSON.stringify({ error: "unauthorized", error_description: description ?? "Faça login para conectar." }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "www-authenticate",
      // o cliente de IA segue este link para descobrir o OAuth
      "www-authenticate": `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`,
    },
  });

/**
 * Endpoint MCP (Streamable HTTP, sem sessão): um servidor novo por requisição, preso à conta dona do token.
 * O token vem do OAuth (app/oauth); o modelo do usuário só enxerga as usinas dessa conta.
 */
async function handle(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return unauthorized(req);
  if (limited(req, "mcp", 120)) return new Response("Muitas requisições. Tente de novo em instantes.", { status: 429 });
  const accountId = await accountForAccessToken(getDb(), token);
  if (accountId === null) return unauthorized(req, "Token inválido ou vencido.");

  const server = createMcpServer(accountId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const res = await transport.handleRequest(req);
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-expose-headers", "www-authenticate, mcp-session-id");
  return res;
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = preflight;
