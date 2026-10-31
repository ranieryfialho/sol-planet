"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtPower, n } from "@/lib/format";

const MINT = "#1db98a";
const SUN = "#f28c28";
const tick = { fill: "#9ca3af", fontSize: 11, fontWeight: 500 };

function Bubble({ children }: { children: React.ReactNode }) {
  return <div className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white shadow-sheet">{children}</div>;
}

export interface PowerPoint {
  t: number;
  power: number | null;
  load?: number | null;
}

/** Curva de potência do dia: área menta com gradiente + consumo tracejado laranja (se houver medidor). */
export function PowerArea({ data, tz, height = 160, axis = true }: { data: PowerPoint[]; tz: string; height?: number; axis?: boolean }) {
  const hhmm = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const hasLoad = data.some((d) => d.load != null);
  if (data.length < 2) {
    return <div className="flex items-center justify-center text-sm text-ink-3" style={{ height }}>Aguardando leituras de hoje.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="solarFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={MINT} stopOpacity={0.38} />
            <stop offset="85%" stopColor={MINT} stopOpacity={0.04} />
            <stop offset="100%" stopColor={MINT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={hhmm}
          tick={tick}
          axisLine={false}
          tickLine={false}
          minTickGap={36}
          hide={!axis}
        />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip
          cursor={{ stroke: "#bbcac1", strokeDasharray: "3 3" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-2xl bg-surface px-3 py-2 text-xs shadow-sheet">
                <div className="mb-1 font-semibold text-ink">{hhmm(Number(label))}</div>
                {payload.map((p) => (
                  <div key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.dataKey === "load" ? SUN : MINT }} />
                    {p.dataKey === "load" ? "Consumo" : "Produção"}
                    <span className="ml-auto pl-3 font-semibold text-ink">{fmtPower(Number(p.value))}</span>
                  </div>
                ))}
              </div>
            ) : null
          }
        />
        <Area type="monotone" dataKey="power" connectNulls stroke={MINT} strokeWidth={2.5} fill="url(#solarFill)" isAnimationActive={false} activeDot={{ r: 5, stroke: MINT, strokeWidth: 2.5, fill: "#fff" }} />
        {hasLoad && <Line type="monotone" dataKey="load" stroke={SUN} strokeWidth={1.8} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface BarPoint {
  key: string;
  /** rótulo do eixo */
  label: string;
  /** rótulo do tooltip */
  title: string;
  energyKwh: number;
  peakW?: number;
}

/** Barras de geração: menta claro, destaque no melhor período (ou no que estiver sob o mouse). */
export function EnergyBars({ data, height = 220, average }: { data: BarPoint[]; height?: number; average?: number | null }) {
  const best = data.reduce((b, d, i) => (d.energyKwh > (data[b]?.energyKwh ?? -1) ? i : b), 0);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? best;
  if (!data.length) {
    return <div className="flex items-center justify-center text-center text-sm text-ink-3" style={{ height }}>O histórico aparece conforme o worker coleta os dias.</div>;
  }
  const sel = data[active];
  return (
    <div>
      <div className="mb-2 flex h-8 justify-center">
        {sel && (
          <Bubble>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-mint" />
            {sel.title} · {n(sel.energyKwh, 1)} kWh
          </Bubble>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="18%" onMouseLeave={() => setHover(null)}>
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip cursor={false} content={() => null} />
          {average ? (
            <ReferenceLine
              y={average}
              stroke="#bbcac1"
              strokeDasharray="4 4"
              label={{ value: `Média: ${n(average, 1)} kWh`, position: "insideTopRight", fill: "#4b5563", fontSize: 11 }}
            />
          ) : null}
          <Bar dataKey="energyKwh" radius={[6, 6, 6, 6]} isAnimationActive={false} onMouseEnter={(_, i) => setHover(i)}>
            {data.map((d, i) => (
              <Cell key={d.key} fill={MINT} fillOpacity={i === active ? 1 : 0.38} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
