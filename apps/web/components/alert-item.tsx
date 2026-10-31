import type { Alert } from "@/lib/queries";
import { ALERT_KIND } from "@/lib/status";
import { Icon, IconBadge, Pill } from "./ui";

/** Separa a mensagem do WhatsApp em título (1ª linha) e detalhe, sem emoji e sem *negrito*. */
export function splitMessage(message: string) {
  const clean = message.replace(/\*/g, "").replace(/^\p{Extended_Pictographic}️?\s*/u, "");
  const [title, ...rest] = clean.split("\n").filter(Boolean);
  return { title: title ?? "", detail: rest.join(" · ") };
}

export function AlertItem({ a, tz, compact = false }: { a: Alert; tz: string; compact?: boolean }) {
  const k = ALERT_KIND[a.kind] ?? { label: a.kind, icon: "info", tone: "gray" as const };
  const { title, detail } = splitMessage(a.message);
  const time = a.occurredAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const tone = k.tone === "sky" ? "sky" : k.tone;
  const pillTone = k.tone === "danger" ? "danger-soft" : k.tone === "sun" ? "sun-soft" : "mint-soft";

  if (compact) {
    return (
      <div className="flex gap-3 rounded-2xl bg-surface-low p-3">
        <IconBadge name={k.icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-5 text-ink">{title}</p>
            {a.notifiedAt && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-mint-dark">
                <Icon name="check" className="text-[14px]" />
                WhatsApp
              </span>
            )}
          </div>
          {detail && <p className="line-clamp-2 text-xs text-ink-2">{detail}</p>}
          <p className="mt-1 text-[11px] text-ink-3">
            {a.occurredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: tz })} · {time}
          </p>
        </div>
      </div>
    );
  }

  return (
    <article className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex gap-4">
        <IconBadge name={k.icon} tone={tone} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-lg font-semibold leading-6">{title}</h3>
            {a.notifiedAt && (
              <Pill tone="gray" icon="check" className="shrink-0 !bg-surface-low !font-semibold !text-mint-dark">
                WhatsApp
              </Pill>
            )}
          </div>
          <Pill tone={pillTone} className="mt-1 !py-0.5">
            {k.label}
          </Pill>
          {detail && <p className="mt-2 text-[15px] leading-6 text-ink-2">{detail}</p>}
          <p className="mt-1 text-sm text-ink-3">{time}</p>
        </div>
      </div>
      {a.deviceSn && (
        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-[13px]">
          <span className="flex items-center gap-1.5 text-ink-2">
            <Icon name="solar_power" className="text-[16px]" />
            Inversor {a.deviceSn}
          </span>
          {a.errorCode && <span className="font-semibold text-danger">Código {a.errorCode}</span>}
        </div>
      )}
    </article>
  );
}
