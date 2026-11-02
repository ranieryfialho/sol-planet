import { currentSession } from "@/lib/account";
import { validateAuthRequest } from "@/lib/oauth-request";
import { Icon } from "@/components/ui";
import { decide } from "./actions";

export const metadata = { title: "Conectar IA · Solar" };

type Params = Record<string, string | undefined>;

const shell = "flex min-h-dvh items-center justify-center px-4 py-8";
const card = "w-full max-w-md rounded-[2rem] bg-surface p-6 shadow-card sm:p-10";

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const session = await currentSession(); // o proxy já garante o login; aqui só pegamos o nome da conta
  const v = await validateAuthRequest(p);

  // nunca redireciona para um endereço não validado: mostra o erro aqui
  if ("error" in v || p.response_type !== "code" || p.code_challenge_method !== "S256" || !p.code_challenge) {
    console.warn("[oauth/authorize] recusado", JSON.stringify({ motivo: "error" in v ? v.error : "pkce/response_type", client_id: p.client_id, redirect_uri: p.redirect_uri, response_type: p.response_type, method: p.code_challenge_method }).slice(0, 1000));
    return (
      <div className={shell}>
        <div className={card}>
          <h1 className="text-2xl font-bold tracking-tight">Pedido inválido</h1>
          <p className="mt-2 text-[15px] text-ink-2">{"error" in v ? v.error : "O aplicativo não enviou os dados de segurança esperados (PKCE)."} Volte ao aplicativo e tente conectar de novo.</p>
        </div>
      </div>
    );
  }

  const hidden = { client_id: v.client.id, redirect_uri: v.redirectUri, code_challenge: p.code_challenge, code_challenge_method: "S256", state: p.state ?? "" };

  return (
    <div className={shell}>
      <form action={decide} className={card}>
        {Object.entries(hidden).map(([k, val]) => (
          <input key={k} type="hidden" name={k} value={val} />
        ))}
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-mint-soft text-mint-dark">
          <Icon name="smart_toy" className="text-[28px]" />
        </span>
        <h1 className="text-2xl font-bold leading-8 tracking-tight">
          Permitir que <span className="text-mint-dark">{v.client.name}</span> veja suas usinas?
        </h1>
        <p className="mt-2 text-[15px] text-ink-2">
          Conta: <span className="font-semibold text-ink">{session?.sub}</span>
        </p>

        <ul className="mt-6 space-y-3 rounded-2xl bg-surface-low p-4 text-[14px] leading-5 text-ink-2">
          <li className="flex gap-3">
            <Icon name="visibility" className="text-[20px] text-mint-dark" />
            Ler geração, potência, status e alertas das suas usinas.
          </li>
          <li className="flex gap-3">
            <Icon name="lock" className="text-[20px] text-mint-dark" />
            Somente leitura: não altera ajustes nem envia mensagens, e não tem acesso à sua senha.
          </li>
          <li className="flex gap-3">
            <Icon name="undo" className="text-[20px] text-mint-dark" />
            Você pode revogar o acesso quando quiser.
          </li>
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button name="decision" value="deny" className="h-12 rounded-full bg-surface-low text-[15px] font-semibold text-ink transition hover:brightness-95">
            Cancelar
          </button>
          <button name="decision" value="allow" className="h-12 rounded-full bg-mint text-[15px] font-bold text-white shadow-pill-mint transition hover:brightness-105">
            Permitir
          </button>
        </div>
      </form>
    </div>
  );
}
