/**
 * Regras de decisão puras: sem banco, sem relógio, sem rede.
 * O rules.ts busca os dados e envia o alerta; quem decide se há problema é este módulo (ver docs/adr/0001).
 */

export type Row = { name?: string; v?: number; i?: number; p?: number };

/** "HH:MM" em minutos desde a meia-noite. */
export const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const fmtW = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`);

/** Queda percentual de `value` em relação à `average` (negativa se subiu). */
export const dropPercent = (value: number, average: number) => (1 - value / average) * 100;

/** 30 min depois do fim do dia: com a janela no pôr do sol, o total do dia ainda está fechando. */
export const isAfterSun = (time: string, dayEnd: string) => mins(time) >= mins(dayEnd) + 30;

/** Meio do dia: duas horas de folga do nascer e do pôr do sol, quando a geração ainda é baixa de propósito. */
export const isMidday = (time: string, dayStart: string, dayEnd: string) => mins(time) >= mins(dayStart) + 120 && mins(time) < mins(dayEnd) - 120;

/** Strings PV conectadas (tensão > 50 V): uma string vazia não é desequilíbrio. */
export const connectedStrings = (pv: Row[] | null | undefined) => (pv ?? []).filter((s) => Number(s.v ?? 0) > 50);

/** Uma string rende X% menos que a melhor, com o inversor gerando de verdade (>= 1 kW). */
export function hasStringImbalance(strings: Row[], inverterPowerW: number, pct: number) {
  if (strings.length < 2 || inverterPowerW < 1000) return false;
  const powers = strings.map((s) => Number(s.p ?? 0));
  return Math.min(...powers) < Math.max(...powers) * (1 - pct / 100);
}

/** Tensão fora da faixa em que o inversor se desliga: +10% / -13% do nominal mais próximo (127 V ou 220 V). */
export function isGridVoltageOff(volts: number) {
  const nominal = Math.abs(volts - 127) < Math.abs(volts - 220) ? 127 : 220;
  return volts > nominal * 1.1 || volts < nominal * 0.87;
}
