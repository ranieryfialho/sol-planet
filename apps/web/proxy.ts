import { NextResponse, type NextRequest } from "next/server";
import { flagEnabled, isDocsPath, isMcpPath } from "@/lib/flags";
import { readSession, SESSION_COOKIE } from "@/lib/session";

/**
 * Rotas que respondem sozinhas a quem não está logado, em vez de redirecionar para /login:
 * - endpoints do app de IA (token Bearer / PKCE); /oauth/authorize fica protegido;
 * - API REST: o handler confere a sessão e responde 401 em JSON;
 * - /api/health e /api/metrics: públicos para o monitoramento (sem dados de usina).
 */
const OPEN = [/^\/mcp$/, /^\/\.well-known\//, /^\/oauth\/(register|token)$/, /^\/api\/(usinas\/[^/]+\/resumo|alertas)$/, /^\/api\/(health|metrics)$/];

/** Exige login (conta Solplanet ou Livoltek) em todas as páginas, exceto /login e os endpoints do MCP. */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // feature flag FEATURE_MCP desligada: o MCP, o OAuth e a página "Conectar IA" somem (404)
  if (isMcpPath(pathname) && !flagEnabled("mcp")) return new NextResponse("Não encontrado", { status: 404 });
  // FEATURE_DOCS: o Swagger UI e o contrato são públicos (só descrevem a API); o "Try it out" usa o cookie do login
  if (isDocsPath(pathname)) return flagEnabled("docs") ? NextResponse.next() : new NextResponse("Não encontrado", { status: 404 });
  if (OPEN.some((r) => r.test(pathname))) return NextResponse.next();
  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    // já logado: não mostra o login de novo
    return session ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (session) return NextResponse.next();

  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img/).*)"],
};
