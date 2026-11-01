import type { PlantFlow } from "@sol/solplanet";
import { n, power } from "@/lib/format";
import type { Inverter, Plant } from "@/lib/queries";
import { statusOf } from "@/lib/status";
import { PlantScene, type SceneLabel } from "./plant-scene";
import { Icon, Pill } from "./ui";

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

const toLabel = (s: Spot): SceneLabel => ({ label: s.label, value: s.value, unit: s.unit, note: s.note, tone: s.dot });

/** Os 4 pontos da casa no formato da cena (rótulos desenhados no SVG). */
export function sceneLabels(s: ReturnType<typeof heroSpots>) {
  return { left: toLabel(s.left), solar: toLabel(s.solar), inverter: toLabel(s.right), bottom: toLabel(s.grid) };
}

/** Versão mobile: a cena ocupa o card, com rótulos, endereço e sol dentro dela (como a referência). */
export function EnergyHeroMobile({ plant, inverter, preview }: { plant: Plant; inverter?: Inverter; preview?: boolean }) {
  const s = heroSpots(plant, inverter);
  return (
    <section className="relative h-[420px] overflow-hidden rounded-[2rem] shadow-card">
      <PlantScene plant={plant} pvW={s.pvW} labels={sceneLabels(s)} inverterOk={plant.status === 1} compact preview={preview} />
    </section>
  );
}

/** Versão desktop: rótulos sobre a cena da casa, com linhas até o painel e o inversor. */
export function EnergyHeroDesktop({ plant, inverter, lastUpdate, preview }: { plant: Plant; inverter?: Inverter; lastUpdate: string; preview?: boolean }) {
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
      <div className="relative h-[440px] overflow-hidden rounded-3xl">
        <PlantScene plant={plant} pvW={s.pvW} labels={sceneLabels(s)} inverterOk={plant.status === 1} preview={preview} />
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
