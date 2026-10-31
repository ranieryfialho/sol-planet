import Link from "next/link";
import { EnergyBars, PowerArea, type BarPoint } from "@/components/charts";
import { Card, CardHeader, EmptyState, Icon, IconBadge, Pill, Value } from "@/components/ui";
import { brl, energy, fmtPower, n } from "@/lib/format";
import { getCurrentPlant, getDaily, getMonthly, getReadingsForDay, getAccountSettings, getYearly, TZ } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Period = "dia" | "mes" | "ano" | "total";
const PERIODS: { key: Period; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "total", label: "Total" },
];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const iso = (y: number, m: number, d = 1) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Desloca a data de referência em n períodos. */
function shift(ref: string, period: Period, by: number) {
  const [y, m, d] = ref.split("-").map(Number);
  if (period === "dia") return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
  if (period === "mes") return iso(new Date(Date.UTC(y, m - 1 + by, 1)).getUTCFullYear(), new Date(Date.UTC(y, m - 1 + by, 1)).getUTCMonth() + 1);
  if (period === "ano") return iso(y + by, 1);
  return ref;
}

function label(ref: string, period: Period) {
  const [y, m, d] = ref.split("-").map(Number);
  if (period === "dia") return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
  if (period === "mes") return `${MONTHS_LONG[m - 1]} ${y}`;
  if (period === "ano") return String(y);
  return "Desde a instalação";
}

export default async function Historico({ searchParams }: { searchParams: Promise<{ periodo?: string; ref?: string }> }) {
  const sp = await searchParams;
  const period: Period = (PERIODS.find((p) => p.key === sp.periodo)?.key ?? "mes") as Period;
  const today = todayLocal();
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(sp.ref ?? "") ? sp.ref! : today;
  const [y, m] = ref.split("-").map(Number);

  const plant = await getCurrentPlant();
  if (!plant) {
    return (
      <Card className="mt-2">
        <EmptyState icon="bar_chart" title="Sem dados ainda" text="O histórico aparece depois da primeira coleta do worker." />
      </Card>
    );
  }
  const { tariff } = await getAccountSettings();

  let bars: BarPoint[] = [];
  let totalKwh = 0;
  let prevKwh: number | null = null;
  let prevLabel = "";
  let dayPoints: { t: number; power: number | null; load: number | null }[] = [];
  let peakW = 0;

  if (period === "dia") {
    const rs = await getReadingsForDay(plant.id, ref);
    dayPoints = rs.map((r) => ({ t: r.ts.getTime(), power: r.powerW, load: r.loadW }));
    const [thisDay] = await getDaily(plant.id, ref, shift(ref, "dia", 1));
    totalKwh = thisDay?.energyKwh ?? 0;
    peakW = rs.reduce((mx, r) => Math.max(mx, r.powerW ?? 0), 0);
    const prev = await getDaily(plant.id, shift(ref, "dia", -1), ref);
    prevKwh = prev[0]?.energyKwh ?? null;
    prevLabel = "Dia anterior";
  } else if (period === "mes") {
    const from = iso(y, m);
    const to = shift(from, "mes", 1);
    const rows = await getDaily(plant.id, from, to);
    bars = rows.map((r) => ({ key: r.day, label: r.day.slice(8, 10), title: `${r.day.slice(8, 10)}/${r.day.slice(5, 7)}`, energyKwh: r.energyKwh, peakW: r.peakW }));
    const prev = await getDaily(plant.id, shift(from, "mes", -1), from);
    prevKwh = prev.length ? prev.reduce((s, r) => s + r.energyKwh, 0) : null;
    prevLabel = `Mês anterior (${MONTHS_LONG[(m + 10) % 12]})`;
  } else if (period === "ano") {
    const rows = await getMonthly(plant.id, y);
    bars = rows.map((r) => ({ key: String(r.month), label: MONTHS[r.month - 1], title: `${MONTHS_LONG[r.month - 1]} ${y}`, energyKwh: r.energyKwh, peakW: r.peakW }));
    const prev = await getMonthly(plant.id, y - 1);
    prevKwh = prev.length ? prev.reduce((s, r) => s + r.energyKwh, 0) : null;
    prevLabel = `Ano anterior (${y - 1})`;
  } else {
    const rows = await getYearly(plant.id);
    bars = rows.map((r) => ({ key: String(r.year), label: String(r.year), title: String(r.year), energyKwh: r.energyKwh, peakW: r.peakW }));
  }

  if (period !== "dia") {
    totalKwh = bars.reduce((s, b) => s + b.energyKwh, 0);
    peakW = bars.reduce((mx, b) => Math.max(mx, b.peakW ?? 0), 0);
  }
  const best = bars.reduce<BarPoint | null>((b, d) => (!b || d.energyKwh > b.energyKwh ? d : b), null);
  const avg = bars.length ? totalKwh / bars.length : null;
  const unitName = period === "mes" ? "dia" : period === "ano" ? "mês" : "ano";
  const productivity = plant.capacityKwp && avg != null ? avg / plant.capacityKwp : null;
  const diff = prevKwh ? ((totalKwh - prevKwh) / prevKwh) * 100 : null;
  const tot = energy(totalKwh);
  const canNext = period !== "total" && shift(ref, period, 1) <= today;
  const href = (p: Period, r = ref) => `/historico?periodo=${p}&ref=${r}`;
  const title = { dia: "Produção do Dia", mes: "Produção Mensal", ano: "Produção Anual", total: "Produção Total" }[period];

  return (
    <div className="mx-auto max-w-5xl space-y-4 lg:space-y-6">
      <h1 className="hidden text-[28px] font-bold tracking-tight lg:block">Histórico</h1>

      {/* seletor de período */}
      <div className="flex rounded-full bg-surface-mid/80 p-1">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={href(p.key, p.key === "total" ? today : ref)}
            className={`flex-1 rounded-full py-2 text-center text-sm transition ${p.key === period ? "bg-surface font-semibold text-ink shadow-pill" : "text-ink-2"}`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {period !== "total" && (
        <div className="flex items-center justify-between">
          <Link href={href(period, shift(ref, period, -1))} aria-label="Anterior" className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-pill">
            <Icon name="chevron_left" />
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-5 py-2.5 text-lg font-semibold shadow-pill">
            <Icon name="calendar_today" className="text-[20px] text-mint" />
            {label(ref, period)}
          </span>
          {canNext ? (
            <Link href={href(period, shift(ref, period, 1))} aria-label="Próximo" className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-pill">
              <Icon name="chevron_right" />
            </Link>
          ) : (
            <span className="h-12 w-12" />
          )}
        </div>
      )}

      <Card className="!rounded-[2rem]">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-mint" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-[44px] font-extrabold leading-[52px] tracking-tight">{tot.value}</span>
            <span className="text-3xl font-medium text-ink-3">{tot.unit}</span>
          </span>
          <Pill tone="mint-soft">Produção</Pill>
          <Pill tone="gray" icon="savings">{brl(totalKwh * tariff)}</Pill>
        </div>
        <div className="mt-4">
          {period === "dia" ? (
            <PowerArea data={dayPoints} tz={TZ} height={260} />
          ) : (
            <EnergyBars data={bars} height={240} average={period === "mes" ? avg : null} />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 lg:gap-6">
        {period === "dia" ? (
          <>
            <Stat icon="bolt" tone="mint" label="Pico" value={fmtPower(peakW)} />
            <Stat icon="schedule" tone="sky" label="Leituras" value={String(dayPoints.length)} hint="a cada 10 min" />
            <Stat icon="speed" tone="sun" label="Produtividade" value={plant.capacityKwp ? n(totalKwh / plant.capacityKwp, 1) : "—"} unit="kWh/kWp" />
          </>
        ) : (
          <>
            <Stat icon="verified" tone="mint" label={`Melhor ${unitName}`} value={best ? n(best.energyKwh, 1) : "—"} unit="kWh" hint={best?.title} />
            <Stat icon="bar_chart" tone="sky" label={`Média por ${unitName}`} value={avg != null ? n(avg, 1) : "—"} unit="kWh" />
            <Stat icon="speed" tone="sun" label="Produtividade" value={productivity != null ? n(productivity, 1) : "—"} unit="kWh/kWp" hint={`por ${unitName}`} />
          </>
        )}
      </div>

      {prevKwh != null && (
        <Card>
          <CardHeader
            title="Comparação"
            icon="compare_arrows"
            iconTone="sky"
            aside={diff != null && <Pill tone={diff >= 0 ? "mint-soft" : "sun-soft"} icon={diff >= 0 ? "trending_up" : "trending_down"}>{diff >= 0 ? "+" : ""}{n(diff, 1)}%</Pill>}
          />
          <CompareBar label={label(ref, period)} kwh={totalKwh} max={Math.max(totalKwh, prevKwh)} strong />
          <CompareBar label={prevLabel} kwh={prevKwh} max={Math.max(totalKwh, prevKwh)} />
        </Card>
      )}

      <Card className="flex items-center gap-4">
        <IconBadge name="eco" size="lg" />
        <div className="flex-1">
          <p className="text-lg font-semibold">Impacto Positivo</p>
          <p className="text-[13px] text-ink-2">{n(totalKwh * 0.997, 0)} kg de CO₂ evitados no período</p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, tone, label, value, unit, hint }: { icon: string; tone: "mint" | "sky" | "sun"; label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="rounded-[1.75rem] bg-surface p-4 shadow-card lg:p-6">
      <IconBadge name={icon} tone={tone} />
      <p className="mt-3 text-[13px] text-ink-2">{label}</p>
      <Value value={value} unit={unit} size="sm" />
      {hint && <p className={`text-xs ${tone === "mint" ? "text-mint" : tone === "sun" ? "text-sun" : "text-ink-2"}`}>{hint}</p>}
    </div>
  );
}

function CompareBar({ label, kwh, max, strong = false }: { label: string; kwh: number; max: number; strong?: boolean }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-[15px] text-ink">
          <span className={`h-2.5 w-2.5 rounded-full ${strong ? "bg-mint" : "bg-surface-high"}`} />
          {label}
        </span>
        <Value value={n(kwh, 1)} unit="kWh" size="sm" />
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-mid">
        <div className={`h-full rounded-full ${strong ? "bg-mint" : "bg-surface-high"}`} style={{ width: `${max ? (kwh / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
