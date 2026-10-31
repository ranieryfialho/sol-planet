import Link from "next/link";
import type { ReactNode } from "react";

export function Icon({ name, className = "", fill = false }: { name: string; className?: string; fill?: boolean }) {
  return (
    <span aria-hidden className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}>
      {name}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card bg-surface p-5 shadow-card lg:p-6 ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  icon,
  iconTone = "mint",
  href,
  aside,
  subtitle,
}: {
  title: ReactNode;
  icon?: string;
  iconTone?: keyof typeof TONE_BG;
  href?: string;
  aside?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconBadge name={icon} tone={iconTone} />}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-6 text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] leading-[18px] text-ink-2">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {href && (
          <Link href={href} aria-label="Ver mais" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:text-ink">
            <Icon name="chevron_right" className="text-[20px]" />
          </Link>
        )}
      </div>
    </div>
  );
}

export const TONE_BG = {
  mint: "bg-mint-soft text-mint-dark",
  sun: "bg-sun-soft text-sun",
  sky: "bg-sky-soft text-sky",
  danger: "bg-danger-soft text-danger",
  gray: "bg-pill text-ink-2",
} as const;

export function IconBadge({ name, tone = "mint", size = "md" }: { name: string; tone?: keyof typeof TONE_BG; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12 text-[24px]" : "h-10 w-10 text-[20px]";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${dim} ${TONE_BG[tone]}`}>
      <Icon name={name} className="text-[inherit]" />
    </span>
  );
}

/** Valor grande + unidade cinza ("4,2 kW") */
export function Value({ value, unit, size = "md", className = "" }: { value: ReactNode; unit?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = {
    sm: "text-lg font-bold",
    md: "text-2xl font-bold tracking-tight",
    lg: "text-[32px] leading-[38px] font-extrabold tracking-tight",
    xl: "text-[44px] leading-[52px] font-extrabold tracking-tight",
  };
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      <span className={`${sizes[size]} text-ink`}>{value}</span>
      {unit && <span className="text-xs font-semibold text-ink-3">{unit}</span>}
    </span>
  );
}

export function Pill({ children, tone = "white", icon, className = "" }: { children: ReactNode; tone?: "white" | "mint" | "mint-soft" | "sun-soft" | "danger-soft" | "gray"; icon?: string; className?: string }) {
  const tones = {
    white: "bg-surface text-ink shadow-pill",
    mint: "bg-mint text-white shadow-pill-mint",
    "mint-soft": "bg-mint-soft text-mint-dark",
    "sun-soft": "bg-sun-soft text-sun-dark",
    "danger-soft": "bg-danger-soft text-danger",
    gray: "bg-pill text-ink-2",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold tracking-wide ${tones[tone]} ${className}`}>
      {icon && <Icon name={icon} className="text-[14px]" />}
      {children}
    </span>
  );
}

export function LivePill({ label = "ao vivo" }: { label?: string }) {
  return (
    <Pill tone="white">
      <span className="relative mr-1 flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
      </span>
      {label}
    </Pill>
  );
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <IconBadge name={icon} tone="mint" size="lg" />
      <p className="mt-2 font-semibold text-ink">{title}</p>
      {text && <p className="max-w-xs text-sm text-ink-2">{text}</p>}
    </div>
  );
}
