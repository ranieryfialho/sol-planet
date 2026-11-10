"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

type NavItem = { href: string; label: string; icon: string; desktopIcon: string; desktopOnly?: boolean; flag?: string };

export const NAV: NavItem[] = [
  { href: "/", label: "Início", icon: "sunny", desktopIcon: "home" },
  { href: "/historico", label: "Histórico", icon: "bar_chart", desktopIcon: "calendar_month" },
  { href: "/alertas", label: "Alertas", icon: "notifications_active", desktopIcon: "notifications" },
  { href: "/inversor", label: "Inversor", icon: "bolt", desktopIcon: "bolt", desktopOnly: true },
  { href: "/conectar-ia", label: "IA", icon: "smart_toy", desktopIcon: "smart_toy", flag: "mcp" },
  { href: "/ajustes", label: "Ajustes", icon: "tune", desktopIcon: "tune" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** `off` lista as flags desligadas: o item de menu que depende delas some (o servidor decide e passa por prop). */
const visible = (off: string[] = []) => NAV.filter((n) => !(n.flag && off.includes(n.flag)));

export function Sidebar({ footer, off }: { footer?: React.ReactNode; off?: string[] }) {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-surface px-5 py-6 shadow-card lg:flex">
      <Link href="/" className="mb-10 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-white shadow-pill-mint">
          <Icon name="solar_power" className="text-[22px]" />
        </span>
        <span>
          <span className="block text-lg font-bold leading-5">Solar</span>
          <span className="block text-xs text-ink-2">Monitoramento</span>
        </span>
      </Link>
      <nav className="flex flex-col gap-1">
        {visible(off).map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] transition-colors ${
                active ? "bg-mint-soft font-semibold text-mint-dark" : "text-ink-2 hover:bg-surface-low"
              }`}
            >
              <Icon name={n.desktopIcon} className="text-[20px]" fill={active} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">{footer}</div>
    </aside>
  );
}

export function BottomNav({ off }: { off?: string[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(27,49,77,0.06)] backdrop-blur-xl lg:hidden">
      <div className="flex h-20 items-center justify-around px-4">
        {visible(off).filter((n) => !n.desktopOnly).map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 ${active ? "font-semibold text-mint" : "text-ink-2"}`}
            >
              <Icon name={n.icon} className="text-[24px]" />
              <span className="text-[11px]">{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Cabeçalho fixo do mobile com o título da tela. */
export function MobileHeader() {
  const path = usePathname();
  const current = NAV.find((n) => isActive(path, n.href));
  const title = path.startsWith("/inversor") ? "Detalhes do Inversor" : (current?.label ?? "Solar");
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-surface/80 pt-[env(safe-area-inset-top)] shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:hidden">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {path.startsWith("/inversor") ? (
            <Link href="/" aria-label="Voltar" className="flex h-9 w-9 items-center justify-center rounded-full">
              <Icon name="arrow_back" className="text-[22px]" />
            </Link>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint/20 text-mint-dark">
              <Icon name="solar_power" className="text-[20px]" />
            </span>
          )}
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        <Link href="/alertas" aria-label="Alertas" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2">
          <Icon name="notifications" className="text-[22px]" />
        </Link>
      </div>
    </header>
  );
}
