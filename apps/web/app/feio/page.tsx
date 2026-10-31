import { getAlerts, getCurrentPlant, getInverters, getLastDays, getTodayReadings, TZ } from "@/lib/queries";

export const dynamic = "force-dynamic";

const show = (v: unknown) => (v instanceof Date ? v.toLocaleString("pt-BR", { timeZone: TZ }) : v == null ? "-" : String(v));

function Dump({ title, obj }: { title: string; obj: Record<string, unknown> }) {
  return (
    <>
      <h2>== {title} ==</h2>
      <pre>{Object.entries(obj).map(([k, v]) => `${k}: ${show(v)}`).join("\n")}</pre>
    </>
  );
}

export default async function Feio() {
  const plant = await getCurrentPlant();
  if (!plant) return <main style={{ background: "#000", color: "#0f0", fontFamily: "monospace", padding: 16 }}>sem usina</main>;

  const [readings, days, alerts, invs] = await Promise.all([
    getTodayReadings(plant.id),
    getLastDays(plant.id, 30),
    getAlerts("todos", 10),
    getInverters(plant.id),
  ]);

  return (
    <main style={{ background: "#000", color: "#0f0", fontFamily: "monospace", fontSize: 14, padding: 16, minHeight: "100vh" }}>
      <h1>SOL-PLANET (versao feia)</h1>
      <Dump title="USINA" obj={plant} />
      {invs.map((i) => (
        <Dump key={i.sn} title={`INVERSOR ${i.sn}`} obj={i} />
      ))}
      <h2>== HOJE ({readings.length} leituras) ==</h2>
      <pre>{readings.map((r) => `${show(r.ts)}  gera=${show(r.powerW)}W  consumo=${show(r.loadW)}W`).join("\n")}</pre>
      <h2>== ULTIMOS 30 DIAS ==</h2>
      <pre>{days.map((d) => `${d.day}  ${d.energyKwh} kWh  pico=${show(d.peakW)}W`).join("\n")}</pre>
      <h2>== ALERTAS ==</h2>
      <pre>{alerts.length ? alerts.map((a) => `${show(a.occurredAt)}  [${a.kind}]  ${JSON.stringify(a)}`).join("\n") : "nenhum"}</pre>
    </main>
  );
}
