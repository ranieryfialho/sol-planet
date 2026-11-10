import { statusOf } from "../status";

/** Dados brutos que o repositório entrega; o cálculo do resumo é puro e testado sem banco. */
export interface SummaryInput {
  plant: { id: number; name: string; status: number; capacityKwp: number | null; powerW: number; totalKwh: number; updatedAt: Date };
  todayKwh: number;
  peakW: number;
  /** média diária dos 7 dias anteriores (null sem histórico) */
  avg7Kwh: number | null;
  /** R$/kWh */
  tariff: number;
}

export interface Summary {
  usina: { id: number; nome: string; capacidadeKwp: number | null };
  status: { codigo: number; rotulo: string };
  agora: { potenciaW: number; atualizadoEm: string };
  hoje: { energiaKwh: number; picoW: number; economiaReais: number; produtividadeKwhKwp: number | null; variacaoMedia7dPct: number | null };
  media7dKwh: number | null;
  totalKwh: number;
}

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export function buildSummary({ plant, todayKwh, peakW, avg7Kwh, tariff }: SummaryInput): Summary {
  return {
    usina: { id: plant.id, nome: plant.name, capacidadeKwp: plant.capacityKwp },
    status: { codigo: plant.status, rotulo: statusOf(plant.status).label },
    agora: { potenciaW: Math.round(plant.powerW), atualizadoEm: plant.updatedAt.toISOString() },
    hoje: {
      energiaKwh: round(todayKwh),
      picoW: Math.round(peakW),
      economiaReais: round(todayKwh * tariff),
      // kWh gerados por kWp instalado: compara usinas de tamanhos diferentes
      produtividadeKwhKwp: plant.capacityKwp ? round(todayKwh / plant.capacityKwp) : null,
      // positivo = acima da média; sem média (usina nova) não há comparação
      variacaoMedia7dPct: avg7Kwh ? round((todayKwh / avg7Kwh - 1) * 100, 1) : null,
    },
    media7dKwh: avg7Kwh === null ? null : round(avg7Kwh),
    totalKwh: round(plant.totalKwh),
  };
}
