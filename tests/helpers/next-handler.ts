import { createServer, type IncomingMessage } from "node:http";

/**
 * Adaptador para o Supertest: as rotas do Next (app router) usam Request/Response da Web API,
 * e o Supertest precisa de um servidor HTTP do Node. Cada rota é um padrão de path + o GET real do arquivo route.ts.
 */
export type Route = {
  pattern: RegExp;
  handler: (req: Request, params: Record<string, string>) => Promise<Response>;
};

const toRequest = (req: IncomingMessage) => {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  return new Request(`http://localhost${req.url}`, { method: req.method, headers });
};

export function serveRoutes(routes: Route[]) {
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const route = routes.find((r) => r.pattern.test(path));
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    try {
      const response = await route.handler(toRequest(req), path.match(route.pattern)?.groups ?? {});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
}
