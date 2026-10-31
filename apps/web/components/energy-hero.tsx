import Image from "next/image";
import type { PlantFlow } from "@sol/solplanet";
import { n, power } from "@/lib/format";
import type { Inverter, Plant } from "@/lib/queries";
import { statusOf } from "@/lib/status";
import { Icon, Pill, Value } from "./ui";

interface Spot {
  label: string;
  dot: "mint" | "sun";
  value: string;
  unit?: string;
  badge?: React.ReactNode;
  note?: string;
}

/** Monta os 4 pontos da casa conforme o que a instalação tem (medidor / bateria). */
export function heroSpots(plant: Plant, inverter?: Inverter) {
  const flow = (plant.flow ?? null) as PlantFlow | null;
  const pvW = flow?.pv != null ? Number(flow.pv) : plant.powerW;
  const pv = power(pvW);
  const cap = plant.capacityKwp ? (pvW / 1000 / plant.capacityKwp) * 100 : null;
  const st = statusOf(plant.status);

  const solar: Spot = { label: "Solar", dot: "mint", ...pv, note: cap != null ? `${n(cap, 0)}% da capacidade` : undefined };

  const right: Spot = plant.hasBattery
    ? {
        label: "Bateria",
        dot: "mint",
        ...power(Math.abs(Number(flow?.battery ?? 0))),
        badge: flow?.soc ? <Pill tone="mint-soft" className="!px-2 !py-0.5">{flow.soc}%</Pill> : undefined,
      }
    : {
        label: "Inversor",
        dot: plant.status === 1 ? "mint" : "sun",
        value: plant.status === 1 ? "Normal" : st.label,
        note: inverter?.model ?? undefined,
      };

  const left: Spot = plant.hasMeter
    ? { label: "Casa", dot: "sun", ...power(Number(flow?.load ?? 0)), note: "Consumo" }
    : { label: "Hoje", dot: "sun", value: n(plant.todayKwh, 1), unit: "kWh", note: "Produção do dia" };

  const grid = Number(flow?.grid ?? 0);
  const gridSpot: Spot = plant.hasMeter
    ? {
        label: "Rede",
        dot: "mint",
        ...power(Math.abs(grid)),
        badge:
          grid < 0 ? (
            <Pill tone="mint-soft" icon="arrow_upward" className="!px-2 !py-0.5">injetando</Pill>
          ) : grid > 0 ? (
            <Pill tone="sun-soft" icon="arrow_downward" className="!px-2 !py-0.5">comprando</Pill>
          ) : undefined,
      }
    : { label: "Total gerado", dot: "mint", ...(plant.totalKwh >= 1000 ? { value: n(plant.totalKwh / 1000, 2), unit: "MWh" } : { value: n(plant.totalKwh, 0), unit: "kWh" }) };

  return { solar, right, left, grid: gridSpot, pvW };
}

function Dot({ tone }: { tone: "mint" | "sun" }) {
  return <span className={`h-2 w-2 rounded-full ${tone === "mint" ? "bg-mint" : "bg-sun"}`} />;
}

function SpotInline({ s, align = "left", big = false }: { s: Spot; align?: "left" | "right"; big?: boolean }) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end text-right" : ""}`}>
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
        {align === "left" && <Dot tone={s.dot} />}
        {s.label}
        {align === "right" && <Dot tone={s.dot} />}
      </span>
      <span className="mt-0.5 flex items-center gap-1.5">
        <Value value={s.value} unit={s.unit} size={big ? "lg" : "md"} />
        {s.badge}
      </span>
    </div>
  );
}

function SpotCard({ s, className }: { s: Spot; className: string }) {
  return (
    <div className={`absolute z-10 min-w-36 rounded-2xl bg-surface/95 px-4 py-3 shadow-card backdrop-blur ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
          <Dot tone={s.dot} />
          {s.label}
        </span>
        {s.badge}
      </div>
      <Value value={s.value} unit={s.unit} size="lg" className="mt-1" />
      {s.note && <div className="mt-0.5 text-[11px] font-medium text-ink-2">{s.note}</div>}
    </div>
  );
}

/** Versão mobile: rótulos acima e abaixo da imagem (design "Início · mobile"). */
export function EnergyHeroMobile({ plant, inverter }: { plant: Plant; inverter?: Inverter }) {
  const s = heroSpots(plant, inverter);
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-surface/80 p-4 shadow-card backdrop-blur-md">
      <div className="mb-2 flex items-start justify-between">
        <SpotInline s={s.solar} big />
        <SpotInline s={s.right} align="right" />
      </div>
      <div className="relative h-56 overflow-hidden rounded-2xl">
        <Image src="/img/casa-mobile.jpg" alt="Casa com painéis solares" fill priority sizes="100vw" className="object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/50 via-transparent to-transparent" />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <SpotInline s={s.left} />
        <SpotInline s={s.grid} align="right" />
      </div>
    </section>
  );
}

/** Versão desktop: cards flutuando sobre a casa (design "Visão geral · desktop"). */
export function EnergyHeroDesktop({ plant, inverter, lastUpdate }: { plant: Plant; inverter?: Inverter; lastUpdate: string }) {
  const s = heroSpots(plant, inverter);
  const flow = (plant.flow ?? null) as PlantFlow | null;
  const load = Number(flow?.load ?? 0);

  let insight: { icon: string; title: string; text: string };
  if (s.pvW <= 0) {
    insight = { icon: "bedtime", title: "Sem geração no momento", text: "O inversor entra em repouso sem sol e volta sozinho pela manhã." };
  } else if (plant.hasMeter && load > 0) {
    const x = s.pvW / load;
    insight =
      x >= 1
        ? {
            icon: "verified",
            title: x >= 2 ? `Gerando ${n(x, 1)}× o consumo da casa` : `Geração superando o consumo em +${n((x - 1) * 100, 0)}%`,
            text: "Sua casa está autossuficiente agora e exportando o excedente.",
          }
        : { icon: "info", title: `Solar cobre ${n(x * 100, 0)}% do consumo`, text: "O restante está vindo da rede elétrica." };
  } else {
    insight = {
      icon: "verified",
      title: plant.capacityKwp ? `Gerando ${n((s.pvW / 1000 / plant.capacityKwp) * 100, 0)}% da capacidade instalada` : "Gerando energia agora",
      text: `${n(plant.todayKwh, 1)} kWh produzidos hoje.`,
    };
  }

  return (
    <section className="rounded-[2rem] bg-surface p-8 shadow-card">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="max-w-xs text-[28px] font-bold leading-9 tracking-tight">Fluxo de Energia em Tempo Real</h2>
        <div className="flex items-center gap-3 text-xs text-ink-2">
          <Pill tone="mint-soft">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-mint" />
            Sincronizado
          </Pill>
          <span className="leading-4">
            Última leitura:
            <br />
            {lastUpdate}
          </span>
        </div>
      </div>
      <div className="relative h-[420px] overflow-hidden rounded-3xl bg-gradient-to-b from-surface-low to-white">
        <Image src="/img/casa-desktop.jpg" alt="Casa com painéis solares" fill priority sizes="60vw" className="object-cover" />
        <SpotCard s={s.solar} className="left-6 top-6" />
        <SpotCard s={s.right} className="right-6 top-6" />
        <SpotCard s={s.left} className="bottom-6 left-6" />
        <SpotCard s={s.grid} className="bottom-6 right-6" />
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-surface-low px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-white">
          <Icon name={insight.icon} className="text-[18px]" />
        </span>
        <div>
          <p className="font-medium text-ink">{insight.title}</p>
          <p className="text-[13px] text-ink-2">{insight.text}</p>
        </div>
      </div>
    </section>
  );
}
