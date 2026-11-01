import Link from "next/link";
import type { ParamRow } from "@sol/solplanet";
import { PowerArea } from "@/components/charts";
import { heroSpots, sceneLabels } from "@/components/energy-hero";
import { PlantScene } from "@/components/plant-scene";
import { Card, CardHeader, EmptyState, Icon, IconBadge, Pill, Value } from "@/components/ui";
import { fmtPower, n, power, timeAgo } from "@/lib/format";
import { getCurrentPlant, getInverters, getTodayReadings, TZ } from "@/lib/queries";
import { statusOf } from "@/lib/status";

export const dynamic = "force-dynamic";

const num = (v: unknown) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : null;
};

/** Procura um valor numérico por nome de chave (a API não é uniforme entre modelos). */
function findNum(obj: unknown, re: RegExp): number | null {
  if (!obj || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj)) {
    if (re.test(k)) {
      const x = num(v);
      if (x !== null) return x;
    }
  }
  return null;
}

export default async function Inversor({ searchParams }: { searchParams: Promise<{ sn?: string }> }) {
  const { sn } = await searchParams;
  const plant = await getCurrentPlant();
  if (!plant) {
    return (
      <Card>
        <EmptyState icon="solar_power" title="Sem dados do inversor" text="Aguardando a primeira coleta do worker." />
      </Card>
    );
  }
  const [invs, readings] = await Promise.all([getInverters(plant.id), getTodayReadings(plant.id)]);
  const inv = invs.find((i) => i.sn === sn) ?? invs[0];

  const status = statusOf(inv?.status ?? plant.status);
  const online = (inv?.status ?? plant.status) !== 0;
  const ac = ((inv?.ac ?? []) as ParamRow[]).filter(Boolean);
  const pv = ((inv?.pv ?? []) as ParamRow[]).filter((r) => (num(r.v) ?? 0) > 0 || (num(r.p) ?? 0) > 0 || (num(r.i) ?? 0) > 0);
  const raw = { ...((inv?.raw ?? {}) as object), ...((inv?.params ?? {}) as object) };

  const acPower = inv?.powerW ?? plant.powerW;
  const freq = findNum(raw, /^(fac|freq|frequency|gridFreq)/i);
  const temp = findNum(raw, /temp/i);
  const metrics = [
    { label: "Potência AC", icon: "bolt", tone: "mint" as const, ...power(acPower), hint: plant.capacityKwp ? `${n((acPower / 1000 / plant.capacityKwp) * 100, 0)}% da capacidade` : undefined, hintTone: "text-mint-dark" },
    ac[0]?.v != null && { label: "Tensão AC", icon: "speed", tone: "sun" as const, value: n(num(ac[0].v) ?? 0, 0), unit: "V", hint: ac[0].name ? `Fase ${ac[0].name}` : undefined },
    ac[0]?.i != null && { label: "Corrente AC", icon: "electric_meter", tone: "sky" as const, value: n(num(ac[0].i) ?? 0, 1), unit: "A" },
    freq != null && { label: "Frequência", icon: "waves", tone: "sky" as const, value: n(freq, 1), unit: "Hz", hint: "Sincronizado" },
    temp != null && { label: "Temperatura", icon: "device_thermostat", tone: "sun" as const, value: n(temp, 0), unit: "°C" },
    { label: "Hoje", icon: "today", tone: "mint" as const, value: n(plant.todayKwh, 1), unit: "kWh" },
  ].filter(Boolean) as { label: string; icon: string; tone: "mint" | "sun" | "sky"; value: string; unit?: string; hint?: string; hintTone?: string }[];

  const spots = heroSpots(plant, inv);
  const sceneOk = online && plant.status === 1;
  const pvTotal = pv.reduce((s, r) => s + (num(r.p) ?? 0), 0);
  const points = readings.map((r) => ({ t: r.ts.getTime(), power: r.powerW, load: null }));
  const peak = readings.reduce((m, r) => Math.max(m, r.powerW ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="hidden text-[28px] font-bold tracking-tight lg:block">Detalhes do Inversor</h1>

      {invs.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {invs.map((i) => (
            <Link key={i.sn} href={`/inversor?sn=${i.sn}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-pill ${i.sn === inv?.sn ? "bg-mint-dark text-white" : "bg-surface"}`}>
              {i.name ?? i.sn}
            </Link>
          ))}
        </div>
      )}

      <Card className="!rounded-[2rem]">
        <div className="flex items-start justify-between">
          <div>
            <Pill tone={online ? "mint" : "sun-soft"}>
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
              {online ? "Online · Operando" : status.label}
            </Pill>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{inv?.model ?? inv?.name ?? "Inversor Solplanet"}</h2>
            <p className="text-sm text-ink-2">SN: {inv?.sn ?? "—"}</p>
          </div>
          <IconBadge name="solar_power" tone="sky" />
        </div>
        <div className="relative mt-4 h-[420px] overflow-hidden rounded-3xl bg-surface-low md:hidden">
          <PlantScene plant={plant} pvW={spots.pvW} labels={sceneLabels(spots)} inverterOk={sceneOk} compact />
        </div>
        <div className="relative mt-4 hidden h-[440px] overflow-hidden rounded-3xl bg-surface-low md:block">
          <PlantScene plant={plant} pvW={spots.pvW} labels={sceneLabels(spots)} inverterOk={sceneOk} />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-full bg-surface-low px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="wifi" className="text-[18px]" />
            Última comunicação
          </span>
          <span className="font-semibold text-mint-dark">{timeAgo(inv?.updatedAt ?? plant.updatedAt)}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[1.75rem] bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between">
              <span className="text-[15px] text-ink-2">{m.label}</span>
              <IconBadge name={m.icon} tone={m.tone} />
            </div>
            <Value value={m.value} unit={m.unit} size="lg" className="mt-1" />
            {m.hint && <p className={`mt-0.5 text-xs ${m.hintTone ?? "text-ink-2"}`}>{m.hint}</p>}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Strings Fotovoltaicas" icon="grid_view" aside={pv.length > 0 && <Pill tone="gray">{pv.length} ativas</Pill>} />
        {pv.length === 0 ? (
          <p className="text-sm text-ink-2">{online ? "Sem dados das strings neste modelo ou no último ciclo." : "Strings sem geração no momento."}</p>
        ) : (
          <div className="space-y-3">
            {pv.map((r, i) => {
              const p = num(r.p) ?? 0;
              const share = pvTotal ? (p / pvTotal) * 100 : 0;
              return (
                <div key={r.name ?? i} className="rounded-2xl bg-surface-low p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">Entrada {r.name ?? `PV${i + 1}`}</span>
                    <span className="font-bold text-mint-dark">{fmtPower(p)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">
                    Tensão: {n(num(r.v) ?? 0, 0)} V · Corrente: {n(num(r.i) ?? 0, 1)} A
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-high">
                    <div className="h-full rounded-full bg-mint" style={{ width: `${share}%` }} />
                  </div>
                  <p className="mt-1 text-right text-xs font-semibold text-mint-dark">{n(share, 0)}% da produção</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Curva do dia" subtitle="Potência gerada ao longo das horas" aside={<Pill tone="gray" icon="calendar_today">Hoje</Pill>} />
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Geração total</p>
            <Value value={n(plant.todayKwh, 1)} unit="kWh" />
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Pico registrado</p>
            <span className="text-2xl font-bold text-mint-dark">{fmtPower(peak)}</span>
          </div>
        </div>
        <div className="mt-3">
          <PowerArea data={points} tz={TZ} height={200} />
        </div>
      </Card>
    </div>
  );
}
