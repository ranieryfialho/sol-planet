import Link from "next/link";
import { AlertItem } from "@/components/alert-item";
import { Card, EmptyState, Icon, IconBadge, Pill } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { countAlerts, getAlerts, getPlants, getAccountSettings, TZ, type Alert, type AlertFilter } from "@/lib/queries";
import { statusOf } from "@/lib/status";

export const dynamic = "force-dynamic";

const FILTERS: { key: AlertFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "erros", label: "Erros" },
  { key: "offline", label: "Offline" },
  { key: "resolvidos", label: "Resolvidos" },
];

const localDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

function dayHeading(day: string) {
  const today = localDay(new Date());
  const yesterday = localDay(new Date(Date.now() - 86400_000));
  const date = new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  if (day === today) return { title: "Hoje", date };
  if (day === yesterday) return { title: "Ontem", date };
  return { title: new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""), date: "" };
}

export default async function Alertas({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = (FILTERS.find((x) => x.key === f)?.key ?? "todos") as AlertFilter;
  const [alerts, counts, plants, settings] = await Promise.all([getAlerts(filter, 60), countAlerts(), getPlants(), getAccountSettings()]);

  const bad = plants.filter((p) => p.status !== 1);
  const last = (await getAlerts("todos", 1))[0];
  const groups = new Map<string, Alert[]>();
  for (const a of alerts) {
    const d = localDay(a.occurredAt);
    groups.set(d, [...(groups.get(d) ?? []), a]);
  }
  const active = settings.recipients.filter((r) => r.enabled);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-9 tracking-tight">Alertas e Notificações</h1>
          <p className="text-[15px] text-ink-2">Registro em tempo real da usina residencial</p>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((x) => {
          const on = x.key === filter;
          return (
            <Link
              key={x.key}
              href={x.key === "todos" ? "/alertas" : `/alertas?f=${x.key}`}
              className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold shadow-pill ${on ? "bg-mint-dark text-white" : "bg-surface text-ink"}`}
            >
              {x.label}
              {on && counts[x.key] > 0 && <span className="rounded-full bg-white/20 px-2 text-xs">{counts[x.key]}</span>}
            </Link>
          );
        })}
      </div>

      {/* status atual */}
      <Card className="relative overflow-hidden !rounded-[2rem]">
        <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full ${bad.length ? "bg-sun-soft" : "bg-mint-soft"}`} />
        <div className="relative flex items-center gap-4">
          <span className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full ${bad.length ? "bg-sun-soft text-sun" : "bg-mint-soft text-mint-dark"}`}>
            <Icon name={bad.length ? "warning" : "check_circle"} className="text-[36px]" />
            <span className={`absolute right-1 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${bad.length ? "bg-sun" : "bg-mint"}`} />
          </span>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Pill tone={bad.length ? "sun-soft" : "mint-soft"} className="uppercase">Status operacional</Pill>
              <span className="text-sm text-ink-2">Ao vivo</span>
            </div>
            <p className="text-xl font-semibold leading-7">
              {bad.length ? bad.map((p) => `${p.name}: ${statusOf(p.status).label}`).join(" · ") : "Tudo funcionando normalmente"}
            </p>
            <p className="text-[15px] text-ink-2">{last ? `Último alerta ${timeAgo(last.occurredAt)}` : "Nenhum alerta registrado ainda"}</p>
          </div>
        </div>
      </Card>

      {alerts.length === 0 ? (
        <Card>
          <EmptyState icon="notifications_off" title="Nenhum alerta nesse filtro" text="Quando algo acontecer com a usina, aparece aqui e no WhatsApp." />
        </Card>
      ) : (
        [...groups.entries()].map(([day, items]) => {
          const h = dayHeading(day);
          return (
            <section key={day} className="space-y-3">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-2">{h.title}</h2>
                <span className="text-sm text-ink-2">{h.date}</span>
              </div>
              {items.map((a) => (
                <AlertItem key={a.id} a={a} tz={TZ} />
              ))}
            </section>
          );
        })
      )}

      <Link href="/ajustes" className="flex items-center gap-4 rounded-[2rem] bg-surface-low p-5">
        <IconBadge name="chat" size="lg" />
        <div className="flex-1">
          <p className="text-xl font-semibold">{active.length ? "Disparos no WhatsApp Ativos" : "WhatsApp sem destinatários"}</p>
          <p className="text-[15px] text-ink-2">
            {active.length ? `Alertas urgentes são enviados para ${active.map((r) => r.name).join(", ")}` : "Configure quem recebe os alertas em Ajustes."}
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-pill">
          <Icon name="settings" />
        </span>
      </Link>
    </div>
  );
}
