import { listConnections } from "@sol/db";
import { headers } from "next/headers";
import { Card, CardHeader, EmptyState, Icon, Pill } from "@/components/ui";
import { currentAccountId } from "@/lib/account";
import { getDb } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { publicBaseUrl } from "@/lib/oauth-http";
import { disconnect } from "./actions";
import { AppSteps, CopyButton } from "./connect-guide";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conectar minha IA · Solar" };

const QUESTIONS = [
  "Como foi a geração da minha usina ontem, comparada com a média da semana?",
  "Mostre a geração dos últimos 7 dias e diga o melhor e o pior dia.",
  "Por que gerei menos nos últimos dias? Houve algum alerta?",
  "Compare a geração mês a mês nos últimos 12 meses.",
  "Minha usina está funcionando normalmente agora?",
];

export default async function ConectarIA() {
  const [accountId, h] = await Promise.all([currentAccountId(), headers()]);
  const url = `${publicBaseUrl(h)}/mcp`;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(url);

  // um app por linha: reconectar cria outro token, mas continua sendo o mesmo app
  const rows = await listConnections(getDb(), accountId);
  const connections = [...new Map(rows.map((r) => [r.clientId, r])).values()];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conectar minha IA</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          Use o Claude (ou o Gemini, ainda em teste) para conversar sobre a sua usina. A IA lê os seus dados de geração e responde na própria conversa. O uso fica na sua conta do app de IA.
        </p>
      </div>

      <Card>
        <CardHeader title="1. Copie o endereço" icon="link" subtitle="É o mesmo para qualquer app de IA." />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-2xl bg-surface-low px-4 py-3 text-[14px] text-ink select-all">{url}</code>
          <CopyButton text={url} label="Copiar endereço" className="justify-center" />
        </div>
        {local && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-sun-soft px-4 py-3 text-[13px] leading-5 text-ink-2">
            <Icon name="warning" className="mt-0.5 text-[18px] text-sun" />
            Este é um endereço local, de teste. Claude e Gemini precisam de um endereço público com HTTPS, então só funcionam depois da publicação do sistema.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="2. Adicione no seu app de IA" icon="smart_toy" iconTone="sky" subtitle="Você faz isso uma vez só." />
        <AppSteps />
      </Card>

      <Card>
        <CardHeader title="3. Pergunte" icon="chat" iconTone="sun" subtitle="Toque para copiar uma pergunta e cole na conversa." />
        <ul className="space-y-2">
          {QUESTIONS.map((q) => (
            <li key={q} className="flex items-center gap-3 rounded-2xl bg-surface-low px-4 py-3">
              <span className="min-w-0 flex-1 text-[14px] leading-5 text-ink">{q}</span>
              <CopyButton text={q} label="Copiar" />
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-ink-2">
          <Icon name="lock" className="mt-0.5 text-[18px] text-mint-dark" />
          A IA só lê geração, potência, status e alertas. Ela não altera ajustes, não envia mensagens e não vê a sua senha.
        </p>
      </Card>

      <Card>
        <CardHeader title="Apps conectados" icon="verified_user" iconTone="mint" aside={connections.length > 0 && <Pill tone="mint">{connections.length}</Pill>} />
        {connections.length === 0 ? (
          <EmptyState icon="link_off" title="Nenhum app conectado" text="Depois de conectar, ele aparece aqui e você pode desconectar quando quiser." />
        ) : (
          <ul className="space-y-2">
            {connections.map((c) => (
              <li key={c.clientId} className="flex items-center gap-3 rounded-2xl bg-surface-low px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-mint-dark shadow-pill">
                  <Icon name="smart_toy" className="text-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                  <span className="block text-[12px] text-ink-2">Conectado {timeAgo(c.since)}</span>
                </span>
                <form action={disconnect}>
                  <input type="hidden" name="client_id" value={c.clientId} />
                  <button type="submit" className="rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-semibold text-danger transition hover:brightness-95">
                    Desconectar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
