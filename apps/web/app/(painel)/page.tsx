import { AlertItem } from "@/components/alert-item";
import { PowerArea, EnergyBars } from "@/components/charts";
import { EnergyHeroDesktop, EnergyHeroMobile } from "@/components/energy-hero";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader, EmptyState, Icon, IconBadge, Pill, Value } from "@/components/ui";
import { ecoImpact } from "@/lib/eco";
import { brl, energy, fmtPower, n } from "@/lib/format";
import {
  getAccountKv,
  getAlerts,
  getAvg7,
  getCurrentPlant,
  getInverters,
  getLastDays,
  getMonthSum,
  getAccountSettings,
  getTodayReadings,
  TZ,
} from "@/lib/queries";
import { statusOf } from "@/lib/status";
import { getWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

const monthName = () => new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: TZ });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Home() {
  const plant = await getCurrentPlant();
  if (!plant) {
    // o worker marca no kv quando a Solplanet devolveu zero usinas para esta conta
    const noPlants = await getAccountKv<string>("no_plants");
    return (
      <Card className="mt-6">
        {noPlants ? (
          <EmptyState
            icon="solar_power"
            title="Esta conta Solplanet não tem usinas"
            text="O login funcionou, mas a Solplanet não devolveu nenhuma usina para este e-mail. Confira no app da Solplanet se a usina está nesta conta (ou se foi cadastrada com outro e-mail ou telefone) e, se foi compartilhada, se o convite foi aceito."
          />
        ) : (
          <EmptyState
            icon="hourglass_top"
            title="Bem-vindo! Estamos buscando os seus dados"
            text="Conectamos à sua conta Solplanet e estamos trazendo a sua usina e o histórico dela. Na primeira vez isso leva de 1 a 3 minutos. Pode deixar esta página aberta: ela atualiza sozinha e os números aparecem assim que ficarem prontos."
          />
        )}
      </Card>
    );
  }

  const [readings, avg7, last30, monthSum, alerts, invs, weather, settings] = await Promise.all([
    getTodayReadings(plant.id),
    getAvg7(plant.id),
    getLastDays(plant.id, 30),
    getMonthSum(plant.id),
    getAlerts("todos", 3),
    getInverters(plant.id),
    getWeather(plant.latitude, plant.longitude),
    getAccountSettings(),
  ]);

  const inverter = invs[0];
  const points = readings.map((r) => ({ t: r.ts.getTime(), power: r.powerW, load: r.loadW }));
  const peak = readings.reduce((m, r) => ((r.powerW ?? 0) > m.powerW ? { powerW: r.powerW ?? 0, ts: r.ts } : m), { powerW: 0, ts: new Date() });
  // comparar com a média só depois do horário de sol; antes disso o dia ainda está incompleto
  const localHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date()));
  const dayEndHour = Number(settings.rules.dayEnd.slice(0, 2));
  const vs7 = avg7 && localHour >= dayEndHour ? ((plant.todayKwh - avg7) / avg7) * 100 : null;
  const yesterday = last30.at(-2)?.energyKwh ?? null;
  const monthKwh = plant.monthKwh ?? monthSum;
  const eco = ecoImpact(plant.totalKwh, plant.co2Kg);
  const total = energy(plant.totalKwh);
  const lastUpdate = plant.updatedAt.toLocaleTimeString("pt-BR", { timeZone: TZ });
  const avg30 = last30.length ? last30.reduce((s, d) => s + d.energyKwh, 0) / last30.length : null;
  const st = statusOf(plant.status);

  const todayCard = (
    <Card>
      <CardHeader title="Hoje" icon="today" href="/historico" aside={vs7 != null ? <Pill tone="gray" icon={vs7 >= 0 ? "trending_up" : "trending_down"} className={vs7 >= 0 ? "!text-mint-dark" : "!text-sun-dark"}>{vs7 >= 0 ? "+" : ""}{n(vs7, 0)}% vs 7d</Pill> : yesterday != null && <Pill tone="gray" icon="history">Ontem {n(yesterday, 1)} kWh</Pill>} />
      <div className="flex items-baseline gap-2">
        <Value value={n(plant.todayKwh, 1)} unit="kWh" size="xl" />
        <span className="text-xs font-bold uppercase tracking-wide text-mint">Produção</span>
      </div>
      {plant.capacityKwp ? <p className="mt-1 text-xs text-ink-2">{n(plant.todayKwh / plant.capacityKwp, 2)} kWh/kWp · economia de {brl(plant.todayKwh * settings.tariff)}</p> : null}
      <div className="mt-3">
        <PowerArea data={points} tz={TZ} height={150} />
      </div>
      {peak.powerW > 0 && (
        <p className="mt-1 text-center text-xs font-semibold text-ink">
          Pico {fmtPower(peak.powerW)} às {peak.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}
        </p>
      )}
    </Card>
  );

  const monthCard = (
    <Card>
      <CardHeader title="Resumo" icon="calendar_month" iconTone="sun" href="/historico" aside={<Pill tone="gray">{cap(monthName())}</Pill>} />
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-surface-low p-3">
          <p className="text-[11px] font-medium text-ink-3">Este mês</p>
          <p className="mt-1 text-lg font-bold">{n(monthKwh, 0)}</p>
          <p className="text-[11px] font-bold text-ink-2">kWh</p>
        </div>
        <div className="rounded-2xl bg-surface-low p-3">
          <p className="text-[11px] font-medium text-ink-3">Acumulado</p>
          <p className="mt-1 text-lg font-bold">{total.value}</p>
          <p className="text-[11px] font-bold text-ink-2">{total.unit}</p>
        </div>
        <div className="rounded-2xl bg-mint-soft p-3 text-mint-dark">
          <p className="text-[11px] font-medium">Economia</p>
          <p className="mt-1 text-lg font-bold">{brl(monthKwh * settings.tariff)}</p>
          <p className="text-[11px] font-bold">no mês</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <span className={`h-2.5 w-2.5 animate-pulse rounded-full ${st.dot}`} />
          {inverter?.model ? `Inversor ${inverter.model}` : "Inversor"} · {st.label}
        </span>
        {plant.capacityKwp ? <span className="text-xs font-semibold text-ink-3">{plant.capacityKwp} kWp</span> : null}
      </div>
    </Card>
  );

  const impactCard = (
    <Card>
      <CardHeader title="Contribuição ambiental" icon="eco" />
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { icon: "local_shipping", bg: "bg-line", label: "Carvão evitado", value: n(eco.coalT, 1), unit: "t" },
          { icon: "factory", bg: "bg-sky-soft text-sky", label: "CO₂ reduzido", value: n(eco.co2T, 1), unit: "t" },
          { icon: "park", bg: "bg-mint-soft text-mint-dark", label: "Árvores equiv.", value: n(eco.trees, 0), unit: "un" },
        ].map((i) => (
          <div key={i.label} className="flex flex-col items-center">
            <span className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full shadow-sm ${i.bg}`}>
              <Icon name={i.icon} fill={i.icon === "park"} className="text-[22px]" />
            </span>
            <span className="line-clamp-1 text-[11px] font-medium text-ink-3">{i.label}</span>
            <Value value={i.value} unit={i.unit} className="mt-0.5" />
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      <TopBar plant={plant} weather={weather} />

      {/* faixa de contexto (desktop) */}
      <div className="hidden flex-wrap items-center gap-3 rounded-3xl bg-surface/70 px-6 py-4 shadow-card backdrop-blur lg:flex">
        <h1 className="mr-2 text-xl font-bold">Visão Geral de Geração</h1>
        {inverter?.model && <Pill tone="gray" icon="solar_power">Inversor {inverter.model}</Pill>}
        {plant.capacityKwp ? <Pill tone="mint-soft" icon="bolt">{plant.capacityKwp} kWp instalados</Pill> : null}
        <Pill tone="gray" icon="schedule">Atualizado {lastUpdate}</Pill>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <div className="lg:hidden">
            <EnergyHeroMobile plant={plant} inverter={inverter} />
          </div>
          <div className="hidden lg:block">
            <EnergyHeroDesktop plant={plant} inverter={inverter} lastUpdate={lastUpdate} />
          </div>
          <Card className="hidden lg:block">
            <CardHeader title="Histórico Diário — Últimos 30 Dias" subtitle="Geração diária em kWh" href="/historico" />
            <EnergyBars
              average={avg30}
              data={last30.map((d) => ({
                key: d.day,
                label: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`,
                title: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`,
                energyKwh: d.energyKwh,
                peakW: d.peakW,
              }))}
              height={240}
            />
          </Card>
        </div>
        <div className="space-y-4 lg:space-y-6">
          {todayCard}
          {monthCard}
          {impactCard}
          <Card className="hidden lg:block">
            <CardHeader title="Eventos & Notificações" href="/alertas" />
            {alerts.length ? (
              <div className="space-y-3">
                {alerts.map((a) => (
                  <AlertItem key={a.id} a={a} tz={TZ} compact />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-mint-soft p-4">
                <IconBadge name="check_circle" />
                <p className="text-sm font-medium text-mint-dark">Tudo operando normalmente. Nenhum evento registrado.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
