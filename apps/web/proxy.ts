import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

/**
 * Rotas que respondem sozinhas a quem não está logado, em vez de redirecionar para /login:
 * - endpoints do app de IA (token Bearer / PKCE); /oauth/authorize fica protegido;
 * - API REST: o handler confere a sessão e responde 401 em JSON.
 */
const OPEN = [/^\/mcp$/, /^\/\.well-known\//, /^\/oauth\/(register|token)$/, /^\/api\/(usinas\/[^/]+\/resumo|alertas)$/];

/** Exige login (conta Solplanet ou Livoltek) em todas as páginas, exceto /login e os endpoints do MCP. */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
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
